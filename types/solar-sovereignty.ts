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

export type SubNcmBreakdownItem = {
  ncm_code: string;
  imports_value_usd: number;
  exports_value_usd: number;
  trade_balance_usd: number;
  share_of_basket_imports: number;
  share_of_basket_exports: number;
  direction: "exportador" | "importador";
};

// Mirrors the "status" convention used in Python's complementary_sources
// (build_sector_sovereignty_metrics.py): "published" once real data is
// ingested, "required" when the source is indispensable but not yet wired,
// "complementary" when it enriches the reading without blocking it.
export type TerritorialSourceStatus = "published" | "required" | "complementary";

// No TerritorialIndicator may exist without this filled in -- the same
// citation discipline as global_source/complementary_sources in the
// sovereignty pipelines: no number ships without an identified institution.
export type TerritorialSource = {
  institution: string;
  dataset: string;
  url?: string;
  reference_period?: string;
  status: TerritorialSourceStatus;
};

// value is explicitly nullable: the shape can be declared and cited before
// real data ingestion exists, without forcing an unverified number into
// production (see this project's rule: never write a number without
// checking the primary source first).
export type TerritorialIndicator = {
  value: number | null;
  unit: string;
  source: TerritorialSource;
  note?: string;
};

// Chain-agnostic territorial/powershoring layer, keyed by region (UF or
// industrial hub) rather than by chain -- silicio, aco, fertilizantes and
// combustiveis_transicao are meant to share the same TerritorialContext for
// a given region instead of each chain holding its own copy of the same
// regional data. Inspired by the TYPE of indicator regional dashboards like
// SustenData surface (industrial capacity, renewable potential,
// infrastructure, licensing bottlenecks) -- never by SustenData itself,
// which is a format reference only, not a real data integration.
export type TerritorialContext = {
  region_code: string;
  region_name: string;
  region_level: "uf" | "polo" | "municipio";
  industrial_capacity?: TerritorialIndicator;
  solar_potential?: TerritorialIndicator;
  wind_potential?: TerritorialIndicator;
  port_infrastructure?: TerritorialIndicator;
  rail_infrastructure?: TerritorialIndicator;
  industrial_electricity_consumption?: TerritorialIndicator;
  water_availability?: TerritorialIndicator;
  // No single federal source: environmental licensing is run by state
  // agencies (e.g. SEMACE in Ceará, IDEMA in Rio Grande do Norte). Each
  // record's source must name the specific state agency -- never a
  // generic national average.
  environmental_licensing_lead_time_months?: TerritorialIndicator;
  updated_at: string;
};

// Forward-looking strategic narrative, decoupled from the trade-risk engine
// on purpose: NIBMatrixChart's quadrant reads only deficit/capacity/volume
// and must stay auditable against those numbers alone. Never let this field
// change a matrixState/status classification -- render it as its own
// explicitly-labeled "Tese Estratégica" badge instead (StrategicVectorBadge).
export type StrategicProfile = {
  is_powershoring_vector: boolean;
  label: string;
  thesis: string;
  value_chain_links: string[];
  // Populated only when is_powershoring_vector is true and a real
  // TerritorialContext has been ingested for the relevant region --
  // StrategicVectorBadge renders it as supporting evidence for the thesis,
  // never as a replacement for it.
  territorial_context?: TerritorialContext | null;
};

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
  sub_ncm_masking_level: 1 | 2 | null;
  sub_ncm_breakdown: SubNcmBreakdownItem[] | null;
  strategic_profile: StrategicProfile | null;
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
