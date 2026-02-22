import React from "react";
import {
  Document,
  Page,
  View,
  Text,
} from "@react-pdf/renderer";
/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { InvestmentMemoData } from "@/lib/types";
import {
  baseStyles,
  Table,
  Checkbox,
  MetricCard,
  StatusBadge,
  fmtCurrency,
  fmtPercent,
} from "./components";

interface Props {
  data: InvestmentMemoData;
}

export function InvestmentMemoPDF({ data }: Props) {
  return (
    <Document>
      {/* Cover + Key Metrics */}
      <Page size="A4" style={baseStyles.page}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>
            FREEHOLD BLOCK TITLE SPLITTING
          </Text>
          <Text style={baseStyles.h1}>Investment Assessment Memo</Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            {data.propertyAddress}
          </Text>
          <Text style={{ fontSize: 9, color: "#71717a" }}>
            Analysis Date: {data.analysisDate}
          </Text>
        </View>

        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginRight: 8 }}>
            RECOMMENDATION:
          </Text>
          <StatusBadge status={data.recommendation} />
        </View>
        <Text style={{ fontSize: 9, marginBottom: 20, color: "#52525b" }}>
          {data.recommendationRationale}
        </Text>

        <Text style={baseStyles.h2}>KEY METRICS DASHBOARD</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <MetricCard
            label="Purchase Price"
            value={fmtCurrency(data.keyMetrics.purchasePrice)}
          />
          <MetricCard
            label="Split GDV"
            value={fmtCurrency(data.keyMetrics.splitGDV)}
          />
          <MetricCard
            label="Lender LTV (75%)"
            value={fmtCurrency(data.keyMetrics.lenderLTV75)}
          />
          <MetricCard
            label="Gross Profit"
            value={fmtCurrency(data.keyMetrics.grossProfit)}
            color="#16a34a"
          />
          <MetricCard
            label="ROI"
            value={fmtPercent(data.keyMetrics.roi)}
          />
        </View>

        {/* Section 1: Screening Summary */}
        <Text style={baseStyles.h2}>SECTION 1: SCREENING SUMMARY</Text>
        <Text style={baseStyles.h3}>Property Overview</Text>
        <Table
          headers={["Field", "Details"]}
          columnWidths={[35, 65]}
          rows={[
            ["Address", data.screening.overview.address],
            ["Listing Price", fmtCurrency(data.screening.overview.listingPrice)],
            ["Number of Flats", String(data.screening.overview.numberOfFlats)],
            ["Total GIA", `${data.screening.overview.totalGiaSqm} sqm (${data.screening.overview.totalGiaSqft} sq ft)`],
            ["Building Type", data.screening.overview.buildingType],
            ["Construction", data.screening.overview.construction],
            ["Listed Status", data.screening.overview.listedStatus],
            ["Tenure", data.screening.overview.tenure],
            ["Current Condition", data.screening.overview.currentCondition],
            ["Vacancy Status", data.screening.overview.vacancyStatus],
            ["EPC Ratings", data.screening.overview.epcRatings],
            ["Location Notes", data.screening.overview.locationNotes],
          ]}
        />

        <Text style={baseStyles.h3}>Mandatory Screening Criteria</Text>
        {data.screening.mandatoryCriteria.map((c, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
            <Checkbox checked={c.status === "PASS"} label="" />
            <Text style={{ fontSize: 9, flex: 1 }}>
              {c.criterion} ({c.requirement}) —{" "}
              <Text style={{ fontFamily: "Helvetica-Bold", color: c.status === "PASS" ? "#16a34a" : "#dc2626" }}>
                {c.status}
              </Text>
            </Text>
          </View>
        ))}

        <Text style={baseStyles.h3}>Unit Schedule</Text>
        <Table
          headers={["Flat", "Floor", "Beds", "GIA (sqm)", "GIA (sqft)", "EPC", ">=30?"]}
          columnWidths={[16, 14, 10, 14, 14, 10, 12]}
          rows={data.screening.unitSchedule.map((u) => [
            u.flat,
            u.floor,
            String(u.beds),
            String(u.giaSqm),
            String(u.giaSqft),
            u.epc,
            u.meetsMinSize ? "PASS" : "FAIL",
          ])}
        />
      </Page>

      {/* Section 2: Financial Analysis */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION 2: FINANCIAL ANALYSIS</Text>

        <Text style={baseStyles.h3}>Acquisition & Project Costs</Text>
        <Table
          headers={["Cost Item", "Amount"]}
          columnWidths={[65, 35]}
          rows={[
            ...data.financial.acquisitionCosts.map((c) => [c.item, fmtCurrency(c.amount)]),
            ["Total Acquisition", fmtCurrency(data.financial.totalAcquisition)],
          ]}
        />

        <Text style={baseStyles.h3}>Title Splitting Costs</Text>
        <Table
          headers={["Cost Item", "Amount"]}
          columnWidths={[65, 35]}
          rows={[
            ...data.financial.splittingCosts.map((c) => [c.item, fmtCurrency(c.amount)]),
            ["Total Splitting", fmtCurrency(data.financial.totalSplitting)],
          ]}
        />

        <Text style={baseStyles.h3}>Refurbishment Budget</Text>
        <Table
          headers={["Item", "Amount"]}
          columnWidths={[65, 35]}
          rows={[
            ...data.financial.refurbishmentCosts.map((c) => [c.item, fmtCurrency(c.amount)]),
            ["Total Refurbishment", fmtCurrency(data.financial.totalRefurbishment)],
          ]}
        />

        <View style={{ backgroundColor: "#f4f4f5", padding: 12, borderRadius: 4, marginTop: 12 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginBottom: 6 }}>
            Total Project Cost: {fmtCurrency(data.financial.totalProjectCost)}
          </Text>
        </View>

        <Text style={baseStyles.h3}>Exit Valuations - Individual Sales</Text>
        <Table
          headers={["Flat", "sqm", "Beds", "£/sqm", "Value", "Costs", "Net"]}
          columnWidths={[16, 10, 10, 14, 16, 14, 16]}
          rows={data.financial.exitValuations.map((e) => [
            e.flat,
            String(e.sqm),
            String(e.beds),
            fmtCurrency(e.pricePerSqm),
            fmtCurrency(e.value),
            fmtCurrency(e.salesCosts),
            fmtCurrency(e.netValue),
          ])}
        />

        <Text style={baseStyles.h3}>Returns Analysis</Text>
        <Table
          headers={["Metric", "Base Case", "Stressed (-10%)"]}
          columnWidths={[40, 30, 30]}
          rows={[
            ["Total Investment", fmtCurrency(data.financial.returns.totalInvestment), fmtCurrency(data.financial.stressedReturns.totalInvestment)],
            ["Gross Sales Value", fmtCurrency(data.financial.returns.grossSalesValue), fmtCurrency(data.financial.stressedReturns.grossSalesValue)],
            ["Sales Costs (2.5%)", fmtCurrency(data.financial.returns.salesCosts), fmtCurrency(data.financial.stressedReturns.salesCosts)],
            ["Net Proceeds", fmtCurrency(data.financial.returns.netProceeds), fmtCurrency(data.financial.stressedReturns.netProceeds)],
            ["Gross Profit", fmtCurrency(data.financial.returns.grossProfit), fmtCurrency(data.financial.stressedReturns.grossProfit)],
            ["Profit Margin", fmtPercent(data.financial.returns.profitMargin), fmtPercent(data.financial.stressedReturns.profitMargin)],
            ["ROI", fmtPercent(data.financial.returns.roi), fmtPercent(data.financial.stressedReturns.roi)],
          ]}
        />
      </Page>

      {/* Section 3-5 + Go/No-Go */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION 3: COMPARABLE EVIDENCE</Text>
        <Table
          headers={["Address", "Type", "Beds", "sqm", "Price", "£/sqm", "Date", "Source"]}
          columnWidths={[20, 10, 8, 8, 14, 12, 14, 14]}
          rows={data.comparables.individualFlatSales.map((c) => [
            c.address,
            c.type,
            String(c.beds),
            String(c.sqm),
            fmtCurrency(c.price),
            fmtCurrency(c.pricePerSqm),
            c.date,
            c.source,
          ])}
        />

        <Text style={baseStyles.h3}>Block Discount Analysis</Text>
        <Table
          headers={["Item", "Value"]}
          columnWidths={[55, 45]}
          rows={[
            ["Sum of Individual Flat Values", fmtCurrency(data.comparables.blockDiscount.sumOfIndividualValues)],
            ["Block Discount Applied", data.comparables.blockDiscount.typicalBlockDiscount],
            ["Implied Whole Block Value", fmtCurrency(data.comparables.blockDiscount.impliedWholeBlockValue)],
            ["Acquisition Price (incl. costs)", fmtCurrency(data.comparables.blockDiscount.acquisitionPriceInclCosts)],
            ["Discount Achieved", fmtPercent(data.comparables.blockDiscount.discountAchieved)],
          ]}
        />

        <Text style={baseStyles.h2}>SECTION 4: RISK ASSESSMENT</Text>
        <Table
          headers={["Risk", "Likelihood", "Impact", "Mitigation"]}
          columnWidths={[25, 12, 12, 51]}
          rows={data.risks.matrix.map((r) => [
            r.risk,
            r.likelihood,
            r.impact,
            r.mitigation,
          ])}
        />

        <Text style={baseStyles.h3}>Red Flags Checklist</Text>
        {data.risks.redFlags.map((rf, i) => (
          <Checkbox key={i} checked={rf.triggered} label={`${rf.flag}${rf.triggered ? " (TRIGGERED)" : ""}`} />
        ))}

        <Text style={baseStyles.h2}>SECTION 5: IMPLEMENTATION PLAN</Text>
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
            Exit Strategy: {data.implementation.exitStrategy.replace(/_/g, " ")}
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
            {data.implementation.exitStrategyRationale}
          </Text>
        </View>

        <Table
          headers={["Week", "Activity"]}
          columnWidths={[20, 80]}
          rows={data.implementation.timeline.map((t) => [t.week, t.activity])}
        />

        {/* Go/No-Go */}
        <Text style={baseStyles.h2}>FINAL GO/NO-GO DECISION</Text>
        <Table
          headers={["Requirement", "Target", "Status"]}
          columnWidths={[40, 30, 30]}
          rows={data.goNoGo.criteria.map((c) => [
            c.requirement,
            c.target,
            c.status,
          ])}
        />
        <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", marginRight: 8 }}>
            DECISION:
          </Text>
          <StatusBadge status={data.goNoGo.decision} />
        </View>
        {data.goNoGo.conditions ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 6 }}>
            {data.goNoGo.conditions}
          </Text>
        ) : (
          <View />
        )}

        <View style={{ marginTop: 24, borderTopWidth: 0.5, borderTopColor: "#e4e4e7", paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: "#a1a1aa" }}>
            Generated by Deal Analysis Tool | {data.analysisDate}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
