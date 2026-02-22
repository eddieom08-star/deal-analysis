import { z } from "zod/v4";

// ─── Analysis Lifecycle ───────────────────────────────────────────────────────

export enum AnalysisStatus {
  PENDING = "pending",
  SCRAPING = "scraping",
  FETCHING_DATA = "fetching_data",
  ENRICHING_COMPARABLES = "enriching_comparables",
  ANALYZING_INVESTMENT = "analyzing_investment",
  ANALYZING_VALUATION = "analyzing_valuation",
  GENERATING_PDFS = "generating_pdfs",
  UPLOADING = "uploading",
  EMAILING = "emailing",
  COMPLETE = "complete",
  FAILED = "failed",
}

// ─── Rightmove Scraped Data ──────────────────────────────────────────────────

export interface PropertyAddress {
  displayAddress: string;
  postcode: string;
  outcode: string;
  incode: string;
  street: string;
}

export interface PropertyListing {
  id: string;
  url: string;
  price: number;
  displayPrice: string;
  address: PropertyAddress;
  propertyType: string;
  propertySubType: string;
  bedrooms: number;
  bathrooms: number;
  tenure: string;
  description: string;
  keyFeatures: string[];
  images: Array<{ url: string; caption: string }>;
  floorplans: Array<{ url: string; caption: string }>;
  epcRating: string | null;
  councilTaxBand: string | null;
  latitude: number;
  longitude: number;
  agent: { name: string; branch: string; phone: string };
  sizeSqft: number | null;
  sizeSqm: number | null;
  numberOfFlats: number | null;
}

// ─── Land Registry ───────────────────────────────────────────────────────────

export interface LandRegistryTransaction {
  transactionId: string;
  price: number;
  date: string;
  address: {
    paon: string;
    saon: string;
    street: string;
    locality: string;
    town: string;
    district: string;
    county: string;
    postcode: string;
  };
  propertyType: "D" | "S" | "T" | "F" | "O"; // Detached, Semi, Terraced, Flat, Other
  newBuild: boolean;
  tenure: "F" | "L"; // Freehold, Leasehold
  recordStatus: "A" | "B"; // Standard, Additional
}

// ─── EPC ─────────────────────────────────────────────────────────────────────

export interface EPCCertificate {
  lmkKey: string;
  address1: string;
  address2: string;
  address3: string;
  postcode: string;
  buildingReference: string;
  currentEnergyRating: string;
  currentEnergyEfficiency: number;
  potentialEnergyRating: string;
  propertyType: string;
  builtForm: string;
  inspectionDate: string;
  lodgementDate: string;
  totalFloorArea: number;
  numberHabitableRooms: number;
  floorLevel: string;
  tenure: string;
  transactionType: string;
}

// ─── PropertyData.co.uk API Responses ────────────────────────────────────────

export interface PropertyDataSoldPrice {
  address: string;
  price: number;
  date: string;
  type: string;
  tenure: string;
  newBuild: boolean;
  distance: number;
}

export interface PropertyDataSoldPrices {
  postcode: string;
  pointsAnalysed: number;
  radius?: number;
  averagePrice: number | null;
  transactionCount: number;
  data: PropertyDataSoldPrice[];
  status: string;
}

export interface PropertyDataSqftEntry {
  address: string;
  price: number;
  date: string;
  sqft: number;
  pricePerSqft: number;
  type: string;
  tenure: string;
  distance: number;
}

export interface PropertyDataSoldPricesPerSqft {
  postcode: string;
  pointsAnalysed: number;
  averagePricePerSqft: number;
  data: PropertyDataSqftEntry[];
  status: string;
}

export interface PropertyDataValuation {
  postcode: string;
  result: number;
  resultFormatted: string;
  upperRange: number | null;
  lowerRange: number | null;
  confidenceLevel: string;
  pricePerSqft: number;
  status: string;
}

// ─── Enriched Comparables (HouseMetric Approach) ────────────────────────────

export interface EnrichedComparable {
  address: string;
  salePrice: number;
  saleDate: string;
  floorAreaSqm: number;
  floorAreaSqft: number;
  pricePerSqm: number;
  pricePerSqft: number;
  propertyType: string;
  tenure: string;
  epcRating: string;
  bedrooms: number | null;
  matchConfidence: "high" | "medium" | "low";
  source: "land-registry+epc";
}

