export type SolarSupplier = {
  country_code: string;
  country_name: string;
  country_iso3: string;
  value_usd: number;
  share: number;
};

export type SolarMonthlyTrade = {
  period: string;
  flow: "IMP" | "EXP";
  value_usd: number;
  net_weight_kg: number;
};

export type ProductionRouteClass =
  | "fossil_dominant"
  | "transition_underway"
  | "low_carbon_dominant"
  | "untapped_potential"
  | "undetermined";

export type SolarInputMetric = {
  input_id: string;
  label: string;
  stage: string;
  ncm_codes: string[];
  reference_period: string;
  imports_value_usd: number;
  exports_value_usd: number;
  imports_net_weight_kg: number;
  exports_net_weight_kg: number;
  trade_balance_usd: number;
  china_share_brazilian_imports: number;
  supplier_hhi_brazil: number;
  top_supplier: SolarSupplier | null;
  suppliers: SolarSupplier[];
  top_destination: SolarSupplier | null;
  destinations: SolarSupplier[];
  monthly_trade: SolarMonthlyTrade[];
  domestic_production_value_usd_comparable: number | null;
  domestic_production_value_brl: number | null;
  prodlist_codes: string[];
  production_statuses: string[];
  external_dependency: number | null;
  global_china_share: number | null;
  global_hhi_floor: number | null;
  measurement_method: "validated" | "estimated" | "structural";
  confidence_level: "alta" | "media" | "baixa";
  data_gap_reason: string | null;
  production_route_class: ProductionRouteClass;
  production_route_rationale: string;
};

export type SolarSovereigntyResponse = {
  chain_name: string;
  reference_period: string;
  methodology_version: string;
  global_concentration_source?: {
    institution: string;
    publication: string;
    url: string;
    note: string;
  };
  complementary_sources?: Array<{
    source: string;
    scope: string;
    status: "published" | "complementary" | "required";
  }>;
  green_jobs: SolarGreenJobs;
  inputs: SolarInputMetric[];
};

export type SolarGreenJobsActivity = {
  cnae_class: string;
  sector_names: string[];
  formal_jobs: number;
  wage_mass_brl: number;
  exposure_ratio: number;
  exposure_group: string;
  technical_reading: string;
  input_ids: string[];
  state_jobs?: Array<{ uf: string; formal_jobs: number }>;
};

export type SolarGreenJobsState = {
  uf: string;
  formal_jobs: number;
  wage_mass_brl: number;
  activity_jobs?: Array<{ cnae_class: string; formal_jobs: number }>;
};

export type SolarGreenJobs = {
  reference_year: number;
  formal_jobs_in_tsb_activities: number;
  exposure_weighted_jobs_estimate: number;
  wage_mass_brl: number;
  cnae_count: number;
  activities: SolarGreenJobsActivity[];
  top_states: SolarGreenJobsState[];
  methodology_note: string;
};
