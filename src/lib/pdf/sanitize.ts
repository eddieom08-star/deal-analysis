import type { InvestmentMemoData, ValuationMemoData, ScenarioReturn } from "@/lib/types";

// ─── Primitive Safeguards ────────────────────────────────────────────────────

function str(v: unknown, fallback = "N/A"): string {
  if (typeof v === "string" && v.length > 0) return v;
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const parsed = parseFloat(v);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return fallback;
}

function bool(v: unknown, fallback = false): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function arr<T>(v: unknown, mapFn: (item: unknown) => T): T[] {
  if (!Array.isArray(v)) return [];
  return v.map(mapFn);
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((item) => str(item, ""));
}

function obj(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function numOrNull(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  return null;
}

function strOrNull(v: unknown): string | null {
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function boolOrStr(v: unknown): boolean | string {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v;
  return false;
}

// ─── Shared sanitizers ──────────────────────────────────────────────────────

function sanitizeScenarioReturn(v: unknown): ScenarioReturn {
  const r = obj(v);
  return {
    totalGDV: num(r.totalGDV),
    totalInvestment: num(r.totalInvestment),
    salesCosts: num(r.salesCosts),
    netProceeds: num(r.netProceeds),
    grossProfit: num(r.grossProfit),
    profitMargin: num(r.profitMargin),
    roi: num(r.roi),
    profitPerUnit: num(r.profitPerUnit),
    holdPeriodMonths: str(r.holdPeriodMonths, "9-12"),
    annualisedRoi: num(r.annualisedRoi),
  };
}

// ─── Investment Memo Sanitizer ──────────────────────────────────────────────

export function sanitizeInvestmentMemo(raw: unknown): InvestmentMemoData {
  const d = obj(raw);
  const warnings: string[] = [];
  function warn(path: string) { warnings.push(path); }

  const propertyAddress = str(d.propertyAddress, "Unknown Address");
  if (!d.propertyAddress) warn("propertyAddress");
  const analysisDate = str(d.analysisDate, new Date().toISOString().slice(0, 10));

  // keyMetrics
  const km = obj(d.keyMetrics);
  if (!d.keyMetrics) warn("keyMetrics");
  const keyMetrics = {
    purchasePrice: num(km.purchasePrice),
    aggregateValue: num(km.aggregateValue),
    postRefurbGDV: num(km.postRefurbGDV),
    lenderLTV75: num(km.lenderLTV75),
    grossProfit: num(km.grossProfit),
    roi: num(km.roi),
  };

  const criticalNote = str(d.criticalNote, "");

  // recommendation
  const rawRec = str(d.recommendation, "REJECT");
  const recommendation = (
    ["PROCEED", "PROCEED_WITH_CONDITIONS", "REJECT"].includes(rawRec) ? rawRec : "REJECT"
  ) as InvestmentMemoData["recommendation"];
  const recommendationRationale = str(d.recommendationRationale, "No rationale provided.");

  // screening
  const scr = obj(d.screening);
  if (!d.screening) warn("screening");
  const ov = obj(scr.overview);
  const screening = {
    overview: {
      address: str(ov.address, propertyAddress),
      listingPrice: str(ov.listingPrice),
      numberOfFlats: str(ov.numberOfFlats),
      totalGia: str(ov.totalGia),
      buildingType: str(ov.buildingType),
      construction: str(ov.construction),
      listedStatus: str(ov.listedStatus),
      tenure: str(ov.tenure),
      currentCondition: str(ov.currentCondition),
      vacancyStatus: str(ov.vacancyStatus),
      currentYield: str(ov.currentYield),
      epcRatings: str(ov.epcRatings),
      councilTaxBands: str(ov.councilTaxBands, ""),
      locationNotes: str(ov.locationNotes),
      agent: str(ov.agent),
      listedDate: str(ov.listedDate),
    },
    mandatoryCriteria: arr(scr.mandatoryCriteria, (item) => {
      const c = obj(item);
      return {
        criterion: str(c.criterion),
        requirement: str(c.requirement),
        status: str(c.status, "FAIL") as "PASS" | "FAIL" | "UNVERIFIED" | "LIKELY_PASS",
        confidence: str(c.confidence, "MEDIUM"),
      };
    }),
    criticalNote: str(scr.criticalNote, ""),
    unitSchedule: arr(scr.unitSchedule, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        floor: str(u.floor),
        beds: num(u.beds),
        giaSqm: num(u.giaSqm),
        giaSqft: num(u.giaSqft),
        epc: str(u.epc),
        meetsMinSize: boolOrStr(u.meetsMinSize),
        currentRent: str(u.currentRent, ""),
      };
    }),
    unitScheduleSummary: str(scr.unitScheduleSummary, ""),
  };

  // financial
  const fin = obj(d.financial);
  if (!d.financial) warn("financial");

  const costItem = (item: unknown) => {
    const c = obj(item);
    return { item: str(c.item), amount: num(c.amount), notes: str(c.notes, "") };
  };

  // Value Creation Step 1
  const vc1 = obj(fin.valueCreationStep1);
  const valueCreationStep1 = {
    title: str(vc1.title, "Title Split (As-Is Aggregate Value)"),
    description: str(vc1.description),
    perUnit: arr(vc1.perUnit, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        sqm: num(u.sqm),
        beds: num(u.beds),
        conservativePriceSqm: num(u.conservativePriceSqm),
        moderatePriceSqm: num(u.moderatePriceSqm),
        aggressivePriceSqm: num(u.aggressivePriceSqm),
        asIsValue: num(u.asIsValue),
      };
    }),
    totals: (() => {
      const t = obj(vc1.totals);
      return { conservative: num(t.conservative), moderate: num(t.moderate), aggressive: num(t.aggressive) };
    })(),
    blockDiscountNote: str(vc1.blockDiscountNote, ""),
  };

  // Value Creation Step 2
  const vc2 = obj(fin.valueCreationStep2);
  const valueCreationStep2 = {
    title: str(vc2.title, "Post-Refurbishment GDV"),
    description: str(vc2.description),
    perUnit: arr(vc2.perUnit, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        sqm: num(u.sqm),
        conservativeGDV: num(u.conservativeGDV),
        moderateGDV: num(u.moderateGDV),
        aggressiveGDV: num(u.aggressiveGDV),
        priceSqmMod: num(u.priceSqmMod),
      };
    }),
    totals: (() => {
      const t = obj(vc2.totals);
      return { conservative: num(t.conservative), moderate: num(t.moderate), aggressive: num(t.aggressive) };
    })(),
  };

  // Tax breakdown
  const tb = obj(fin.taxBreakdown);
  const taxBreakdown = {
    taxType: str(tb.taxType, "SDLT"),
    effectiveRate: str(tb.effectiveRate),
    bands: arr(tb.bands, (item) => {
      const b = obj(item);
      return {
        band: str(b.band),
        rate: str(b.rate),
        taxableAmount: num(b.taxableAmount),
        taxDue: num(b.taxDue),
        cumulative: num(b.cumulative),
      };
    }),
    totalTax: num(tb.totalTax),
  };

  // Scenario returns
  const sr = obj(fin.scenarioReturns);
  const scenarioReturns = {
    conservative: sanitizeScenarioReturn(sr.conservative),
    moderate: sanitizeScenarioReturn(sr.moderate),
    aggressive: sanitizeScenarioReturn(sr.aggressive),
  };

  const st = obj(fin.stressTest);
  const stressTest = {
    conservative: sanitizeScenarioReturn(st.conservative),
    moderate: sanitizeScenarioReturn(st.moderate),
    aggressive: sanitizeScenarioReturn(st.aggressive),
  };

  const maxPurchaseForTargetROI = arr(fin.maxPurchaseForTargetROI, (item) => {
    const m = obj(item);
    return {
      scenario: str(m.scenario),
      gdv: num(m.gdv),
      maxPurchasePrice: num(m.maxPurchasePrice),
    };
  });

  const financial = {
    valueCreationStep1,
    valueCreationStep2,
    acquisitionCosts: arr(fin.acquisitionCosts, costItem),
    totalAcquisition: num(fin.totalAcquisition),
    splittingCosts: arr(fin.splittingCosts, costItem),
    totalSplitting: num(fin.totalSplitting),
    refurbishmentCosts: arr(fin.refurbishmentCosts, costItem),
    totalRefurbishment: num(fin.totalRefurbishment),
    financeCosts: arr(fin.financeCosts, costItem),
    totalFinanceAndHolding: num(fin.totalFinanceAndHolding),
    totalProjectInvestment: num(fin.totalProjectInvestment),
    taxBreakdown,
    scenarioReturns,
    stressTest,
    maxPurchaseForTargetROI,
    maxPurchaseNote: str(fin.maxPurchaseNote, ""),
  };

  // comparables
  const comp = obj(d.comparables);
  if (!d.comparables) warn("comparables");

  const hmb = obj(comp.housemetricBaseline);
  const bd = obj(comp.blockDiscount);
  const comparables = {
    description: str(comp.description, ""),
    individualFlatSales: arr(comp.individualFlatSales, (item) => {
      const c = obj(item);
      return {
        address: str(c.address),
        type: str(c.type),
        beds: num(c.beds),
        sqm: num(c.sqm),
        price: num(c.price),
        pricePerSqm: num(c.pricePerSqm),
        date: str(c.date),
        source: str(c.source),
      };
    }),
    comparableNote: str(comp.comparableNote, ""),
    housemetricBaseline: {
      source: str(hmb.source),
      sampleSize: num(hmb.sampleSize),
      period: str(hmb.period),
      lowerQuartile: num(hmb.lowerQuartile),
      median: num(hmb.median),
      upperQuartile: num(hmb.upperQuartile),
      subjectStreetAvg: numOrNull(hmb.subjectStreetAvg),
      note: str(hmb.note, ""),
    },
    blockDiscount: {
      sumAsIsModerate: num(bd.sumAsIsModerate),
      sumPostRefurbModerate: num(bd.sumPostRefurbModerate),
      acquisitionPrice: num(bd.acquisitionPrice),
      discountVsAsIs: num(bd.discountVsAsIs),
      discountVsPostRefurb: num(bd.discountVsPostRefurb),
      typicalRange: str(bd.typicalRange, "15-25%"),
      note: str(bd.note, ""),
    },
  };

  // risks
  const rsk = obj(d.risks);
  if (!d.risks) warn("risks");
  const risks = {
    matrix: arr(rsk.matrix, (item) => {
      const r = obj(item);
      return {
        risk: str(r.risk),
        likelihood: str(r.likelihood, "MEDIUM") as RiskLikelihood,
        impact: str(r.impact, "MEDIUM") as RiskImpact,
        mitigation: str(r.mitigation),
      };
    }),
    redFlags: arr(rsk.redFlags, (item) => {
      const rf = obj(item);
      return { flag: str(rf.flag), status: str(rf.status) };
    }),
  };

  // implementation
  const impl = obj(d.implementation);
  if (!d.implementation) warn("implementation");
  const implementation = {
    exitStrategy: str(impl.exitStrategy, "SHARE_OF_FREEHOLD"),
    exitStrategyLabel: str(impl.exitStrategyLabel, "Share of Freehold Sale"),
    exitStrategyRationale: str(impl.exitStrategyRationale),
    timeline: arr(impl.timeline, (item) => {
      const t = obj(item);
      return { week: str(t.week), activity: str(t.activity), status: str(t.status, "") };
    }),
    professionalTeam: arr(impl.professionalTeam, (item) => {
      const p = obj(item);
      return { role: str(p.role), notes: str(p.notes) };
    }),
  };

  // goNoGo
  const gng = obj(d.goNoGo);
  if (!d.goNoGo) warn("goNoGo");
  const rawDec = str(gng.decision, "REJECT");
  const goNoGo = {
    criteria: arr(gng.criteria, (item) => {
      const c = obj(item);
      return {
        requirement: str(c.requirement),
        target: str(c.target),
        status: str(c.status, "FAIL"),
        confidence: str(c.confidence, "MEDIUM"),
      };
    }),
    decision: (
      ["PROCEED", "PROCEED_WITH_CONDITIONS", "REJECT"].includes(rawDec) ? rawDec : "REJECT"
    ) as InvestmentMemoData["goNoGo"]["decision"],
    conditions: strArr(gng.conditions),
    analystNote: str(gng.analystNote, ""),
  };

  if (warnings.length > 0) {
    console.warn(`[sanitize] InvestmentMemo defaulted ${warnings.length} fields:`, warnings);
  }

  return {
    propertyAddress,
    analysisDate,
    keyMetrics,
    criticalNote,
    recommendation,
    recommendationRationale,
    screening,
    financial,
    comparables,
    risks,
    implementation,
    goNoGo,
  };
}

