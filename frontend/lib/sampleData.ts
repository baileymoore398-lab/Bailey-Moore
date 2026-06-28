import type {
  AthleteProfile,
  ClubAnalytics,
  CoachTrends,
  EventAnalysis,
  EventReplay,
  Race,
  TrainingAnalytics,
} from "./types";

export const sampleRaces: Race[] = [
  {
    id: "rc_demo_001",
    name: "Fløyen Forest Sprint",
    status: "ready",
    created_at: "2026-05-18T11:05:00.000Z",
    thumbnail_url: null,
  },
  {
    id: "rc_demo_002",
    name: "Nordmarka Middle Distance",
    status: "ready",
    created_at: "2026-04-27T09:30:00.000Z",
    thumbnail_url: null,
  },
  {
    id: "rc_demo_003",
    name: "Bymarka Night-O",
    status: "processing",
    created_at: "2026-06-12T19:45:00.000Z",
    thumbnail_url: null,
  },
  {
    id: "rc_demo_004",
    name: "Lillomarka Long",
    status: "queued",
    created_at: "2026-06-14T08:00:00.000Z",
    thumbnail_url: null,
  },
  {
    id: "rc_demo_005",
    name: "Ekeberg City Race",
    status: "failed",
    created_at: "2026-03-15T14:20:00.000Z",
    thumbnail_url: null,
  },
];

export const sampleAthlete: AthleteProfile = {
  id: "ath_demo_001",
  name: "Alex Rainsford",
  email: "alex@example.com",
  avatar_url: null,
  stats: {
    races: 28,
    total_distance_km: 214.6,
    total_time_s: 78_540,
    avg_overall_score: 76,
    avg_navigation: 73,
    avg_fitness: 84,
    best_score: 91,
  },
  trend: [
    {
      race: "Bymarka Sprint",
      date: "2026-01-12",
      overall: 68,
      navigation: 64,
      fitness: 79,
      distance_km: 3.1,
      time_loss_s: 142,
    },
    {
      race: "Ekeberg City",
      date: "2026-02-09",
      overall: 71,
      navigation: 69,
      fitness: 80,
      distance_km: 4.4,
      time_loss_s: 118,
    },
    {
      race: "Romeriksåsen",
      date: "2026-03-02",
      overall: 70,
      navigation: 66,
      fitness: 83,
      distance_km: 6.8,
      time_loss_s: 131,
    },
    {
      race: "Nordmarka Middle",
      date: "2026-04-27",
      overall: 78,
      navigation: 75,
      fitness: 85,
      distance_km: 5.2,
      time_loss_s: 86,
    },
    {
      race: "Fløyen Sprint",
      date: "2026-05-18",
      overall: 74,
      navigation: 74,
      fitness: 82,
      distance_km: 2.4,
      time_loss_s: 71,
    },
    {
      race: "Lillomarka Long",
      date: "2026-06-14",
      overall: 84,
      navigation: 82,
      fitness: 88,
      distance_km: 9.6,
      time_loss_s: 54,
    },
  ],
};

/* ===================== Ecosystem demo data ===================== */

export const sampleEventAnalysis: EventAnalysis = {
  name: "Spring Forest Cup",
  stats: { courses: 1, competitors: 4, finishers: 4, gps_matched: 3 },
  leaderboards: {
    "Men Elite": [
      { position: 1, name: "Jane Smith", total_time_s: 1805, behind_s: 0, status: "ok" },
      { position: 2, name: "Bob Jones", total_time_s: 1840, behind_s: 35, status: "ok" },
      { position: 3, name: "Ola Nilsen", total_time_s: 1922, behind_s: 117, status: "ok" },
      { position: 4, name: "Sam Park", total_time_s: 2050, behind_s: 245, status: "ok" },
    ],
  },
  leg_rankings: {
    "Men Elite": [
      {
        leg: 1, from_control: "S", to_control: "101", best_s: 90,
        rankings: [
          { rank: 1, name: "Jane Smith", time_s: 90, behind_s: 0 },
          { rank: 2, name: "Bob Jones", time_s: 95, behind_s: 5 },
          { rank: 3, name: "Ola Nilsen", time_s: 104, behind_s: 14 },
        ],
      },
      {
        leg: 2, from_control: "101", to_control: "102", best_s: 100,
        rankings: [
          { rank: 1, name: "Bob Jones", time_s: 100, behind_s: 0 },
          { rank: 2, name: "Jane Smith", time_s: 110, behind_s: 10 },
        ],
      },
    ],
  },
  route_comparison: {
    "Men Elite": [
      {
        leg: 1, from_control: "S", to_control: "101",
        competitors: [
          { name: "Jane Smith", distance_m: 410, efficiency: 0.93, time_loss_s: 0 },
          { name: "Bob Jones", distance_m: 470, efficiency: 0.81, time_loss_s: 5 },
        ],
      },
    ],
  },
};

function demoTrack(seedLat: number, seedLon: number, n = 120) {
  const pts = [];
  let lat = seedLat;
  let lon = seedLon;
  let bearing = 40;
  for (let i = 0; i < n; i++) {
    bearing += Math.sin(i / 12) * 9;
    lat += (5 * Math.cos((bearing * Math.PI) / 180)) / 111320;
    lon += (5 * Math.sin((bearing * Math.PI) / 180)) / (111320 * Math.cos((lat * Math.PI) / 180));
    pts.push({ lat, lon, speed_kmh: 9 + Math.abs(Math.sin(i / 8)) * 6, elapsed_s: i * 6 });
  }
  return pts;
}

