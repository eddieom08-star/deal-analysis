import { AnalysisStatus } from "@/lib/types";
import type { AnalysisRecord, ComparableEvidence } from "@/lib/types";
import { scrapeListing } from "@/lib/scraper";
import { getSoldPrices, getSoldPricesPerSqft, getValuation } from "@/lib/apis/property-data";
import { getTransactionsByPostcode } from "@/lib/apis/land-registry";
import { searchByPostcode, sqmToSqft } from "@/lib/apis/epc";
import { enrichComparables } from "@/lib/comparables/enricher";
import { calculateAreaMetrics, crossReferenceEvidence } from "@/lib/comparables/calculator";
import { generateInvestmentMemo } from "@/lib/analysis/investment-memo";
import { generateValuationMemo } from "@/lib/analysis/valuation-memo";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvestmentMemoPDF } from "@/lib/pdf/investment-memo-pdf";
import { ValuationMemoPDF } from "@/lib/pdf/valuation-memo-pdf";
import { saveAnalysis, uploadPDF } from "@/lib/storage/blob";
import { sendReportEmail } from "@/lib/email/send-report";
import React from "react";

function updateStatus(analysis: AnalysisRecord, status: AnalysisStatus): AnalysisRecord {
  return { ...analysis, status, updatedAt: new Date().toISOString() };
}

function assessDataAvailability(comparables: ComparableEvidence): string[] {
  const warnings: string[] = [];

  const hasPropertyData =
    comparables.propertyData.soldPrices !== null ||
    comparables.propertyData.soldPricesPerSqft !== null;
  const hasEnrichedComps = comparables.enrichedComparables.length > 0;
  const hasLandRegistry = comparables.landRegistry.length > 0;

  if (!hasPropertyData) {
    warnings.push("PropertyData APIs unavailable - Claude will estimate from available data");
  }
  if (!hasEnrichedComps) {
    warnings.push("No enriched comparables (LR+EPC match) - using raw transaction data");
  }
  if (!hasLandRegistry) {
    warnings.push("No Land Registry transactions found - relying on PropertyData only");
  }
  if (!hasPropertyData && !hasEnrichedComps && !hasLandRegistry) {
    warnings.push("WARNING: All external data APIs failed - Claude will generate analysis from listing data only. Results will be less accurate.");
  }

  for (const w of warnings) {
    console.warn(`[pipeline] ${w}`);
  }

  return warnings;
}

async function shouldResumeAnalysis(analysis: AnalysisRecord): Promise<boolean> {
  // Resume if previously failed and failure was retryable
  return (
    analysis.status === AnalysisStatus.FAILED &&
    analysis.retryableFailure === true &&
    (analysis.retryCount || 0) < 3
  );
}

function getResumeStep(analysis: AnalysisRecord): AnalysisStatus | null {
  if (!analysis.lastCompletedStep) return null;

  // Map each step to its next step
  const stepSequence: AnalysisStatus[] = [
    AnalysisStatus.PENDING,
    AnalysisStatus.SCRAPING,
    AnalysisStatus.FETCHING_DATA,
    AnalysisStatus.ENRICHING_COMPARABLES,
    AnalysisStatus.ANALYZING_INVESTMENT,
    AnalysisStatus.ANALYZING_VALUATION,
    AnalysisStatus.GENERATING_PDFS,
    AnalysisStatus.UPLOADING,
    AnalysisStatus.EMAILING,
    AnalysisStatus.COMPLETE,
  ];

  const lastIndex = stepSequence.indexOf(analysis.lastCompletedStep);
  if (lastIndex >= 0 && lastIndex < stepSequence.length - 1) {
    return stepSequence[lastIndex + 1];
  }

  return null;
}

