import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import type { InvestmentMemoData } from "@/lib/types";
import {
  baseStyles,
  Table,
  DetailTable,
  NarrativeTable,
  MetricCard,
  StatusBadge,
  PageHeader,
  PageFooter,
  RecommendationBox,
  CriticalNoteBox,
  DecisionBox,
  BulletList,
  fmtCurrency,
  fmtPercent,
} from "./components";

interface Props {
  data: InvestmentMemoData;
}

export function InvestmentMemoPDF({ data }: Props) {
  const hdr = { title: "FREEHOLD BLOCK TITLE SPLITTING", subtitle: "INVESTMENT ASSESSMENT MEMO" };
  const ftr = { address: data.propertyAddress, date: data.analysisDate };

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 1: Cover + Key Metrics
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 2 }}>
            FREEHOLD BLOCK TITLE SPLITTING
          </Text>
          <Text style={{ fontSize: 14, color: "#71717a", marginBottom: 12 }}>
            INVESTMENT ASSESSMENT MEMO
          </Text>
          <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold" }}>
            {data.propertyAddress}
          </Text>
        </View>

        <RecommendationBox status={data.recommendation} rationale={data.recommendationRationale} />

        <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 16, marginBottom: 8 }}>
          KEY METRICS DASHBOARD
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <MetricCard small label="Purchase Price" value={fmtCurrency(data.keyMetrics.purchasePrice)} />
          <MetricCard small label="Aggregate Value (As-Is)" value={fmtCurrency(data.keyMetrics.aggregateValue)} />
          <MetricCard small label="Post-Refurb GDV (Mod)" value={fmtCurrency(data.keyMetrics.postRefurbGDV)} />
          <MetricCard small label="Lender LTV (75%)" value={fmtCurrency(data.keyMetrics.lenderLTV75)} color="#2563eb" />
          <MetricCard small label="Gross Profit (Mod)" value={fmtCurrency(data.keyMetrics.grossProfit)} color="#16a34a" />
          <MetricCard small label="ROI (Mod)" value={fmtPercent(data.keyMetrics.roi)} color="#16a34a" />
        </View>

        <CriticalNoteBox text={data.criticalNote} />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 2: Section 1 - Screening Summary
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>SECTION 1: SCREENING SUMMARY</Text>

        <Text style={baseStyles.h3}>Property Overview</Text>
        <DetailTable
          rows={[
            ["Address", data.screening.overview.address],
            ["Listing Price", data.screening.overview.listingPrice],
            ["Number of Flats", data.screening.overview.numberOfFlats],
            ["Total GIA", data.screening.overview.totalGia],
            ["Building Type", data.screening.overview.buildingType],
            ["Construction", data.screening.overview.construction],
            ["Listed Status", data.screening.overview.listedStatus],
            ["Tenure", data.screening.overview.tenure],
            ["Current Condition", data.screening.overview.currentCondition],
            ["Vacancy Status", data.screening.overview.vacancyStatus],
            ["Current Yield", data.screening.overview.currentYield],
            ["EPC Ratings", data.screening.overview.epcRatings],
            ["Council Tax Bands", data.screening.overview.councilTaxBands],
            ["Location", data.screening.overview.locationNotes],
            ["Agent", data.screening.overview.agent],
            ["Listed Date", data.screening.overview.listedDate],
          ]}
        />

        <Text style={baseStyles.h3}>Mandatory Screening Criteria</Text>
        <Table
          headers={["Criterion", "Requirement", "Status", "Confidence"]}
          columnWidths={[25, 30, 25, 20]}
          boldFirstColumn
          rows={data.screening.mandatoryCriteria.map((c) => [
            c.criterion,
            c.requirement,
            c.status.replace(/_/g, " "),
            c.confidence,
          ])}
        />

        <CriticalNoteBox text={data.screening.criticalNote} />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 3: Unit Schedule
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h3}>Unit Schedule</Text>
        <Table
          headers={["Flat", "Floor", "Beds", "GIA (sqm)", "GIA (sqft)", "EPC", ">=30?", "Current Rent"]}
          columnWidths={[12, 12, 8, 12, 12, 10, 14, 20]}
          boldLastRow
          rows={data.screening.unitSchedule.map((u) => [
            u.flat,
            u.floor,
            String(u.beds),
            String(u.giaSqm),
            String(u.giaSqft),
            u.epc,
            typeof u.meetsMinSize === "boolean" ? (u.meetsMinSize ? "PASS" : "FAIL") : String(u.meetsMinSize),
            u.currentRent,
          ])}
        />

        {data.screening.unitScheduleSummary ? (
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 6 }}>
            {data.screening.unitScheduleSummary}
          </Text>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 4: Section 2 - Financial Analysis (Value Creation Steps)
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>SECTION 2: FINANCIAL ANALYSIS</Text>

        <Text style={baseStyles.h3}>{data.financial.valueCreationStep1.title}</Text>
        <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 8 }}>
          {data.financial.valueCreationStep1.description}
        </Text>
        <Table
          headers={["Flat", "sqm", "Beds", "Cons. \u00A3/sqm", "Mod. \u00A3/sqm", "Agg. \u00A3/sqm", "As-Is Value (Mod)"]}
          columnWidths={[16, 8, 8, 14, 14, 14, 22]}
          boldFirstColumn
          boldLastRow
          rows={[
            ...data.financial.valueCreationStep1.perUnit.map((u) => [
              u.flat,
              String(u.sqm),
              String(u.beds),
              fmtCurrency(u.conservativePriceSqm),
              fmtCurrency(u.moderatePriceSqm),
              fmtCurrency(u.aggressivePriceSqm),
              fmtCurrency(u.asIsValue),
            ]),
            [
              "TOTAL",
              String(data.financial.valueCreationStep1.perUnit.reduce((s, u) => s + u.sqm, 0)),
              "",
              fmtCurrency(data.financial.valueCreationStep1.totals.conservative),
              fmtCurrency(data.financial.valueCreationStep1.totals.moderate),
              fmtCurrency(data.financial.valueCreationStep1.totals.aggressive),
              fmtCurrency(data.financial.valueCreationStep1.totals.moderate),
            ],
          ]}
        />
        <Text style={{ fontSize: 8, color: "#52525b", marginTop: 4 }}>
          Conservative = lower-quartile comparable evidence | Moderate = median comparable evidence | Aggressive = upper-quartile comparable evidence
        </Text>
        {data.financial.valueCreationStep1.blockDiscountNote ? (
          <Text style={{ fontSize: 9, marginTop: 6 }}>
            {data.financial.valueCreationStep1.blockDiscountNote}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>{data.financial.valueCreationStep2.title}</Text>
        <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 8 }}>
          {data.financial.valueCreationStep2.description}
        </Text>
        <Table
          headers={["Flat", "sqm", "Cons. GDV", "Mod. GDV", "Agg. GDV", "\u00A3/sqm (Mod)"]}
          columnWidths={[18, 10, 16, 16, 16, 18]}
          boldFirstColumn
          boldLastRow
          rows={[
            ...data.financial.valueCreationStep2.perUnit.map((u) => [
              u.flat,
              String(u.sqm),
              fmtCurrency(u.conservativeGDV),
              fmtCurrency(u.moderateGDV),
              fmtCurrency(u.aggressiveGDV),
              fmtCurrency(u.priceSqmMod),
            ]),
            [
              "TOTAL GDV",
              String(data.financial.valueCreationStep2.perUnit.reduce((s, u) => s + u.sqm, 0)),
              fmtCurrency(data.financial.valueCreationStep2.totals.conservative),
              fmtCurrency(data.financial.valueCreationStep2.totals.moderate),
              fmtCurrency(data.financial.valueCreationStep2.totals.aggressive),
              "",
            ],
          ]}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 5: Costs Breakdown + Tax
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h3}>Acquisition & Project Costs</Text>
        <Table
          headers={["Cost Item", "Amount", "Notes"]}
          columnWidths={[40, 20, 40]}
          boldLastRow
          rows={[
            ...data.financial.acquisitionCosts.map((c) => [c.item, fmtCurrency(c.amount), c.notes]),
            ["Total Acquisition", fmtCurrency(data.financial.totalAcquisition), ""],
            ...data.financial.splittingCosts.map((c) => [c.item, fmtCurrency(c.amount), c.notes]),
            ["Total Splitting Costs", fmtCurrency(data.financial.totalSplitting), ""],
            ...data.financial.refurbishmentCosts.map((c) => [c.item, fmtCurrency(c.amount), c.notes]),
            ["Total Refurbishment", fmtCurrency(data.financial.totalRefurbishment), ""],
            ...data.financial.financeCosts.map((c) => [c.item, fmtCurrency(c.amount), c.notes]),
            ["Total Finance & Holding", fmtCurrency(data.financial.totalFinanceAndHolding), ""],
            ["TOTAL PROJECT INVESTMENT", fmtCurrency(data.financial.totalProjectInvestment), ""],
          ]}
        />

        <Text style={baseStyles.h3}>
          {data.financial.taxBreakdown.taxType} - Higher Residential Rates Breakdown
        </Text>
        <Table
          headers={["Band", "Rate", "Taxable Amount", `${data.financial.taxBreakdown.taxType} Due`, "Cumulative"]}
          columnWidths={[28, 12, 20, 20, 20]}
          boldLastRow
          rows={[
            ...data.financial.taxBreakdown.bands.map((b) => [
              b.band,
              b.rate,
              fmtCurrency(b.taxableAmount),
              fmtCurrency(b.taxDue),
              fmtCurrency(b.cumulative),
            ]),
            [
              `TOTAL ${data.financial.taxBreakdown.taxType}`,
              data.financial.taxBreakdown.effectiveRate,
              "",
              fmtCurrency(data.financial.taxBreakdown.totalTax),
              "",
            ],
          ]}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 6: Returns Analysis
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 8 }}>
          RETURNS ANALYSIS
        </Text>

        <Text style={baseStyles.h3}>Scenario Modelling</Text>
        <Table
          headers={["Metric", "Conservative", "Moderate", "Aggressive"]}
          columnWidths={[34, 22, 22, 22]}
          boldFirstColumn
          rows={[
            ["Total GDV (Post-Refurb)", fmtCurrency(data.financial.scenarioReturns.conservative.totalGDV), fmtCurrency(data.financial.scenarioReturns.moderate.totalGDV), fmtCurrency(data.financial.scenarioReturns.aggressive.totalGDV)],
            ["Total Investment", fmtCurrency(data.financial.scenarioReturns.conservative.totalInvestment), fmtCurrency(data.financial.scenarioReturns.moderate.totalInvestment), fmtCurrency(data.financial.scenarioReturns.aggressive.totalInvestment)],
            ["Less: Sales Costs (2.5%)", `(${fmtCurrency(data.financial.scenarioReturns.conservative.salesCosts)})`, `(${fmtCurrency(data.financial.scenarioReturns.moderate.salesCosts)})`, `(${fmtCurrency(data.financial.scenarioReturns.aggressive.salesCosts)})`],
            ["Net Proceeds", fmtCurrency(data.financial.scenarioReturns.conservative.netProceeds), fmtCurrency(data.financial.scenarioReturns.moderate.netProceeds), fmtCurrency(data.financial.scenarioReturns.aggressive.netProceeds)],
            ["Gross Profit", fmtCurrency(data.financial.scenarioReturns.conservative.grossProfit), fmtCurrency(data.financial.scenarioReturns.moderate.grossProfit), fmtCurrency(data.financial.scenarioReturns.aggressive.grossProfit)],
            ["Profit Margin", fmtPercent(data.financial.scenarioReturns.conservative.profitMargin), fmtPercent(data.financial.scenarioReturns.moderate.profitMargin), fmtPercent(data.financial.scenarioReturns.aggressive.profitMargin)],
            ["ROI (on total investment)", fmtPercent(data.financial.scenarioReturns.conservative.roi), fmtPercent(data.financial.scenarioReturns.moderate.roi), fmtPercent(data.financial.scenarioReturns.aggressive.roi)],
            ["Profit Per Unit", fmtCurrency(data.financial.scenarioReturns.conservative.profitPerUnit), fmtCurrency(data.financial.scenarioReturns.moderate.profitPerUnit), fmtCurrency(data.financial.scenarioReturns.aggressive.profitPerUnit)],
            ["Hold Period (months)", data.financial.scenarioReturns.conservative.holdPeriodMonths, data.financial.scenarioReturns.moderate.holdPeriodMonths, data.financial.scenarioReturns.aggressive.holdPeriodMonths],
            ["Annualised ROI", fmtPercent(data.financial.scenarioReturns.conservative.annualisedRoi), fmtPercent(data.financial.scenarioReturns.moderate.annualisedRoi), fmtPercent(data.financial.scenarioReturns.aggressive.annualisedRoi)],
          ]}
        />

        <Text style={baseStyles.h3}>Stress Test: GDV -10%</Text>
        <Table
          headers={["Metric", "Cons. (-10%)", "Mod. (-10%)", "Agg. (-10%)"]}
          columnWidths={[34, 22, 22, 22]}
          boldFirstColumn
          rows={[
            ["Stressed GDV", fmtCurrency(data.financial.stressTest.conservative.totalGDV), fmtCurrency(data.financial.stressTest.moderate.totalGDV), fmtCurrency(data.financial.stressTest.aggressive.totalGDV)],
            ["Net Proceeds", fmtCurrency(data.financial.stressTest.conservative.netProceeds), fmtCurrency(data.financial.stressTest.moderate.netProceeds), fmtCurrency(data.financial.stressTest.aggressive.netProceeds)],
            ["Gross Profit / (Loss)", fmtCurrency(data.financial.stressTest.conservative.grossProfit), fmtCurrency(data.financial.stressTest.moderate.grossProfit), fmtCurrency(data.financial.stressTest.aggressive.grossProfit)],
            ["ROI", fmtPercent(data.financial.stressTest.conservative.roi), fmtPercent(data.financial.stressTest.moderate.roi), fmtPercent(data.financial.stressTest.aggressive.roi)],
          ]}
        />

        <Text style={baseStyles.h3}>Maximum Acquisition Price to Achieve 20% ROI</Text>
        <Table
          headers={["GDV Scenario", "Max Purchase Price for 20% ROI"]}
          columnWidths={[55, 45]}
          boldFirstColumn
          rows={data.financial.maxPurchaseForTargetROI.map((m) => [
            `${m.scenario} (${fmtCurrency(m.gdv)})`,
            fmtCurrency(m.maxPurchasePrice),
          ])}
        />
        {data.financial.maxPurchaseNote ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 6 }}>
            {data.financial.maxPurchaseNote}
          </Text>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 7: Section 3 - Comparable Evidence
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>SECTION 3: COMPARABLE EVIDENCE</Text>
        {data.comparables.description ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 8 }}>
            {data.comparables.description}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Individual Flat Sales</Text>
        <Table
          headers={["Address", "Type", "Beds", "sqm", "Price", "\u00A3/sqm", "Date"]}
          columnWidths={[24, 10, 8, 8, 14, 14, 14]}
          rows={data.comparables.individualFlatSales.map((c) => [
            c.address,
            c.type,
            String(c.beds),
            String(c.sqm),
            fmtCurrency(c.price),
            fmtCurrency(c.pricePerSqm),
            c.date,
          ])}
        />
        {data.comparables.comparableNote ? (
          <Text style={{ fontSize: 8, color: "#71717a", marginTop: 4, fontStyle: "italic" }}>
            {data.comparables.comparableNote}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Statistical Baseline</Text>
        <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
          {data.comparables.housemetricBaseline.source} - {data.comparables.housemetricBaseline.period}, based on {data.comparables.housemetricBaseline.sampleSize} transactions:
        </Text>
        <Table
          headers={[
            "Lower Quartile (25th)",
            "Median (50th)",
            "Upper Quartile (75th)",
            ...(data.comparables.housemetricBaseline.subjectStreetAvg != null ? ["Subject Street Avg"] : []),
          ]}
          columnWidths={
            data.comparables.housemetricBaseline.subjectStreetAvg != null
              ? [25, 25, 25, 25]
              : [33, 34, 33]
          }
          rows={[
            [
              `${fmtCurrency(data.comparables.housemetricBaseline.lowerQuartile)} /sqm`,
              `${fmtCurrency(data.comparables.housemetricBaseline.median)} /sqm`,
              `${fmtCurrency(data.comparables.housemetricBaseline.upperQuartile)} /sqm`,
              ...(data.comparables.housemetricBaseline.subjectStreetAvg != null
                ? [`${fmtCurrency(data.comparables.housemetricBaseline.subjectStreetAvg)} /sqm`]
                : []),
            ],
          ]}
        />
        {data.comparables.housemetricBaseline.note ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 4 }}>
            {data.comparables.housemetricBaseline.note}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Block Discount Analysis</Text>
        <DetailTable
          rows={[
            ["Sum of individual flat values (as-is, moderate)", fmtCurrency(data.comparables.blockDiscount.sumAsIsModerate)],
            ["Sum of individual flat values (post-refurb, moderate)", fmtCurrency(data.comparables.blockDiscount.sumPostRefurbModerate)],
            ["Acquisition price", fmtCurrency(data.comparables.blockDiscount.acquisitionPrice)],
            ["Block discount achieved (vs as-is aggregate)", fmtPercent(data.comparables.blockDiscount.discountVsAsIs)],
            ["Block discount achieved (vs post-refurb GDV)", fmtPercent(data.comparables.blockDiscount.discountVsPostRefurb)],
            ["Typical block discount range", data.comparables.blockDiscount.typicalRange],
          ]}
        />
        {data.comparables.blockDiscount.note ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 4 }}>
            {data.comparables.blockDiscount.note}
          </Text>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 8: Section 4 - Risk Assessment
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>SECTION 4: RISK ASSESSMENT</Text>
        <Table
          headers={["Risk", "Likelihood", "Impact", "Mitigation"]}
          columnWidths={[20, 12, 12, 56]}
          boldFirstColumn
          rows={data.risks.matrix.map((r) => [
            r.risk,
            r.likelihood,
            r.impact,
            r.mitigation,
          ])}
        />

        <Text style={baseStyles.h3}>Red Flags Checklist</Text>
        <DetailTable
          rows={data.risks.redFlags.map((rf) => [rf.flag, rf.status])}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 9: Section 5 - Implementation Plan
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>SECTION 5: IMPLEMENTATION PLAN</Text>

        <Text style={baseStyles.h3}>Recommended Exit Strategy</Text>
        <View style={{ backgroundColor: "#f0fdf4", padding: 12, borderRadius: 4, borderLeftWidth: 4, borderLeftColor: "#16a34a", marginBottom: 12 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#16a34a", marginBottom: 4 }}>
            {data.implementation.exitStrategyLabel}
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b" }}>
            {data.implementation.exitStrategyRationale}
          </Text>
        </View>

        <Text style={baseStyles.h3}>Project Timeline</Text>
        <Table
          headers={["Week", "Activity", "Status"]}
          columnWidths={[15, 60, 25]}
          boldFirstColumn
          rows={data.implementation.timeline.map((t) => [t.week, t.activity, t.status])}
        />

        <Text style={baseStyles.h3}>Professional Team Required</Text>
        <NarrativeTable
          headers={["Role", "Notes"]}
          columnWidths={[30, 70]}
          rows={data.implementation.professionalTeam.map((p) => [p.role, p.notes])}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 10: Final Go/No-Go Decision
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <PageHeader title={hdr.title} subtitle={hdr.subtitle} />

        <Text style={baseStyles.h2}>FINAL GO/NO-GO DECISION</Text>
        <Table
          headers={["Minimum Requirement", "Target", "Status", "Confidence"]}
          columnWidths={[30, 20, 25, 25]}
          boldFirstColumn
          rows={data.goNoGo.criteria.map((c) => [
            c.requirement,
            c.target,
            c.status,
            c.confidence,
          ])}
        />

        <DecisionBox
          status={data.goNoGo.decision}
          conditions={data.goNoGo.conditions}
          analystNote={data.goNoGo.analystNote}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>
    </Document>
  );
}
