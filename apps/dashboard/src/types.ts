export type Filters = {
  dateFrom: string;
  dateTo: string;
  state?: string;
  city?: string;
  zip?: string;
  make?: string;
  model?: string;
  modelYearBand?: string;
  creditRating?: string;
};

export type OverviewResponse = {
  kpis: {
    identifiedShoppers: number;
    highIntentShoppers: number;
    avgIntentScore: number;
    opportunityIndex: number;
  };
  segments: {
    warm: number;
    hot: number;
    superhot: number;
  };
  trend: Array<{
    date: string;
    identified_shoppers: number;
    high_intent_shoppers: number;
    avg_intent_score: number;
    opportunity_index: number;
  }>;
  samples: Array<{
    masked_email: string | null;
    masked_phone: string | null;
    city: string;
    state: string;
    zip: string;
    make: string;
    model: string;
    model_year: number;
    intent_score: number;
    intent_tier: string;
    created_at: string;
  }>;
};

export type GeoRow = {
  state?: string;
  city?: string;
  zip?: string;
  identified_shoppers: number;
  high_intent_shoppers: number;
  avg_intent_score: number;
  opportunity_index: number;
};

export type VehiclesRow = {
  make: string;
  model: string;
  model_year: number;
  shopper_count: number;
  avg_intent_score: number;
};

export type CodexResponse = {
  dataDictionary: Array<{
    name: string;
    type: string;
    description: string;
    example: string;
    nullable: boolean;
    notes: string;
  }>;
  metricDefinitions: Array<{ name: string; definition: string }>;
  demoAssumptions: string[];
  scoringRules: string[];
};

export type FiltersResponse = {
  states: string[];
  makes: string[];
  models: string[];
  yearBands: string[];
  creditRatings: string[];
};
