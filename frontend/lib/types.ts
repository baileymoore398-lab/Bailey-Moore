export interface Metrics {
  distance_m: number;
  duration_s: number;
  moving_time_s: number;
  avg_speed_kmh: number;
  max_speed_kmh: number;
  avg_pace_min_km: number;
  total_climb_m: number;
  total_descent_m: number;
}

export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number | null;
  t: number; // epoch seconds
  speed_kmh: number;
}

export interface Mistake {
  type: string;
  leg: number | null;
  t_start: number;
  t_end: number;
  lost_s: number;
  severity: "low" | "medium" | "high";
  description: string;
}

export interface Leg {
  number: number;
  from_control: string;
  to_control: string;
  time_s: number;
  best_time_s: number | null;
  time_loss_s: number;
  rank: number | null;
  pct_behind: number | null;
  distance_m: number;
  mistakes: Mistake[];
}

export interface Control {
  id: string;
  code: string;
  order: number;
  lat: number | null;
  lon: number | null;
  confidence: number;
}

export interface Scores {
  navigation: number;
  fitness: number;
  execution: number;
  route_choice: number;
  overall: number;
}

export interface CoachReport {
  summary: string;
  overview?: string;
  strengths: string[];
  weaknesses: string[];
  mistakes: string[];
  advice: string[];
  training?: string[];
  focus_areas?: string[];
  generated_by?: string;
}

export interface Analysis {
  id: string;
  race_id: string;
  status: string;
  metrics: Metrics;
  scores: Scores;
  track: TrackPoint[];
  controls: Control[];
  legs: Leg[];
  mistakes: Mistake[];
  coach: CoachReport;
  confidence: { map: number; ocr: number; gps_alignment: number };
  created_at: string;
}

export type RaceStatus =
  | "created"
  | "uploading"
  | "queued"
  | "processing"
  | "ready"
  | "failed";

export interface Race {
  id: string;
  name: string;
  status: RaceStatus | string;
  created_at?: string;
  thumbnail_url?: string | null;
}

export type UploadKind = "map" | "gps" | "splits";

export interface UploadResult {
  id: string;
  kind: UploadKind;
  url?: string;
}

export interface AnalyzeResult {
  analysis_id: string;
  status: string;
}

export interface AthleteProfile {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string | null;
  stats: {
    races: number;
    total_distance_km: number;
    total_time_s: number;
    avg_overall_score: number;
    avg_navigation: number;
    avg_fitness: number;
    best_score: number;
  };
  trend: Array<{
    race: string;
    date: string;
    overall: number;
    navigation: number;
    fitness: number;
    distance_km: number;
    time_loss_s: number;
  }>;
}

/* ===================== Auth / account ===================== */
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}

export interface MeResponse {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  plan: string;
  analyses_used: number;
  is_superuser: boolean;
}

/* ===================== Events ===================== */
export interface EventDetail {
  id: string;
  name: string;
  slug: string;
  discipline: string;
  status: string;
  date?: string | null;
  location?: string | null;
  description?: string | null;
  is_public: boolean;
  entry_count: number;
  matched_gps: number;
  has_analysis: boolean;
}

export interface LeaderboardRow {
  position: number | null;
  name: string;
  total_time_s: number | null;
  behind_s: number | null;
  status: string;
}

export interface LegRanking {
  leg: number;
  from_control: string;
  to_control: string;
  best_s: number | null;
  rankings: { rank: number; name: string; time_s: number; behind_s: number }[];
}

export interface RouteComparisonLeg {
  leg: number;
  from_control: string;
  to_control: string;
  competitors: { name: string; distance_m: number; efficiency: number | null; time_loss_s: number | null }[];
}

export interface EventAnalysis {
  event_id?: string;
  name?: string;
  leaderboards: Record<string, LeaderboardRow[]>;
  leg_rankings: Record<string, LegRanking[]>;
  route_comparison: Record<string, RouteComparisonLeg[]>;
  stats: { courses: number; competitors: number; finishers: number; gps_matched: number };
}

export interface EventReplayCompetitor {
  name: string;
  course: string;
  position: number | null;
  color: string;
  points: { lat: number; lon: number; speed_kmh: number; elapsed_s: number }[];
  metrics: Metrics;
}

export interface EventReplay {
  event_id: string;
  course: string | null;
  competitors: EventReplayCompetitor[];
}

/* ===================== Coach ===================== */
export interface CoachAthlete {
  athlete_id: string;
  display_name: string;
  handle: string | null;
  races: number;
  avg_overall: number;
}

export interface CoachTrendPoint {
  race: string;
  date: string | null;
  overall: number | null;
  navigation: number | null;
  fitness: number | null;
  execution: number | null;
  route_choice: number | null;
  route_efficiency_pct: number | null;
  time_loss_s: number | null;
  nav_errors: number | null;
}

export interface CoachTrends {
  athlete_id?: string;
  display_name?: string;
  series: CoachTrendPoint[];
  summary: Record<string, number>;
  recommendations: string[];
  focus_areas: string[];
  athletes?: CoachAthlete[];
}

/* ===================== Club ===================== */
export interface ClubRankingRow {
  rank: number;
  athlete_id: string;
  display_name: string;
  races: number;
  distance_km: number;
  avg_overall: number;
}

export interface ClubAnalytics {
  club_id?: string;
  name: string;
  members: number;
  total_races: number;
  total_distance_km: number;
  total_climb_m: number;
  events_participated: number;
  rankings: ClubRankingRow[];
}

/* ===================== Training ===================== */
export interface VolumeBucket {
  week?: string;
  month?: string;
  distance_km: number;
  duration_h: number;
  climb_m: number;
  load: number;
  sessions: number;
}

export interface TrainingAnalytics {
  weekly_volume: VolumeBucket[];
  monthly_volume: VolumeBucket[];
  speed_hr_trends: { date: string | null; avg_speed_kmh: number; avg_hr: number | null; distance_km: number }[];
  training_load: { acute_load: number; chronic_load: number; acwr: number; zone: string };
  race_readiness: { readiness: number; load_score: number; volume_score: number; navigation_score: number; acwr: Record<string, unknown> };
  personal_bests: { category: string; value: number; unit: string; date: string | null }[];
  session_count: number;
  goals?: Record<string, unknown>[];
}

/* ===================== Billing ===================== */
export interface PlanInfo {
  id: string;
  name: string;
  price_month: number;
  features: string[];
}

export interface PayPalConfig {
  client_id: string;
  env: string;
  plans: Record<string, string>; // tier id -> PayPal plan_id
}

export interface BillingPlans {
  plans: PlanInfo[];
  billing_enabled: boolean;
  paypal?: PayPalConfig | null;
}

/* ===================== Replay / heatmap ===================== */
export interface HeatmapData {
  mode: string;
  cell_m: number;
  max_weight: number;
  points: { lat: number; lon: number; weight: number; count: number; intensity?: number }[];
}
