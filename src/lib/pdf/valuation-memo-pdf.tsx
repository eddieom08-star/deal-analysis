import React from "react";
import { Document, Page, View, Text } from "@react-pdf/renderer";
import type { ValuationMemoData } from "@/lib/types";
import {
  baseStyles,
  Table,
  DetailTable,
  NarrativeTable,
  MetricCard,
  PageHeader,
  PageFooter,
  SummaryBox,
  BulletList,
  fmtCurrency,
  fmtPercent,
} from "./components";

interface Props {
  data: ValuationMemoData;
}

export function ValuationMemoPDF({ data }: Props) {
  const hdr = { title: "VALUATION MEMORANDUM", subtitle: data.propertyAddress };
  const ftr = { address: data.propertyAddress, date: data.analysisDate };
  const hv = data.headlineValuation;
  const vl = data.valuationLogic;
  const ce = data.comparableEvidence;
  const pl = data.propertyLayout;
  const da = data.demisedAreas;
  const pn = data.processNotes;

  return (
    <Document>
      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 1: Cover
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 8 }}>
            VALUATION MEMORANDUM
          </Text>
          <Text style={{ fontSize: 14, color: "#71717a", textAlign: "center", marginBottom: 40 }}>
            Title Splitting Opportunity
          </Text>

          {data.propertyName ? (
            <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 4 }}>
              {data.propertyName}
            </Text>
          ) : (
            <View />
          )}
          <Text style={{ fontSize: 13, textAlign: "center", fontStyle: "italic", marginBottom: 4 }}>
            {data.propertyAddress}
          </Text>
          {data.propertySubtitle ? (
            <Text style={{ fontSize: 11, color: "#71717a", textAlign: "center", marginBottom: 40 }}>
              {data.propertySubtitle}
            </Text>
          ) : (
            <View />
          )}

          <SummaryBox
            title="PURPOSE OF VALUATION"
            rows={[
              ["1.", "Current freehold block value (Market Value As Is)"],
              ["2.", "Aggregate value on special assumption of title split to 999-year long leases"],
            ]}
          />

          <Text style={{ fontSize: 11, fontStyle: "italic", color: "#71717a", marginTop: 20 }}>
            Prepared: {data.analysisDate}
          </Text>
        </View>
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 2: Section A - Headline Valuation & Summary
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION A: HEADLINE VALUATION & SUMMARY</Text>

        <SummaryBox
          title="VALUATION SUMMARY"
          highlightLast
          rows={[
            ["Market Value As Is (Freehold Block)", fmtCurrency(hv.asIsFreehold)],
            [`Aggregate Value (${pl.unitScheduleVerified.length > 0 ? pl.unitScheduleVerified.length : "N"} x Long Leasehold Units)`, fmtCurrency(hv.aggregateSplitValue)],
            ["VALUE UPLIFT FROM TITLE SPLIT", `+${fmtCurrency(hv.uplift)} (+${fmtPercent(hv.upliftPercent)})`],
          ]}
        />

        <Text style={baseStyles.h3}>Valuation Basis</Text>
        <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 6 }}>
          <Text style={{ fontFamily: "Helvetica-Bold" }}>Market Value As Is: </Text>
          {hv.valuationBasis}
        </Text>
        {hv.aggregateValueBasis ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 12 }}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Aggregate Value (Special Assumption): </Text>
            {hv.aggregateValueBasis}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Valuation Date & Market Context</Text>
        <DetailTable
          rows={[
            ["Valuation Date", hv.valuationDateContext.valuationDate],
            ...(hv.valuationDateContext.day90Value ? [["90-Day Value (As Is)", hv.valuationDateContext.day90Value] as [string, string]] : []),
            ...(hv.valuationDateContext.day180Value ? [["180-Day Value (As Is)", hv.valuationDateContext.day180Value] as [string, string]] : []),
            ["Market Evidence Period", hv.valuationDateContext.marketEvidencePeriod],
            ["Transaction Sample Size", hv.valuationDateContext.transactionSampleSize],
          ]}
        />

        <Text style={baseStyles.h3}>Property Summary</Text>
        <DetailTable
          rows={[
            ["Address", hv.propertySummary.address],
            ["Property Type", hv.propertySummary.propertyType],
            ["Tenure", hv.propertySummary.tenure],
            ["Number of Units", hv.propertySummary.numberOfUnits],
            ["Total Floor Area", hv.propertySummary.totalFloorArea],
            ["Construction", hv.propertySummary.construction],
            ["Heating", hv.propertySummary.heating],
            ["EPC Ratings", hv.propertySummary.epcRatings],
            ["Condition", hv.propertySummary.condition],
            ["Parking", hv.propertySummary.parking],
            ["Gardens", hv.propertySummary.gardens],
          ]}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 3: Section B - Valuation Logic & Calculations
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION B: VALUATION LOGIC & CALCULATIONS</Text>

        {vl.introText ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 10 }}>
            {vl.introText}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>{vl.marketRateSummary.source} Market Rate Summary</Text>
        <Text style={{ fontSize: 8, fontStyle: "italic", color: "#71717a", marginBottom: 4 }}>
          {vl.marketRateSummary.sampleDescription}
        </Text>
        <Table
          headers={["Market Position", "\u00A3/sqm", "\u00A3/sq ft"]}
          columnWidths={[40, 30, 30]}
          boldFirstColumn
          boldLastRow
          rows={[
            ["Lower Quartile (25th percentile)", fmtCurrency(vl.marketRateSummary.lowerQuartile.priceSqm), fmtCurrency(vl.marketRateSummary.lowerQuartile.priceSqft)],
            ["Median (50th percentile)", fmtCurrency(vl.marketRateSummary.median.priceSqm), fmtCurrency(vl.marketRateSummary.median.priceSqft)],
            ["Upper Quartile (75th percentile)", fmtCurrency(vl.marketRateSummary.upperQuartile.priceSqm), fmtCurrency(vl.marketRateSummary.upperQuartile.priceSqft)],
            ["OUR ADOPTED AVERAGE", fmtCurrency(vl.marketRateSummary.adoptedAverage.priceSqm), fmtCurrency(vl.marketRateSummary.adoptedAverage.priceSqft)],
            ["Our Rate vs Median", vl.marketRateSummary.adoptedVsMedian, vl.marketRateSummary.adoptedVsMedianLabel],
          ]}
        />

        {vl.marketRateSummary.discountReasons.length > 0 ? (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
              Our adopted average reflects a discount to median, accounting for:
            </Text>
            <BulletList items={vl.marketRateSummary.discountReasons} />
          </View>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Individual Unit Valuations</Text>
        <Table
          headers={["Unit", "Floor", "Beds", "GIA (sqm)", "Value", "\u00A3/sqm"]}
          columnWidths={[14, 14, 10, 16, 20, 16]}
          boldFirstColumn
          boldLastRow
          rows={[
            ...vl.perFlatValuations.map((f) => [
              f.flat,
              f.floor,
              String(f.beds),
              String(f.giaSqm),
              fmtCurrency(f.estimatedValue),
              fmtCurrency(f.priceSqm),
            ]),
            [
              "TOTAL",
              "",
              String(vl.perFlatValuations.reduce((s, f) => s + f.beds, 0)),
              String(vl.perFlatValuations.reduce((s, f) => s + f.giaSqm, 0)),
              fmtCurrency(vl.totalAggregateValue),
              `${fmtCurrency(vl.marketRateSummary.adoptedAverage.priceSqm)} avg`,
            ],
          ]}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 4: Unit-by-Unit Rationale
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h3}>Unit-by-Unit Rationale</Text>
        <NarrativeTable
          headers={["Unit", "Value", "Rationale & Evidence"]}
          columnWidths={[10, 12, 78]}
          rows={vl.unitRationale.map((u) => [
            u.flat,
            fmtCurrency(u.value),
            u.rationale,
          ])}
        />

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 5: Section C - Local Comparable Evidence
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION C: LOCAL COMPARABLE EVIDENCE</Text>

        {ce.introText ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 8 }}>
            {ce.introText}
          </Text>
        ) : (
          <View />
        )}

        <Text style={baseStyles.h3}>Primary Comparables (Leasehold Flat Sales)</Text>
        <Table
          headers={["Address", "Beds", "sqm", "Price", "\u00A3/sqm", "Date", "Cond."]}
          columnWidths={[24, 8, 8, 14, 14, 14, 14]}
          boldFirstColumn
          rows={ce.comparables.map((c) => [
            c.address,
            String(c.beds),
            String(c.sqm),
            fmtCurrency(c.price),
            fmtCurrency(c.pricePerSqm),
            c.date,
            c.condition,
          ])}
        />

        {ce.comparableAnalysis.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Comparable Analysis</Text>
            <NarrativeTable
              headers={["Address", "Analysis"]}
              columnWidths={[25, 75]}
              rows={ce.comparableAnalysis.map((ca) => [ca.address, ca.narrative])}
            />
          </View>
        ) : (
          <View />
        )}

        {ce.streetLevelData.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Street-Level Data</Text>
            <Table
              headers={["Street", "Average \u00A3/sqm", "Sample Size"]}
              columnWidths={[40, 30, 30]}
              boldFirstColumn
              boldLastRow
              rows={[
                ...ce.streetLevelData.map((s) => [
                  s.street,
                  fmtCurrency(s.averagePriceSqm),
                  s.sampleSize,
                ]),
                ["Our Adopted Average", fmtCurrency(ce.adoptedAverageForComparison), "-"],
              ]}
            />
          </View>
        ) : (
          <View />
        )}

        {ce.conclusion ? (
          <View style={{ backgroundColor: "#dbeafe", padding: 12, borderRadius: 4, borderLeftWidth: 4, borderLeftColor: "#2563eb", marginTop: 12 }}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1e3a5f", marginBottom: 4 }}>
              COMPARABLE EVIDENCE CONCLUSION
            </Text>
            <Text style={{ fontSize: 9, color: "#1e3a5f" }}>
              {ce.conclusion}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 6: Section D - Property Layout & Plans
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION D: PROPERTY LAYOUT & PLANS</Text>

        {pl.description ? (
          <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 10 }}>
            {pl.description}
          </Text>
        ) : (
          <View />
        )}

        {pl.unitScheduleVerified.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Unit Schedule (EPC Verified Floor Areas)</Text>
            <Table
              headers={["Flat", "Floor", "Beds", "GIA (sqm)", "GIA (sq ft)", "EPC Rating"]}
              columnWidths={[14, 14, 10, 18, 18, 20]}
              boldFirstColumn
              boldLastRow
              rows={[
                ...pl.unitScheduleVerified.map((u) => [
                  u.flat,
                  u.floor,
                  String(u.beds),
                  String(u.giaSqm),
                  String(u.giaSqft),
                  u.epcRating,
                ]),
                [
                  "TOTAL",
                  "",
                  String(pl.unitScheduleVerified.reduce((s, u) => s + u.beds, 0)),
                  String(pl.unitScheduleVerified.reduce((s, u) => s + u.giaSqm, 0)),
                  String(pl.unitScheduleVerified.reduce((s, u) => s + u.giaSqft, 0)),
                  `All >=30 sqm`,
                ],
              ]}
            />
          </View>
        ) : (
          <View />
        )}

        {pl.minimumSizeCompliance ? (
          <View style={{ marginTop: 8 }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
              Minimum Size Compliance
            </Text>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
              {pl.minimumSizeCompliance}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {pl.leasePlanRequirements.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={baseStyles.h3}>Lease Plan Requirements</Text>
            <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
              For Land Registry registration of individual titles, RICS-compliant lease plans will be required showing:
            </Text>
            <BulletList items={pl.leasePlanRequirements} />
          </View>
        ) : (
          <View />
        )}

        {pl.planningPortalNote ? (
          <View style={{ marginTop: 12 }}>
            <Text style={baseStyles.h3}>Planning Portal Check</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>
              {pl.planningPortalNote}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 7: Section E - Demised Areas & Value Drivers
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION E: DEMISED AREAS & VALUE DRIVERS</Text>

        <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 10 }}>
          The following areas are proposed to be demised with each leasehold flat to maximise individual unit values:
        </Text>

        {da.parkingSpaces.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Parking Allocation</Text>
            <Table
              headers={["Parking Space", "Demised To", "Value Impact"]}
              columnWidths={[25, 40, 35]}
              boldFirstColumn
              rows={da.parkingSpaces.map((p) => [p.space, p.allocatedTo, p.estimatedValueAdd])}
            />
            {da.parkingNote ? (
              <Text style={{ fontSize: 8, fontStyle: "italic", color: "#71717a", marginTop: 4 }}>
                {da.parkingNote}
              </Text>
            ) : (
              <View />
            )}
          </View>
        ) : (
          <View />
        )}

        {da.gardens.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Garden Allocation</Text>
            <Table
              headers={["Garden Area", "Proposed Allocation", "Value Impact"]}
              columnWidths={[25, 40, 35]}
              boldFirstColumn
              rows={da.gardens.map((g) => [g.area, g.allocatedTo, g.estimatedValueAdd])}
            />
            {da.gardenRecommendation ? (
              <Text style={{ fontSize: 9, color: "#52525b", marginTop: 4 }}>
                {da.gardenRecommendation}
              </Text>
            ) : (
              <View />
            )}
          </View>
        ) : (
          <View />
        )}

        {da.commonParts.length > 0 ? (
          <View style={{ marginTop: 12 }}>
            <Text style={baseStyles.h3}>Common Parts</Text>
            <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
              The following areas are proposed to remain as common parts under the freehold company{"'"}s management:
            </Text>
            <BulletList items={da.commonParts} />
          </View>
        ) : (
          <View />
        )}

        {da.freeholdCompanyStructure ? (
          <View style={{ marginTop: 12 }}>
            <Text style={baseStyles.h3}>Freehold Company Structure</Text>
            <Text style={{ fontSize: 9, color: "#52525b" }}>
              {da.freeholdCompanyStructure}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 8: Section F - Practical & Process Notes
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <Text style={baseStyles.h2}>SECTION F: PRACTICAL & PROCESS NOTES</Text>

        {pn.valuationAssumptions.length > 0 ? (
          <View>
            <Text style={baseStyles.h3}>Valuation Assumptions</Text>
            <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
              This valuation has been prepared on the following assumptions:
            </Text>
            <BulletList items={pn.valuationAssumptions} />
          </View>
        ) : (
          <View />
        )}

        <View style={{ marginTop: 10 }}>
          <Text style={baseStyles.h3}>Special Assumption</Text>
          <Text style={{ fontSize: 9, color: "#52525b" }}>
            {pn.specialAssumption}
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <Text style={baseStyles.h3}>Reinstatement Cost</Text>
          <Text style={{ fontSize: 9, color: "#52525b" }}>
            {pn.reinstatementCostNote}
          </Text>
        </View>

        {pn.bridgeFinanceRequirements.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={baseStyles.h3}>Bridge Finance Requirements</Text>
            <Text style={{ fontSize: 9, color: "#52525b", marginBottom: 4 }}>
              For bridge lender purposes:
            </Text>
            <BulletList items={pn.bridgeFinanceRequirements} />
          </View>
        ) : (
          <View />
        )}

        {pn.nextSteps.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={baseStyles.h3}>Next Steps</Text>
            <View style={{ borderWidth: 0.5, borderColor: "#e4e4e7", borderRadius: 4, overflow: "hidden" }}>
              {pn.nextSteps.map((ns, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderBottomWidth: i < pn.nextSteps.length - 1 ? 0.5 : 0,
                    borderBottomColor: "#e4e4e7",
                    backgroundColor: i % 2 === 1 ? "#f4f4f5" : "#ffffff",
                  }}
                >
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", width: 30 }}>
                    {ns.step}.
                  </Text>
                  <Text style={{ fontSize: 9, flex: 1 }}>
                    {ns.description}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View />
        )}

        <PageFooter address={ftr.address} date={ftr.date} />
      </Page>

      {/* ═══════════════════════════════════════════════════════════════════════
          PAGE 9: Valuation Summary (Repeat) + Disclaimer
          ═══════════════════════════════════════════════════════════════════════ */}
      <Page size="A4" style={baseStyles.page}>
        <SummaryBox
          title="VALUATION SUMMARY"
          highlightLast
          rows={[
            ["Market Value As Is:", fmtCurrency(pn.valuationSummaryRepeat.asIsValue)],
            ["Aggregate Value (Title Split):", fmtCurrency(pn.valuationSummaryRepeat.aggregateValue)],
            ["Uplift:", `+${fmtCurrency(pn.valuationSummaryRepeat.uplift)} (+${fmtPercent(pn.valuationSummaryRepeat.upliftPercent)})`],
          ]}
        />

        {pn.valuationSummaryRepeat.conservativeNote ? (
          <View style={{ backgroundColor: "#dbeafe", padding: 12, borderRadius: 4, marginTop: 8 }}>
            <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", textAlign: "center" }}>
              Uplift: +{fmtCurrency(pn.valuationSummaryRepeat.uplift)} (+{fmtPercent(pn.valuationSummaryRepeat.upliftPercent)})
            </Text>
            <Text style={{ fontSize: 9, fontStyle: "italic", textAlign: "center", marginTop: 4, color: "#52525b" }}>
              {pn.valuationSummaryRepeat.conservativeNote}
            </Text>
          </View>
        ) : (
          <View />
        )}

        <View style={{ marginTop: 30, alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontStyle: "italic", color: "#71717a" }}>
            Document prepared: {data.analysisDate}
          </Text>
          {pn.dataSources ? (
            <Text style={{ fontSize: 8, fontStyle: "italic", color: "#a1a1aa", marginTop: 4 }}>
              Data sources: {pn.dataSources}
            </Text>
          ) : (
            <View />
          )}
          <Text style={{ fontSize: 8, fontStyle: "italic", color: "#a1a1aa", marginTop: 4 }}>
            {pn.disclaimer}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
