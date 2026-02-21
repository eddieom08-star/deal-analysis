import { AnalysisStatus } from "@/lib/types";
import type { AnalysisRecord, ComparableEvidence } from "@/lib/types";
import { scrapeRightmoveListing } from "@/lib/scraper/rightmove";
import { getSoldPrices, getSoldPricesPerSqft, getValuation } from "@/lib/apis/property-data";
import { getTransactionsByPostcode } from "@/lib/apis/land-registry";
import { searchByPostcode, searchByAddress, sqmToSqft } from "@/lib/apis/epc";
import { enrichComparables } from "@/lib/comparables/enricher";
import { calculateAreaMetrics, findBestComparables, crossReferenceEvidence } from "@/lib/comparables/calculator";
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

export async function runAnalysisPipeline(analysis: AnalysisRecord): Promise<void> {
  try {
    // Step 1: Scrape Rightmove
    analysis = updateStatus(analysis, AnalysisStatus.SCRAPING);
    await saveAnalysis(analysis);

    const listing = await scrapeRightmoveListing(analysis.input.rightmoveUrl);
    analysis.listing = listing;
    await saveAnalysis(analysis);

    // Step 2: Fetch raw data in parallel
    analysis = updateStatus(analysis, AnalysisStatus.FETCHING_DATA);
    await saveAnalysis(analysis);

    const postcode = listing.address.postcode;

    const [soldPricesResult, sqftResult, lrTransactions, epcCerts] = await Promise.allSettled([
      getSoldPrices(postcode, { type: "flat", maxAge: 18 }),
      getSoldPricesPerSqft(postcode, { type: "flat", maxAge: 18 }),
      getTransactionsByPostcode(postcode, { maxAgeMonths: 18, propertyType: "flat" }),
      searchByPostcode(postcode),
    ]);

    const soldPrices = soldPricesResult.status === "fulfilled" ? soldPricesResult.value : null;
    const sqftData = sqftResult.status === "fulfilled" ? sqftResult.value : null;
    const landRegistry = lrTransactions.status === "fulfilled" ? lrTransactions.value : [];
    const epcData = epcCerts.status === "fulfilled" ? epcCerts.value : [];

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
    await saveAnalysis(analysis);

    // Step 4: Claude - Investment Memo
    analysis = updateStatus(analysis, AnalysisStatus.ANALYZING_INVESTMENT);
    await saveAnalysis(analysis);

    const investmentMemo = await generateInvestmentMemo(listing, comparables);
    analysis.investmentMemo = investmentMemo;
    await saveAnalysis(analysis);

    // Step 5: Claude - Valuation Memo
    analysis = updateStatus(analysis, AnalysisStatus.ANALYZING_VALUATION);
    await saveAnalysis(analysis);

    const valuationMemo = await generateValuationMemo(listing, comparables);
    analysis.valuationMemo = valuationMemo;
    await saveAnalysis(analysis);

    // Step 6: Generate PDFs
    analysis = updateStatus(analysis, AnalysisStatus.GENERATING_PDFS);
    await saveAnalysis(analysis);

    const investmentPdfBuffer = Buffer.from(
      await renderToBuffer(React.createElement(InvestmentMemoPDF, { data: investmentMemo }) as any),
    );
    const valuationPdfBuffer = Buffer.from(
      await renderToBuffer(React.createElement(ValuationMemoPDF, { data: valuationMemo }) as any),
    );

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
          recommendation: investmentMemo.recommendation,
          keyMetrics: investmentMemo.keyMetrics,
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

    // Done
    analysis = updateStatus(analysis, AnalysisStatus.COMPLETE);
    await saveAnalysis(analysis);
  } catch (error) {
    analysis.status = AnalysisStatus.FAILED;
    analysis.error = error instanceof Error ? error.message : "Unknown error";
    analysis.updatedAt = new Date().toISOString();
    await saveAnalysis(analysis);
  }
}