export interface AreaPriceMetrics {
  meanPricePerSqft: number;
  medianPricePerSqft: number;
  minPricePerSqft: number;
  maxPricePerSqft: number;
  meanPricePerSqm: number;
  medianPricePerSqm: number;
  sampleCount: number;
  dateRange: { from: string; to: string };
  postcode: string;
}

export interface CrossReferenceResult {
  propertyDataAvgSqft: number | null;
  enrichedAvgSqft: number | null;
  divergencePercent: number | null;
  agreement: "high" | "moderate" | "low" | "insufficient_data";
  note: string;
}

// ─── Combined Comparable Evidence ────────────────────────────────────────────

export interface ComparableEvidence {
  propertyData: {
    soldPrices: PropertyDataSoldPrices | null;
    soldPricesPerSqft: PropertyDataSoldPricesPerSqft | null;
    valuation: PropertyDataValuation | null;
  };
  landRegistry: LandRegistryTransaction[];
  epc: EPCCertificate[];
  enrichedComparables: EnrichedComparable[];
  areaMetrics: AreaPriceMetrics | null;
  crossReference: CrossReferenceResult;
}

// ─── Investment Memo Data (Matches Freehold Block Template) ─────────────────

export interface UnitScheduleEntry {
  flat: string;
  floor: string;
  beds: number;
  giaSqm: number;
  giaSqft: number;
  epc: string;
  meetsMinSize: boolean;
}

export interface ScreeningCriteria {
  criterion: string;
  requirement: string;
  status: "PASS" | "FAIL";
}

export interface CostItem {
  item: string;
  amount: number;
}

export interface ExitValuation {
  flat: string;
  sqm: number;
  beds: number;
  pricePerSqm: number;
  value: number;
  salesCosts: number;
  netValue: number;
}

export interface RiskEntry {
  risk: string;
  likelihood: "L" | "M" | "H";
  impact: "L" | "M" | "H";
  mitigation: string;
}

export interface TimelineEntry {
  week: string;
  activity: string;
}

export interface InvestmentMemoData {
  propertyAddress: string;
  analysisDate: string;
  keyMetrics: {
    purchasePrice: number;
    splitGDV: number;
    lenderLTV75: number;
    grossProfit: number;
    roi: number;
  };
  recommendation: "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT";
  recommendationRationale: string;

  // Section 1: Screening Summary
  screening: {
    overview: {
      address: string;
      listingPrice: number;
      numberOfFlats: number;
      totalGiaSqm: number;
      totalGiaSqft: number;
      buildingType: string;
      construction: string;
      listedStatus: string;
      tenure: string;
      currentCondition: string;
      vacancyStatus: string;
      epcRatings: string;
      councilTaxBands: string;
      locationNotes: string;
    };
    mandatoryCriteria: ScreeningCriteria[];
    unitSchedule: UnitScheduleEntry[];
  };

  // Section 2: Financial Analysis
  financial: {
    acquisitionCosts: CostItem[];
    totalAcquisition: number;
    splittingCosts: CostItem[];
    totalSplitting: number;
    refurbishmentCosts: CostItem[];
    totalRefurbishment: number;
    totalProjectCost: number;
    financeCosts: number;
    holdingCosts: number;
    exitValuations: ExitValuation[];
    totalGrossSalesValue: number;
    totalSalesCosts: number;
    totalNetProceeds: number;
    returns: {
      totalInvestment: number;
      grossSalesValue: number;
      salesCosts: number;
      netProceeds: number;
      grossProfit: number;
      profitMargin: number;
      roi: number;
      profitPerUnit: number;
      holdPeriodMonths: number;
      annualisedRoi: number;
    };
    stressedReturns: {
      totalInvestment: number;
      grossSalesValue: number;
      salesCosts: number;
      netProceeds: number;
      grossProfit: number;
      profitMargin: number;
      roi: number;
    };
  };

  // Section 3: Comparable Evidence
  comparables: {
    individualFlatSales: Array<{
      address: string;
      type: string;
      beds: number;
      sqm: number;
      price: number;
      pricePerSqm: number;
      date: string;
      source: string;
    }>;
    blockDiscount: {
      sumOfIndividualValues: number;
      typicalBlockDiscount: string;
      impliedWholeBlockValue: number;
      acquisitionPriceInclCosts: number;
      discountAchieved: number;
    };
  };

