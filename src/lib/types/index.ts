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
  meetsMinSize: boolean | string; // true/false or "CHECK"/"UNVERIFIED"
  currentRent: string;
}

export interface ScreeningCriteria {
  criterion: string;
  requirement: string;
  status: "PASS" | "FAIL" | "UNVERIFIED" | "LIKELY_PASS";
  confidence: string; // "LOW" | "MEDIUM" | "HIGH"
}

export interface CostItem {
  item: string;
  amount: number;
  notes: string;
}

export interface RiskEntry {
  risk: string;
  likelihood: "LOW" | "MEDIUM" | "HIGH" | "CERTAIN";
  impact: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  mitigation: string;
}

export interface TimelineEntry {
  week: string;
  activity: string;
  status: string;
}

export interface ScenarioReturn {
  totalGDV: number;
  totalInvestment: number;
  salesCosts: number;
  netProceeds: number;
  grossProfit: number;
  profitMargin: number;
  roi: number;
  profitPerUnit: number;
  holdPeriodMonths: string;
  annualisedRoi: number;
}

export interface InvestmentMemoData {
  propertyAddress: string;
  analysisDate: string;

  keyMetrics: {
    purchasePrice: number;
    aggregateValue: number; // Value Creation Step 1 as-is moderate
    postRefurbGDV: number; // Value Creation Step 2 post-refurb moderate
    lenderLTV75: number;
    grossProfit: number; // moderate scenario
    roi: number; // moderate scenario
  };

  criticalNote: string; // e.g. "This is Wales – LTT applies, NOT SDLT..."

  recommendation: "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT";
  recommendationRationale: string;

  // Section 1: Screening Summary
  screening: {
    overview: {
      address: string;
      listingPrice: string; // formatted e.g. "£485,000 (Guide Price)"
      numberOfFlats: string; // e.g. "4 (2 x 2-bed, 2 x 1-bed)"
      totalGia: string; // e.g. "~166 sqm (~1,787 sq ft)"
      buildingType: string;
      construction: string;
      listedStatus: string;
      tenure: string;
      currentCondition: string;
      vacancyStatus: string;
      currentYield: string;
      epcRatings: string;
      councilTaxBands: string;
      locationNotes: string;
      agent: string;
      listedDate: string;
    };
    mandatoryCriteria: ScreeningCriteria[];
    criticalNote: string; // screening-specific critical note
    unitSchedule: UnitScheduleEntry[];
    unitScheduleSummary: string; // e.g. "Total flats: 4 | Flats likely >=30 sqm: 2..."
  };

  // Section 2: Financial Analysis
  financial: {
    // Value Creation Step 1: Title Split (As-Is Aggregate Value)
    valueCreationStep1: {
      title: string;
      description: string;
      perUnit: Array<{
        flat: string;
        sqm: number;
        beds: number;
        conservativePriceSqm: number;
        moderatePriceSqm: number;
        aggressivePriceSqm: number;
        asIsValue: number; // moderate
      }>;
      totals: { conservative: number; moderate: number; aggressive: number };
      blockDiscountNote: string;
    };

    // Value Creation Step 2: Post-Refurbishment GDV
    valueCreationStep2: {
      title: string;
      description: string;
      perUnit: Array<{
        flat: string;
        sqm: number;
        conservativeGDV: number;
        moderateGDV: number;
        aggressiveGDV: number;
        priceSqmMod: number;
      }>;
      totals: { conservative: number; moderate: number; aggressive: number };
    };

    // Costs
    acquisitionCosts: CostItem[];
    totalAcquisition: number;
    splittingCosts: CostItem[];
    totalSplitting: number;
    refurbishmentCosts: CostItem[];
    totalRefurbishment: number;
    financeCosts: CostItem[];
    totalFinanceAndHolding: number;
    totalProjectInvestment: number;

    // Tax breakdown
    taxBreakdown: {
      taxType: string; // "SDLT" or "LTT"
      effectiveRate: string;
      bands: Array<{
        band: string;
        rate: string;
        taxableAmount: number;
        taxDue: number;
        cumulative: number;
      }>;
      totalTax: number;
    };

    // Scenario Returns
    scenarioReturns: {
      conservative: ScenarioReturn;
      moderate: ScenarioReturn;
      aggressive: ScenarioReturn;
    };

    // Stress Test: GDV -10%
    stressTest: {
      conservative: ScenarioReturn;
      moderate: ScenarioReturn;
      aggressive: ScenarioReturn;
    };

    // Max purchase price for target ROI
    maxPurchaseForTargetROI: Array<{
      scenario: string;
      gdv: number;
      maxPurchasePrice: number;
    }>;
    maxPurchaseNote: string;
  };

  // Section 3: Comparable Evidence
  comparables: {
    description: string; // intro text about sources
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
    comparableNote: string; // note about estimated vs verified sqm
    housemetricBaseline: {
      source: string;
      sampleSize: number;
      period: string;
      lowerQuartile: number;
      median: number;
      upperQuartile: number;
      subjectStreetAvg: number | null;
      note: string;
    };
    blockDiscount: {
      sumAsIsModerate: number;
      sumPostRefurbModerate: number;
      acquisitionPrice: number;
      discountVsAsIs: number;
      discountVsPostRefurb: number;
      typicalRange: string;
      note: string;
    };
  };