export async function runAnalysisPipeline(analysis: AnalysisRecord): Promise<void> {
  let currentRetryCount = analysis.retryCount || 0;

  try {
    // Check if resuming from previous failure
    const resumeFrom = await shouldResumeAnalysis(analysis) ? getResumeStep(analysis) : null;

    if (resumeFrom) {
      console.log(`Resuming analysis ${analysis.id} from step: ${resumeFrom}`);
      currentRetryCount++;
      analysis.retryCount = currentRetryCount;
    }

    // Step 1: Scrape listing
    if (!resumeFrom || resumeFrom === AnalysisStatus.SCRAPING) {
      analysis = updateStatus(analysis, AnalysisStatus.SCRAPING);
      await saveAnalysis(analysis);

      const scraped = await scrapeListing(analysis.input.listingUrl);
      analysis.listing = scraped;
      analysis.lastCompletedStep = AnalysisStatus.SCRAPING;
      await saveAnalysis(analysis);
    }

    // Ensure listing exists (from previous run or just scraped)
    if (!analysis.listing) {
      throw new Error("Listing data missing - cannot proceed");
    }

    const listing = analysis.listing;
    const postcode = listing.address.postcode;

    // Declare data variables at pipeline scope so all subsequent steps can access them.
    // Initialize from previously saved comparables (for resume) or defaults.
    let soldPrices = analysis.comparables?.propertyData.soldPrices ?? null;
    let sqftData = analysis.comparables?.propertyData.soldPricesPerSqft ?? null;
    let landRegistry = analysis.comparables?.landRegistry ?? [];
    let epcData = analysis.comparables?.epc ?? [];

    // Step 2: Fetch raw data in parallel
    if (!resumeFrom || [AnalysisStatus.SCRAPING, AnalysisStatus.FETCHING_DATA].includes(resumeFrom)) {
      analysis = updateStatus(analysis, AnalysisStatus.FETCHING_DATA);
      await saveAnalysis(analysis);

      const warnings: string[] = [];

      if (!postcode || postcode.trim().length < 3) {
        // No valid postcode — skip all postcode-based API calls
        warnings.push("No valid postcode extracted from listing - skipping external data APIs. Analysis will use listing data only.");
        console.warn(`[pipeline] No postcode for ${listing.address.displayAddress} — skipping API calls`);
      } else {
        const [soldPricesResult, sqftResult, lrTransactions, epcCerts] = await Promise.allSettled([
          getSoldPrices(postcode, { type: "flat", maxAge: 18 }),
          getSoldPricesPerSqft(postcode, { type: "flat", maxAge: 18 }),
          getTransactionsByPostcode(postcode, { maxAgeMonths: 18, propertyType: "flat" }),
          searchByPostcode(postcode),
        ]);

        soldPrices = soldPricesResult.status === "fulfilled" ? soldPricesResult.value : null;
        sqftData = sqftResult.status === "fulfilled" ? sqftResult.value : null;
        landRegistry = lrTransactions.status === "fulfilled" ? lrTransactions.value : [];
        epcData = epcCerts.status === "fulfilled" ? epcCerts.value : [];

        if (soldPricesResult.status === "rejected") {
          warnings.push(`PropertyData sold prices unavailable: ${soldPricesResult.reason?.message || "unknown error"}`);
        }
        if (sqftResult.status === "rejected") {
          warnings.push(`PropertyData sqft data unavailable: ${sqftResult.reason?.message || "unknown error"}`);
        }
        if (lrTransactions.status === "rejected") {
          warnings.push(`Land Registry data unavailable: ${lrTransactions.reason?.message || "unknown error"}`);
        }
        if (epcCerts.status === "rejected") {
          warnings.push(`EPC data unavailable: ${epcCerts.reason?.message || "unknown error"}`);
        }
      }

      analysis.partialDataWarnings = warnings.length > 0 ? warnings : undefined;
      analysis.lastCompletedStep = AnalysisStatus.FETCHING_DATA;
      await saveAnalysis(analysis);
    }

    // Try to get PropertyData AVM valuation
    let valuation = null;
    const propertyEpc = epcData.find((e) => {
      const epcAddr = `${e.address1} ${e.address2}`.toLowerCase();
      return epcAddr.includes(listing.address.street.toLowerCase().slice(0, 10));
    });

    if (propertyEpc && propertyEpc.totalFloorArea > 0) {
      try {
        valuation = await getValuation({
          postcode,
          propertyType: "flat",
          constructionDate: "pre_1914",
          internalArea: sqmToSqft(propertyEpc.totalFloorArea),
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          finishQuality: "average",
          outdoorSpace: "none",
          offStreetParking: 0,
        });
      } catch {
        // Valuation not critical
      }
    }

    // Step 3: Enrich comparables (HouseMetric approach)
    if (!resumeFrom || [AnalysisStatus.SCRAPING, AnalysisStatus.FETCHING_DATA, AnalysisStatus.ENRICHING_COMPARABLES].includes(resumeFrom)) {
      analysis = updateStatus(analysis, AnalysisStatus.ENRICHING_COMPARABLES);
      await saveAnalysis(analysis);

      const enrichedComparables = enrichComparables(landRegistry, epcData);
      const areaMetrics = calculateAreaMetrics(enrichedComparables, postcode);
      const crossReference = crossReferenceEvidence(sqftData, areaMetrics);

      const comparables: ComparableEvidence = {
        propertyData: {
          soldPrices,
          soldPricesPerSqft: sqftData,
          valuation,
        },
        landRegistry,
        epc: epcData,
        enrichedComparables,
        areaMetrics,
        crossReference,
      };

      analysis.comparables = comparables;
      analysis.lastCompletedStep = AnalysisStatus.ENRICHING_COMPARABLES;
      await saveAnalysis(analysis);
    }

    // Validate sufficient data before Claude analysis
    if (!analysis.comparables) {
      throw new Error("Comparable evidence missing - cannot proceed");
    }
    const validatedComparables = analysis.comparables;
    const dataWarnings = assessDataAvailability(validatedComparables);
    if (dataWarnings.length > 0) {
      analysis.partialDataWarnings = [
        ...(analysis.partialDataWarnings || []),
        ...dataWarnings,
      ];
      await saveAnalysis(analysis);
    }

    // Step 4: Claude - Investment Memo
    if (!resumeFrom || [AnalysisStatus.SCRAPING, AnalysisStatus.FETCHING_DATA, AnalysisStatus.ENRICHING_COMPARABLES, AnalysisStatus.ANALYZING_INVESTMENT].includes(resumeFrom)) {
      analysis = updateStatus(analysis, AnalysisStatus.ANALYZING_INVESTMENT);
      await saveAnalysis(analysis);

      const investmentMemo = await generateInvestmentMemo(listing, validatedComparables);
      analysis.investmentMemo = investmentMemo;
      analysis.lastCompletedStep = AnalysisStatus.ANALYZING_INVESTMENT;
      await saveAnalysis(analysis);
    }

    // Step 5: Claude - Valuation Memo
    if (!resumeFrom || [AnalysisStatus.ANALYZING_INVESTMENT, AnalysisStatus.ANALYZING_VALUATION].includes(resumeFrom)) {
      analysis = updateStatus(analysis, AnalysisStatus.ANALYZING_VALUATION);
      await saveAnalysis(analysis);

      const valuationMemo = await generateValuationMemo(listing, validatedComparables);
      analysis.valuationMemo = valuationMemo;
      analysis.lastCompletedStep = AnalysisStatus.ANALYZING_VALUATION;
      await saveAnalysis(analysis);
    }

    if (!analysis.investmentMemo || !analysis.valuationMemo) {
      throw new Error("Memo generation incomplete - cannot proceed to PDF");
    }
    const finalInvestmentMemo = analysis.investmentMemo;
    const finalValuationMemo = analysis.valuationMemo;

    // Step 6: Generate PDFs
    analysis = updateStatus(analysis, AnalysisStatus.GENERATING_PDFS);
    await saveAnalysis(analysis);

    const investmentPdfBuffer = await renderToBuffer(
      React.createElement(InvestmentMemoPDF, { data: finalInvestmentMemo }) as any
    );
    const valuationPdfBuffer = await renderToBuffer(
      React.createElement(ValuationMemoPDF, { data: finalValuationMemo }) as any
    );
    analysis.lastCompletedStep = AnalysisStatus.GENERATING_PDFS;

    // Step 7: Upload to Blob
    analysis = updateStatus(analysis, AnalysisStatus.UPLOADING);
    await saveAnalysis(analysis);

    const investmentPdfUrl = await uploadPDF(
      analysis.id,
      listing.address.street,
      listing.address.postcode,
      "investment-memo",
      investmentPdfBuffer,
    );
    const valuationPdfUrl = await uploadPDF(
      analysis.id,
      listing.address.street,
      listing.address.postcode,
      "valuation-memo",
      valuationPdfBuffer,
    );

    analysis.pdfs = {
      investmentMemoUrl: investmentPdfUrl,
      valuationMemoUrl: valuationPdfUrl,
    };
    analysis.lastCompletedStep = AnalysisStatus.UPLOADING;
    await saveAnalysis(analysis);

    // Step 8: Send email
    analysis = updateStatus(analysis, AnalysisStatus.EMAILING);
    await saveAnalysis(analysis);

    const reportEmail = analysis.input.reportEmail || process.env.REPORT_EMAIL;
    if (reportEmail) {
      try {
        await sendReportEmail({
          to: reportEmail,
          propertyAddress: listing.address.displayAddress,
          recommendation: finalInvestmentMemo.recommendation,
          keyMetrics: finalInvestmentMemo.keyMetrics,
          investmentMemoPdf: investmentPdfBuffer,
          valuationMemoPdf: valuationPdfBuffer,
          analysisUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/analysis/${analysis.id}`,
        });
        analysis.emailSentAt = new Date().toISOString();
      } catch (emailErr) {
        // Email failure is non-critical
        console.error("Email send failed:", emailErr);
      }
    }
    analysis.lastCompletedStep = AnalysisStatus.EMAILING;

    // Success - clear retry metadata
    analysis.retryCount = 0;
    analysis.failureReason = undefined;
    analysis.retryableFailure = undefined;

    // Done
    analysis = updateStatus(analysis, AnalysisStatus.COMPLETE);
    await saveAnalysis(analysis);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Categorize error as retryable or not
    const isRetryable = errorMessage.toLowerCase().includes('timeout') ||
                        errorMessage.toLowerCase().includes('network') ||
                        errorMessage.toLowerCase().includes('insufficient_data') ||
                        errorMessage.toLowerCase().includes('429') ||
                        errorMessage.toLowerCase().includes('500') ||
                        errorMessage.toLowerCase().includes('502') ||
                        errorMessage.toLowerCase().includes('503');

    analysis.status = AnalysisStatus.FAILED;
    analysis.error = errorMessage;
    analysis.failureReason = errorMessage;
    analysis.retryableFailure = isRetryable;
    analysis.updatedAt = new Date().toISOString();
    await saveAnalysis(analysis);
  }
}
