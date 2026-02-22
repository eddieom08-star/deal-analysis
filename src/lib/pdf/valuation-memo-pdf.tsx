import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import type { ValuationMemoData } from "@/lib/types";
import {
  baseStyles,
  Table,
  MetricCard,
  fmtCurrency,
  fmtPercent,
} from "./components";

interface Props {
  data: ValuationMemoData;
}

export function ValuationMemoPDF({ data }: Props) {
  const hv = data.headlineValuation;
  const vl = data.valuationLogic;
  const ce = data.comparableEvidence;
  const pl = data.propertyLayout;
  const da = data.demisedAreas;
  const pn = data.processNotes;

  return (
    <Document>
      {/* Page 1: Cover + Section A + B */}
      <Page size="A4" style={baseStyles.page}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 10, color: "#71717a", marginBottom: 4 }}>
            VALUATION MEMORANDUM
          </Text>
          <Text style={baseStyles.h1}>Title Split Valuation</Text>
          <Text style={{ fontSize: 12, marginBottom: 4 }}>
            {data.propertyAddress}
          </Text>
          <Text style={{ fontSize: 9, color: "#71717a" }}>
            Analysis Date: {data.analysisDate}
          </Text>
        </View>

        {/* Section A: Headline Valuation */}
        <Text style={baseStyles.h2}>A. HEADLINE VALUATION & SUMMARY</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <MetricCard
            label="As-Is Freehold Value"
            value={fmtCurrency(hv.asIsFreehold)}
          />
          <MetricCard
            label="Aggregate Split Value"
            value={fmtCurrency(hv.aggregateSplitValue)}
            color="#16a34a"
          />
          <MetricCard
            label="Uplift"
            value={`${fmtCurrency(hv.uplift)} (${fmtPercent(hv.upliftPercent)})`}
            color="#16a34a"
          />
        </View>

        <Table
          headers={["Valuation Basis", "Value"]}
          columnWidths={[55, 45]}
          rows={[
            ["Market Value (As Is)", fmtCurrency(hv.asIsFreehold)],
            ["Aggregate Value (Individual Leasehold Sales)", fmtCurrency(hv.aggregateSplitValue)],
            ["Uplift from Title Split", `${fmtCurrency(hv.uplift)} (${fmtPercent(hv.upliftPercent)})`],
            ...(hv.day180Value ? [["180-Day Value", fmtCurrency(hv.day180Value)]] : []),
            ...(hv.day90Value ? [["90-Day Value", fmtCurrency(hv.day90Value)]] : []),
          ]}
        />

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 9, color: "#52525b" }}>
            Basis: {hv.valuationBasis}
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
            Special Assumption: {hv.specialAssumption}
          </Text>
        </View>

        {/* Section B: Valuation Logic */}
        <Text style={baseStyles.h2}>B. VALUATION LOGIC / CALCULATIONS</Text>

        <Table
          headers={["Flat", "sqm", "sqft", "£/sqft", "Value", "Basis", "Premiums"]}
          columnWidths={[12, 10, 10, 12, 14, 24, 18]}
          rows={vl.perFlatValuations.map((f) => [
            f.flat,
            String(f.sqm),
            String(f.sqft),
            fmtCurrency(f.pricePerSqft),
            fmtCurrency(f.estimatedValue),
            f.basis,
            f.premiums || "None",
          ])}
        />

        <View style={{ backgroundColor: "#f4f4f5", padding: 10, borderRadius: 4, marginTop: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold" }}>
            Total Aggregate Value: {fmtCurrency(vl.totalAggregateValue)}
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 4 }}>
            Area Average: {fmtCurrency(vl.areaAveragePricePerSqft)}/sqft
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
            {vl.proposedPricePerSqftVsAverage}
          </Text>
        </View>
      </Page>

      {/* Page 2: Sections C-F */}
      <Page size="A4" style={baseStyles.page}>
        {/* Section C: Comparable Evidence */}
        <Text style={baseStyles.h2}>C. LOCAL COMPARABLE EVIDENCE</Text>

        <Table
          headers={["Address", "Type", "Beds", "Price", "Date", "£/sqft", "Dist.", "Source"]}
          columnWidths={[20, 10, 8, 14, 12, 10, 10, 12]}
          rows={ce.comparables.map((c) => [
            c.address,
            c.propertyType,
            String(c.beds),
            fmtCurrency(c.salePrice),
            c.saleDate,
            fmtCurrency(c.pricePerSqft),
            c.distanceApprox,
            c.source,
          ])}
        />

        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 9 }}>
            Average £/sqft: {fmtCurrency(ce.averagePricePerSqft)} | Median: {fmtCurrency(ce.medianPricePerSqft)}
          </Text>
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
            {ce.proposedVsAverage}
          </Text>
        </View>

        {ce.comparables.some((c) => c.specialNotes) ? (
          <View style={{ marginTop: 8 }}>
            <Text style={baseStyles.h3}>Notes on Comparables</Text>
            {ce.comparables
              .filter((c) => c.specialNotes)
              .map((c, i) => (
                <Text key={i} style={{ fontSize: 8, color: "#52525b", marginBottom: 2 }}>
                  {c.address}: {c.specialNotes}
                </Text>
              ))}
          </View>
        ) : (
          <View />
        )}

        {/* Section D: Property Layout */}
        <Text style={baseStyles.h2}>D. PROPERTY LAYOUT / PLANS</Text>
        <Text style={{ fontSize: 9 }}>
          Existing Plans: {pl.hasExistingPlans ? "Available" : "Not available from listing"}
        </Text>
        {pl.planSource ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginTop: 2 }}>
            Source: {pl.planSource}
          </Text>
        ) : (
          <View />
        )}
        <Text style={{ fontSize: 9, marginTop: 6 }}>
          {pl.proposedDemiseNotes}
        </Text>

        {/* Section E: Demised Areas */}
        <Text style={baseStyles.h2}>E. DEMISED AREAS THAT DRIVE VALUE</Text>

        {da.parkingSpaces.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Parking Spaces</Text>
            <Table
              headers={["Space", "Allocated To", "Est. Value Add"]}
              columnWidths={[30, 40, 30]}
              rows={da.parkingSpaces.map((p) => [
                p.space,
                p.allocatedTo,
                fmtCurrency(p.estimatedValueAdd),
              ])}
            />
          </View>
        ) : (
          <View />
        )}

        {da.gardens.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Gardens / Patios</Text>
            <Table
              headers={["Area", "Allocated To", "Est. Value Add"]}
              columnWidths={[30, 40, 30]}
              rows={da.gardens.map((g) => [
                g.area,
                g.allocatedTo,
                fmtCurrency(g.estimatedValueAdd),
              ])}
            />
          </View>
        ) : (
          <View />
        )}

        <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 8 }}>
          Total Value from Demised Areas: {fmtCurrency(da.totalValueFromDemisedAreas)}
        </Text>

        {/* Section F: Process Notes */}
        <Text style={baseStyles.h2}>F. PRACTICAL / PROCESS NOTES</Text>
        <View style={{ gap: 6 }}>
          <View>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Special Assumption</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>{pn.specialAssumption}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Exit Strategy</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>{pn.exitStrategy}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Reinstatement Cost</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>{pn.reinstatementCostNote}</Text>
          </View>
          <View>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Insurance</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>{pn.insuranceNote}</Text>
          </View>
          {pn.additionalNotes ? (
            <View>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>Additional Notes</Text>
              <Text style={{ fontSize: 9, color: "#52525b" }}>{pn.additionalNotes}</Text>
            </View>
          ) : (
            <View />
          )}
        </View>

        <View style={{ marginTop: 24, borderTopWidth: 0.5, borderTopColor: "#e4e4e7", paddingTop: 8 }}>
          <Text style={{ fontSize: 8, color: "#a1a1aa" }}>
            Generated by Deal Analysis Tool | {data.analysisDate} | CRITICAL: This is an automated analysis. Professional RICS valuation required before transacting.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