  // Section 4: Risk Assessment
  risks: {
    matrix: RiskEntry[];
    redFlags: Array<{
      flag: string;
      status: string; // e.g. "UNVERIFIED – Obtain EPCs", "N/A if freehold", etc.
    }>;
  };

  // Section 5: Implementation Plan
  implementation: {
    exitStrategy: string;
    exitStrategyLabel: string; // e.g. "Option B: Share of Freehold Sale (RECOMMENDED)"
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
      status: string; // flexible: "PASS", "FAIL", "UNVERIFIED", "LIKELY", or specific like "15.3% (Mod)"
      confidence: string;
    }>;
    decision: "PROCEED" | "PROCEED_WITH_CONDITIONS" | "REJECT";
    conditions: string[];
    analystNote: string; // e.g. "Analyst: Claude AI | Date: ... | Confidence Level: ..."
  };
}

// ─── Valuation Memo Data (Sections A-F) ─────────────────────────────────────

export interface ValuationMemoData {
  propertyAddress: string;
  propertyName: string; // e.g. "West End House"
  propertySubtitle: string; // e.g. "Freehold Block of 6 Self-Contained Flats"
  analysisDate: string;

  // A: Headline Valuation & Summary
  headlineValuation: {
    asIsFreehold: number;
    aggregateSplitValue: number;
    uplift: number;
    upliftPercent: number;
    valuationBasis: string;
    aggregateValueBasis: string;
    valuationDateContext: {
      valuationDate: string;
      day90Value: string | null; // range like "£355,000 - £365,000"
      day180Value: string | null;
      marketEvidencePeriod: string;
      transactionSampleSize: string;
    };
    propertySummary: {
      address: string;
      propertyType: string;
      tenure: string;
      numberOfUnits: string;
      totalFloorArea: string;
      construction: string;
      heating: string;
      epcRatings: string;
      condition: string;
      parking: string;
      gardens: string;
    };
  };

  // B: Valuation Logic / Calculations
  valuationLogic: {
    introText: string;
    marketRateSummary: {
      source: string;
      sampleDescription: string;
      lowerQuartile: { priceSqm: number; priceSqft: number };
      median: { priceSqm: number; priceSqft: number };
      upperQuartile: { priceSqm: number; priceSqft: number };
      adoptedAverage: { priceSqm: number; priceSqft: number };
      adoptedVsMedian: string; // e.g. "-54%"
      adoptedVsMedianLabel: string; // e.g. "CONSERVATIVE"
      discountReasons: string[];
    };
    perFlatValuations: Array<{
      flat: string;
      floor: string;
      beds: number;
      giaSqm: number;
      estimatedValue: number;
      priceSqm: number;
    }>;
    totalAggregateValue: number;
    unitRationale: Array<{
      flat: string;
      value: number;
      rationale: string;
    }>;
  };

  // C: Local Comparable Evidence
  comparableEvidence: {
    introText: string;
    comparables: Array<{
      address: string;
      beds: number;
      sqm: number;
      price: number;
      pricePerSqm: number;
      date: string;
      condition: string;
      source: string;
    }>;
    comparableAnalysis: Array<{
      address: string;
      narrative: string;
    }>;
    streetLevelData: Array<{
      street: string;
      averagePriceSqm: number;
      sampleSize: string;
    }>;
    adoptedAverageForComparison: number;
    conclusion: string;
  };

  // D: Property Layout / Plans
  propertyLayout: {
    description: string;
    unitScheduleVerified: Array<{
      flat: string;
      floor: string;
      beds: number;
      giaSqm: number;
      giaSqft: number;
      epcRating: string;
    }>;
    minimumSizeCompliance: string;
    leasePlanRequirements: string[];
    planningPortalNote: string;
  };

  // E: Demised Areas that Drive Value
  demisedAreas: {
    parkingSpaces: Array<{
      space: string;
      allocatedTo: string;
      estimatedValueAdd: string; // range like "+£5,000 - £10,000"
    }>;
    parkingNote: string;
    gardens: Array<{
      area: string;
      allocatedTo: string;
      estimatedValueAdd: string;
    }>;
    gardenRecommendation: string;
    commonParts: string[];
    freeholdCompanyStructure: string;
  };

  // F: Practical / Process Notes
  processNotes: {
    valuationAssumptions: string[];
    specialAssumption: string;
    reinstatementCostNote: string;
    bridgeFinanceRequirements: string[];
    nextSteps: Array<{
      step: number;
      description: string;
    }>;
    valuationSummaryRepeat: {
      asIsValue: number;
      aggregateValue: number;
      uplift: number;
      upliftPercent: number;
      conservativeNote: string;
    };
    dataSources: string;
    disclaimer: string;
  };
}

// ─── Master Analysis Record ─────────────────────────────────────────────────

export interface AnalysisRecord {
  id: string;
  status: AnalysisStatus;
  createdAt: string;
  updatedAt: string;
  input: {
    listingUrl: string;
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

export const listingUrlSchema = z.string().url(
  "Must be a valid property listing URL"
);

export const submitAnalysisSchema = z.object({
  listingUrl: listingUrlSchema,
  userNotes: z.string().max(5000).optional().default(""),
  reportEmail: z.email().optional(),
});

export type SubmitAnalysisInput = z.infer<typeof submitAnalysisSchema>;

