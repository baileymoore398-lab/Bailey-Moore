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
  strengths: string[];
  weaknesses: string[];
  mistakes: string[];
  advice: string[];
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