// Local type aliases for risk fields
type RiskLikelihood = "LOW" | "MEDIUM" | "HIGH" | "CERTAIN";
type RiskImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ─── Valuation Memo Sanitizer ───────────────────────────────────────────────

export function sanitizeValuationMemo(raw: unknown): ValuationMemoData {
  const d = obj(raw);
  const warnings: string[] = [];
  function warn(path: string) { warnings.push(path); }

  const propertyAddress = str(d.propertyAddress, "Unknown Address");
  if (!d.propertyAddress) warn("propertyAddress");
  const propertyName = str(d.propertyName, "");
  const propertySubtitle = str(d.propertySubtitle, "");
  const analysisDate = str(d.analysisDate, new Date().toISOString().slice(0, 10));

  // headlineValuation
  const hv = obj(d.headlineValuation);
  if (!d.headlineValuation) warn("headlineValuation");

  const vdc = obj(hv.valuationDateContext);
  const ps = obj(hv.propertySummary);

  const headlineValuation = {
    asIsFreehold: num(hv.asIsFreehold),
    aggregateSplitValue: num(hv.aggregateSplitValue),
    uplift: num(hv.uplift),
    upliftPercent: num(hv.upliftPercent),
    valuationBasis: str(hv.valuationBasis),
    aggregateValueBasis: str(hv.aggregateValueBasis, ""),
    valuationDateContext: {
      valuationDate: str(vdc.valuationDate, analysisDate),
      day90Value: strOrNull(vdc.day90Value),
      day180Value: strOrNull(vdc.day180Value),
      marketEvidencePeriod: str(vdc.marketEvidencePeriod),
      transactionSampleSize: str(vdc.transactionSampleSize),
    },
    propertySummary: {
      address: str(ps.address, propertyAddress),
      propertyType: str(ps.propertyType),
      tenure: str(ps.tenure),
      numberOfUnits: str(ps.numberOfUnits),
      totalFloorArea: str(ps.totalFloorArea),
      construction: str(ps.construction),
      heating: str(ps.heating),
      epcRatings: str(ps.epcRatings),
      condition: str(ps.condition),
      parking: str(ps.parking),
      gardens: str(ps.gardens),
    },
  };

  // valuationLogic
  const vl = obj(d.valuationLogic);
  if (!d.valuationLogic) warn("valuationLogic");

  const mrs = obj(vl.marketRateSummary);
  const lq = obj(mrs.lowerQuartile);
  const med = obj(mrs.median);
  const uq = obj(mrs.upperQuartile);
  const aa = obj(mrs.adoptedAverage);

  const valuationLogic = {
    introText: str(vl.introText, ""),
    marketRateSummary: {
      source: str(mrs.source),
      sampleDescription: str(mrs.sampleDescription),
      lowerQuartile: { priceSqm: num(lq.priceSqm), priceSqft: num(lq.priceSqft) },
      median: { priceSqm: num(med.priceSqm), priceSqft: num(med.priceSqft) },
      upperQuartile: { priceSqm: num(uq.priceSqm), priceSqft: num(uq.priceSqft) },
      adoptedAverage: { priceSqm: num(aa.priceSqm), priceSqft: num(aa.priceSqft) },
      adoptedVsMedian: str(mrs.adoptedVsMedian),
      adoptedVsMedianLabel: str(mrs.adoptedVsMedianLabel, "CONSERVATIVE"),
      discountReasons: strArr(mrs.discountReasons),
    },
    perFlatValuations: arr(vl.perFlatValuations, (item) => {
      const f = obj(item);
      return {
        flat: str(f.flat),
        floor: str(f.floor),
        beds: num(f.beds),
        giaSqm: num(f.giaSqm),
        estimatedValue: num(f.estimatedValue),
        priceSqm: num(f.priceSqm),
      };
    }),
    totalAggregateValue: num(vl.totalAggregateValue),
    unitRationale: arr(vl.unitRationale, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        value: num(u.value),
        rationale: str(u.rationale),
      };
    }),
  };

  // comparableEvidence
  const ce = obj(d.comparableEvidence);
  if (!d.comparableEvidence) warn("comparableEvidence");
  const comparableEvidence = {
    introText: str(ce.introText, ""),
    comparables: arr(ce.comparables, (item) => {
      const c = obj(item);
      return {
        address: str(c.address),
        beds: num(c.beds),
        sqm: num(c.sqm),
        price: num(c.price),
        pricePerSqm: num(c.pricePerSqm),
        date: str(c.date),
        condition: str(c.condition),
        source: str(c.source),
      };
    }),
    comparableAnalysis: arr(ce.comparableAnalysis, (item) => {
      const ca = obj(item);
      return {
        address: str(ca.address),
        narrative: str(ca.narrative),
      };
    }),
    streetLevelData: arr(ce.streetLevelData, (item) => {
      const s = obj(item);
      return {
        street: str(s.street),
        averagePriceSqm: num(s.averagePriceSqm),
        sampleSize: str(s.sampleSize),
      };
    }),
    adoptedAverageForComparison: num(ce.adoptedAverageForComparison),
    conclusion: str(ce.conclusion, ""),
  };

  // propertyLayout
  const pl = obj(d.propertyLayout);
  if (!d.propertyLayout) warn("propertyLayout");
  const propertyLayout = {
    description: str(pl.description, ""),
    unitScheduleVerified: arr(pl.unitScheduleVerified, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        floor: str(u.floor),
        beds: num(u.beds),
        giaSqm: num(u.giaSqm),
        giaSqft: num(u.giaSqft),
        epcRating: str(u.epcRating),
      };
    }),
    minimumSizeCompliance: str(pl.minimumSizeCompliance, ""),
    leasePlanRequirements: strArr(pl.leasePlanRequirements),
    planningPortalNote: str(pl.planningPortalNote, ""),
  };

  // demisedAreas
  const da = obj(d.demisedAreas);
  if (!d.demisedAreas) warn("demisedAreas");
  const demisedAreas = {
    parkingSpaces: arr(da.parkingSpaces, (item) => {
      const p = obj(item);
      return {
        space: str(p.space),
        allocatedTo: str(p.allocatedTo),
        estimatedValueAdd: str(p.estimatedValueAdd),
      };
    }),
    parkingNote: str(da.parkingNote, ""),
    gardens: arr(da.gardens, (item) => {
      const g = obj(item);
      return {
        area: str(g.area),
        allocatedTo: str(g.allocatedTo),
        estimatedValueAdd: str(g.estimatedValueAdd),
      };
    }),
    gardenRecommendation: str(da.gardenRecommendation, ""),
    commonParts: strArr(da.commonParts),
    freeholdCompanyStructure: str(da.freeholdCompanyStructure, ""),
  };

  // processNotes
  const pn = obj(d.processNotes);
  if (!d.processNotes) warn("processNotes");

  const vsr = obj(pn.valuationSummaryRepeat);
  const processNotes = {
    valuationAssumptions: strArr(pn.valuationAssumptions),
    specialAssumption: str(pn.specialAssumption),
    reinstatementCostNote: str(pn.reinstatementCostNote),
    bridgeFinanceRequirements: strArr(pn.bridgeFinanceRequirements),
    nextSteps: arr(pn.nextSteps, (item) => {
      const s = obj(item);
      return { step: num(s.step), description: str(s.description) };
    }),
    valuationSummaryRepeat: {
      asIsValue: num(vsr.asIsValue),
      aggregateValue: num(vsr.aggregateValue),
      uplift: num(vsr.uplift),
      upliftPercent: num(vsr.upliftPercent),
      conservativeNote: str(vsr.conservativeNote, ""),
    },
    dataSources: str(pn.dataSources, ""),
    disclaimer: str(pn.disclaimer, "This memo is for internal use and to support formal valuation instruction"),
  };

  if (warnings.length > 0) {
    console.warn(`[sanitize] ValuationMemo defaulted ${warnings.length} fields:`, warnings);
  }

  return {
    propertyAddress,
    propertyName,
    propertySubtitle,
    analysisDate,
    headlineValuation,
    valuationLogic,
    comparableEvidence,
    propertyLayout,
    demisedAreas,
    processNotes,
  };
}