  // Section 4: Risk Assessment
  risks: {
    matrix: RiskEntry[];
    redFlags: Array<{
      flag: string;
      triggered: boolean;
    }>;
  };

  // Section 5: Implementation Plan
  implementation: {
    exitStrategy: "RETAINED_FREEHOLD" | "SHARE_OF_FREEHOLD" | "HYBRID";
    exitStrategyRationale: string;
    timeline: TimelineEntry[];
    professionalTeam: Array<{
      role: string;
      notes: string;
    }>;
  };

  // Go/No-Go
  goNoGo: {
    criteria: Array<{
      requirement: string;
      target: string;
      status: "PASS" | "FAIL";
    }>;
    decision: "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT";
    conditions: string;
  };
}

// ─── Valuation Memo Data (Sections A-F) ─────────────────────────────────────

export interface ValuationMemoData {
  propertyAddress: string;
  analysisDate: string;

  // A: Headline Valuation & Summary
  headlineValuation: {
    asIsFreehold: number;
    aggregateSplitValue: number;
    uplift: number;
    upliftPercent: number;
    valuationBasis: string;
    specialAssumption: string;
    day180Value: number | null;
    day90Value: number | null;
  };

  // B: Valuation Logic / Calculations
  valuationLogic: {
    perFlatValuations: Array<{
      flat: string;
      sqm: number;
      sqft: number;
      pricePerSqft: number;
      estimatedValue: number;
      basis: string;
      premiums: string;
    }>;
    totalAggregateValue: number;
    areaAveragePricePerSqft: number;
    proposedPricePerSqftVsAverage: string;
  };

  // C: Local Comparable Evidence
  comparableEvidence: {
    comparables: Array<{
      address: string;
      propertyType: string;
      beds: number;
      salePrice: number;
      saleDate: string;
      pricePerSqft: number;
      distanceApprox: string;
      specialNotes: string;
      source: string;
    }>;
    averagePricePerSqft: number;
    medianPricePerSqft: number;
    proposedVsAverage: string;
  };

  // D: Property Layout / Plans
  propertyLayout: {
    hasExistingPlans: boolean;
    planSource: string;
    proposedDemiseNotes: string;
    floorplanUrls: string[];
  };

  // E: Demised Areas that Drive Value
  demisedAreas: {
    parkingSpaces: Array<{
      space: string;
      allocatedTo: string;
      estimatedValueAdd: number;
    }>;
    gardens: Array<{
      area: string;
      allocatedTo: string;
      estimatedValueAdd: number;
    }>;
    totalValueFromDemisedAreas: number;
  };

  // F: Practical / Process Notes
  processNotes: {
    specialAssumption: string;
    exitStrategy: string;
    reinstatementCostNote: string;
    insuranceNote: string;
    additionalNotes: string;
  };
}

// ─── Master Analysis Record ─────────────────────────────────────────────────

export interface AnalysisRecord {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  input: {
    rightmoveUrl: string;
    userNotes: string;
    reportEmail: string;
  };
  listing: PropertyListing | null;
  comparables: ComparableEvidence | null;
  investmentMemo: InvestmentMemoData | null;
  valuationMemo: ValuationMemoData | null;
  pdfs: {
    investmentMemoUrl: string | null;
    valuationMemoUrl: string | null;
  };
  emailSentAt: string | null;
  error: string | null;

  // Pipeline resilience fields
  lastCompletedStep?: AnalysisStatus;
  retryCount?: number;
  failureReason?: string;
  retryableFailure?: boolean;
  partialDataWarnings?: string[];
}

// ─── Zod Schemas for Runtime Validation ─────────────────────────────────────

export const rightmoveUrlSchema = z.string().url().regex(
  /rightmove\.co\.uk\/properties\/\d+/,
  "Must be a valid Rightmove property URL"
);

export const submitAnalysisSchema = z.object({
  rightmoveUrl: rightmoveUrlSchema,
  userNotes: z.string().max(5000).optional().default(""),
  reportEmail: z.email().optional(),
});

export type SubmitAnalysisInput = z.infer<typeof submitAnalysisSchema>;

