import type { InvestmentMemoData, ValuationMemoData } from "@/lib/types";

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

function obj(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

// ─── Investment Memo Sanitizer ───────────────────────────────────────────────

export function sanitizeInvestmentMemo(raw: unknown): InvestmentMemoData {
  const d = obj(raw);
  const warnings: string[] = [];

  function warn(path: string) {
    warnings.push(path);
  }

  // Top-level
  const propertyAddress = str(d.propertyAddress, "Unknown Address");
  if (!d.propertyAddress) warn("propertyAddress");
  const analysisDate = str(d.analysisDate, new Date().toISOString().slice(0, 10));

  // keyMetrics
  const km = obj(d.keyMetrics);
  if (!d.keyMetrics) warn("keyMetrics");
  const keyMetrics = {
    purchasePrice: num(km.purchasePrice),
    splitGDV: num(km.splitGDV),
    lenderLTV75: num(km.lenderLTV75),
    grossProfit: num(km.grossProfit),
    roi: num(km.roi),
  };

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
      listingPrice: num(ov.listingPrice),
      numberOfFlats: num(ov.numberOfFlats),
      totalGiaSqm: num(ov.totalGiaSqm),
      totalGiaSqft: num(ov.totalGiaSqft),
      buildingType: str(ov.buildingType),
      construction: str(ov.construction),
      listedStatus: str(ov.listedStatus),
      tenure: str(ov.tenure),
      currentCondition: str(ov.currentCondition),
      vacancyStatus: str(ov.vacancyStatus),
      epcRatings: str(ov.epcRatings),
      councilTaxBands: str(ov.councilTaxBands, ""),
      locationNotes: str(ov.locationNotes),
    },
    mandatoryCriteria: arr(scr.mandatoryCriteria, (item) => {
      const c = obj(item);
      return {
        criterion: str(c.criterion),
        requirement: str(c.requirement),
        status: (str(c.status, "FAIL") === "PASS" ? "PASS" : "FAIL") as "PASS" | "FAIL",
      };
    }),
    unitSchedule: arr(scr.unitSchedule, (item) => {
      const u = obj(item);
      return {
        flat: str(u.flat),
        floor: str(u.floor),
        beds: num(u.beds),
        giaSqm: num(u.giaSqm),
        giaSqft: num(u.giaSqft),
        epc: str(u.epc),
        meetsMinSize: bool(u.meetsMinSize),
      };
    }),
  };

  // financial
  const fin = obj(d.financial);
  if (!d.financial) warn("financial");
  const costItem = (item: unknown) => {
    const c = obj(item);
    return { item: str(c.item), amount: num(c.amount) };
  };
  const exitVal = (item: unknown) => {
    const e = obj(item);
    return {
      flat: str(e.flat),
      sqm: num(e.sqm),
      beds: num(e.beds),
      pricePerSqm: num(e.pricePerSqm),
      value: num(e.value),
      salesCosts: num(e.salesCosts),
      netValue: num(e.netValue),
    };
  };
  const returnsObj = (v: unknown) => {
    const r = obj(v);
    return {
      totalInvestment: num(r.totalInvestment),
      grossSalesValue: num(r.grossSalesValue),
      salesCosts: num(r.salesCosts),
      netProceeds: num(r.netProceeds),
      grossProfit: num(r.grossProfit),
      profitMargin: num(r.profitMargin),
      roi: num(r.roi),
    };
  };

  const fullReturns = obj(fin.returns);
  const financial = {
    acquisitionCosts: arr(fin.acquisitionCosts, costItem),
    totalAcquisition: num(fin.totalAcquisition),
    splittingCosts: arr(fin.splittingCosts, costItem),
    totalSplitting: num(fin.totalSplitting),
    refurbishmentCosts: arr(fin.refurbishmentCosts, costItem),
    totalRefurbishment: num(fin.totalRefurbishment),
    totalProjectCost: num(fin.totalProjectCost),
    financeCosts: num(fin.financeCosts),
    holdingCosts: num(fin.holdingCosts),
    exitValuations: arr(fin.exitValuations, exitVal),
    totalGrossSalesValue: num(fin.totalGrossSalesValue),
    totalSalesCosts: num(fin.totalSalesCosts),
    totalNetProceeds: num(fin.totalNetProceeds),
    returns: {
      ...returnsObj(fin.returns),
      profitPerUnit: num(fullReturns.profitPerUnit),
      holdPeriodMonths: num(fullReturns.holdPeriodMonths),
      annualisedRoi: num(fullReturns.annualisedRoi),
    },
    stressedReturns: returnsObj(fin.stressedReturns),
  };

  // comparables
  const comp = obj(d.comparables);
  if (!d.comparables) warn("comparables");
  const bd = obj(comp.blockDiscount);
  const comparables = {
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
    blockDiscount: {
      sumOfIndividualValues: num(bd.sumOfIndividualValues),
      typicalBlockDiscount: str(bd.typicalBlockDiscount),
      impliedWholeBlockValue: num(bd.impliedWholeBlockValue),
      acquisitionPriceInclCosts: num(bd.acquisitionPriceInclCosts),
      discountAchieved: num(bd.discountAchieved),
    },
  };

  // risks
  const rsk = obj(d.risks);
  if (!d.risks) warn("risks");
  const lmh = (v: unknown) => {
    const s = str(v, "M");
    return (["L", "M", "H"].includes(s) ? s : "M") as "L" | "M" | "H";
  };
  const risks = {
    matrix: arr(rsk.matrix, (item) => {
      const r = obj(item);
      return {
        risk: str(r.risk),
        likelihood: lmh(r.likelihood),
        impact: lmh(r.impact),
        mitigation: str(r.mitigation),
      };
    }),
    redFlags: arr(rsk.redFlags, (item) => {
      const rf = obj(item);
      return { flag: str(rf.flag), triggered: bool(rf.triggered) };
    }),
  };

  // implementation
  const impl = obj(d.implementation);
  if (!d.implementation) warn("implementation");
  const rawExit = str(impl.exitStrategy, "RETAINED_FREEHOLD");
  const implementation = {
    exitStrategy: (
      ["RETAINED_FREEHOLD", "SHARE_OF_FREEHOLD", "HYBRID"].includes(rawExit)
        ? rawExit
        : "RETAINED_FREEHOLD"
    ) as InvestmentMemoData["implementation"]["exitStrategy"],
    exitStrategyRationale: str(impl.exitStrategyRationale),
    timeline: arr(impl.timeline, (item) => {
      const t = obj(item);
      return { week: str(t.week), activity: str(t.activity) };
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
        status: (str(c.status, "FAIL") === "PASS" ? "PASS" : "FAIL") as "PASS" | "FAIL",
      };
    }),
    decision: (
      ["PROCEED", "PROCEED_WITH_CONDITIONS", "REJECT"].includes(rawDec) ? rawDec : "REJECT"
    ) as InvestmentMemoData["goNoGo"]["decision"],
    conditions: str(gng.conditions, ""),
  };

  if (warnings.length > 0) {
    console.warn(`[sanitize] InvestmentMemo defaulted ${warnings.length} fields:`, warnings);
  }

  return {
    propertyAddress,
    analysisDate,
    keyMetrics,
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

// ─── Valuation Memo Sanitizer ────────────────────────────────────────────────

export function sanitizeValuationMemo(raw: unknown): ValuationMemoData {
  const d = obj(raw);
  const warnings: string[] = [];

  function warn(path: string) {
    warnings.push(path);
  }

  const propertyAddress = str(d.propertyAddress, "Unknown Address");
  if (!d.propertyAddress) warn("propertyAddress");
  const analysisDate = str(d.analysisDate, new Date().toISOString().slice(0, 10));

  // headlineValuation
  const hv = obj(d.headlineValuation);
  if (!d.headlineValuation) warn("headlineValuation");
  const headlineValuation = {
    asIsFreehold: num(hv.asIsFreehold),
    aggregateSplitValue: num(hv.aggregateSplitValue),
    uplift: num(hv.uplift),
    upliftPercent: num(hv.upliftPercent),
    valuationBasis: str(hv.valuationBasis),
    specialAssumption: str(hv.specialAssumption),
    day180Value: typeof hv.day180Value === "number" ? hv.day180Value : null,
    day90Value: typeof hv.day90Value === "number" ? hv.day90Value : null,
  };

  // valuationLogic
  const vl = obj(d.valuationLogic);
  if (!d.valuationLogic) warn("valuationLogic");
  const valuationLogic = {
    perFlatValuations: arr(vl.perFlatValuations, (item) => {
      const f = obj(item);
      return {
        flat: str(f.flat),
        sqm: num(f.sqm),
        sqft: num(f.sqft),
        pricePerSqft: num(f.pricePerSqft),
        estimatedValue: num(f.estimatedValue),
        basis: str(f.basis),
        premiums: str(f.premiums, ""),
      };
    }),
    totalAggregateValue: num(vl.totalAggregateValue),
    areaAveragePricePerSqft: num(vl.areaAveragePricePerSqft),
    proposedPricePerSqftVsAverage: str(vl.proposedPricePerSqftVsAverage),
  };

  // comparableEvidence
  const ce = obj(d.comparableEvidence);
  if (!d.comparableEvidence) warn("comparableEvidence");
  const comparableEvidence = {
    comparables: arr(ce.comparables, (item) => {
      const c = obj(item);
      return {
        address: str(c.address),
        propertyType: str(c.propertyType),
        beds: num(c.beds),
        salePrice: num(c.salePrice),
        saleDate: str(c.saleDate),
        pricePerSqft: num(c.pricePerSqft),
        distanceApprox: str(c.distanceApprox),
        specialNotes: str(c.specialNotes, ""),
        source: str(c.source),
      };
    }),
    averagePricePerSqft: num(ce.averagePricePerSqft),
    medianPricePerSqft: num(ce.medianPricePerSqft),
    proposedVsAverage: str(ce.proposedVsAverage),
  };

  // propertyLayout
  const pl = obj(d.propertyLayout);
  if (!d.propertyLayout) warn("propertyLayout");
  const propertyLayout = {
    hasExistingPlans: bool(pl.hasExistingPlans),
    planSource: str(pl.planSource, ""),
    proposedDemiseNotes: str(pl.proposedDemiseNotes),
    floorplanUrls: arr(pl.floorplanUrls, (u) => str(u, "")),
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
        estimatedValueAdd: num(p.estimatedValueAdd),
      };
    }),
    gardens: arr(da.gardens, (item) => {
      const g = obj(item);
      return {
        area: str(g.area),
        allocatedTo: str(g.allocatedTo),
        estimatedValueAdd: num(g.estimatedValueAdd),
      };
    }),
    totalValueFromDemisedAreas: num(da.totalValueFromDemisedAreas),
  };

  // processNotes
  const pn = obj(d.processNotes);
  if (!d.processNotes) warn("processNotes");
  const processNotes = {
    specialAssumption: str(pn.specialAssumption),
    exitStrategy: str(pn.exitStrategy),
    reinstatementCostNote: str(pn.reinstatementCostNote),
    insuranceNote: str(pn.insuranceNote),
    additionalNotes: str(pn.additionalNotes, ""),
  };

  if (warnings.length > 0) {
    console.warn(`[sanitize] ValuationMemo defaulted ${warnings.length} fields:`, warnings);
  }

  return {
    propertyAddress,
    analysisDate,
    headlineValuation,
    valuationLogic,
    comparableEvidence,
    propertyLayout,
    demisedAreas,
    processNotes,
  };
}