export const sampleEventReplay: EventReplay = {
  event_id: "demo-event",
  course: "Men Elite",
  competitors: [
    { name: "Jane Smith", course: "Men Elite", position: 1, color: "#38bdf8", points: demoTrack(60.0, 10.0), metrics: sampleAthleteMetrics() },
    { name: "Bob Jones", course: "Men Elite", position: 2, color: "#f472b6", points: demoTrack(60.0005, 10.0006), metrics: sampleAthleteMetrics() },
    { name: "Ola Nilsen", course: "Men Elite", position: 3, color: "#a3e635", points: demoTrack(59.9996, 9.9994), metrics: sampleAthleteMetrics() },
  ],
};

function sampleAthleteMetrics() {
  return {
    distance_m: 4200, duration_s: 1805, moving_time_s: 1700, avg_speed_kmh: 8.9,
    max_speed_kmh: 17.2, avg_pace_min_km: 6.7, total_climb_m: 95, total_descent_m: 92,
  };
}

export const sampleCoachTrends: CoachTrends = {
  athlete_id: "demo-athlete",
  display_name: "Demo Athlete",
  athletes: [
    { athlete_id: "demo-athlete", display_name: "Demo Athlete", handle: "demo", races: 6, avg_overall: 78.4 },
    { athlete_id: "a2", display_name: "Kari Berg", handle: "kari", races: 4, avg_overall: 71.2 },
  ],
  series: [
    { race: "Sprint 1", date: "2026-01-10", overall: 72, navigation: 70, fitness: 75, execution: 68, route_choice: 74, route_efficiency_pct: 82, time_loss_s: 95, nav_errors: 3 },
    { race: "Middle 1", date: "2026-02-14", overall: 76, navigation: 78, fitness: 74, execution: 72, route_choice: 79, route_efficiency_pct: 86, time_loss_s: 70, nav_errors: 2 },
    { race: "Long 1", date: "2026-03-20", overall: 81, navigation: 84, fitness: 77, execution: 79, route_choice: 83, route_efficiency_pct: 90, time_loss_s: 48, nav_errors: 1 },
  ],
  summary: { navigation_slope: 7, route_efficiency_slope: 4, time_loss_slope: -23.5, nav_errors_slope: -1, races: 3 },
  recommendations: [
    "Navigation is improving steadily — keep reinforcing your current map-reading routine.",
    "Add pressure training to keep execution sharp at race speed.",
  ],
  focus_areas: ["execution"],
};

export const sampleClubAnalytics: ClubAnalytics = {
  name: "Forest OK",
  members: 12,
  total_races: 48,
  total_distance_km: 372.5,
  total_climb_m: 5840,
  events_participated: 7,
  rankings: [
    { rank: 1, athlete_id: "a1", display_name: "Jane Smith", races: 9, distance_km: 71.2, avg_overall: 84.1 },
    { rank: 2, athlete_id: "a2", display_name: "Bob Jones", races: 7, distance_km: 58.0, avg_overall: 79.6 },
    { rank: 3, athlete_id: "a3", display_name: "Kari Berg", races: 6, distance_km: 44.3, avg_overall: 75.2 },
  ],
};

export const sampleTrainingAnalytics: TrainingAnalytics = {
  weekly_volume: [
    { week: "2026-W08", distance_km: 38.2, duration_h: 4.1, climb_m: 420, load: 310, sessions: 4 },
    { week: "2026-W09", distance_km: 45.6, duration_h: 4.8, climb_m: 510, load: 360, sessions: 5 },
    { week: "2026-W10", distance_km: 41.0, duration_h: 4.3, climb_m: 470, load: 330, sessions: 4 },
    { week: "2026-W11", distance_km: 52.1, duration_h: 5.5, climb_m: 610, load: 420, sessions: 6 },
  ],
  monthly_volume: [
    { month: "2026-01", distance_km: 150.2, duration_h: 16.2, climb_m: 1820, load: 1240, sessions: 17 },
    { month: "2026-02", distance_km: 168.4, duration_h: 17.9, climb_m: 2010, load: 1360, sessions: 19 },
  ],
  speed_hr_trends: [
    { date: "2026-03-01", avg_speed_kmh: 10.8, avg_hr: 152, distance_km: 9.2 },
    { date: "2026-03-08", avg_speed_kmh: 11.2, avg_hr: 149, distance_km: 11.0 },
    { date: "2026-03-15", avg_speed_kmh: 11.6, avg_hr: 147, distance_km: 12.4 },
  ],
  training_load: { acute_load: 420, chronic_load: 355, acwr: 1.18, zone: "optimal" },
  race_readiness: { readiness: 82.4, load_score: 100, volume_score: 88, navigation_score: 79, acwr: { acwr: 1.18, zone: "optimal" } },
  personal_bests: [
    { category: "longest_run", value: 21.1, unit: "km", date: "2026-02-22" },
    { category: "fastest_avg_speed", value: 13.4, unit: "km/h", date: "2026-03-15" },
    { category: "biggest_climb", value: 680, unit: "m", date: "2026-02-08" },
  ],
  session_count: 36,
  goals: [
    { id: "g1", title: "200 km in March", metric: "distance_km", target_value: 200, current_value: 142.5, progress_pct: 71.3, period: "month", status: "active" },
  ],
};
