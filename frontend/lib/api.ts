import type {
  Analysis,
  AnalyzeResult,
  AthleteProfile,
  AuthResponse,
  BillingPlans,
  ClubAnalytics,
  CoachAthlete,
  CoachTrends,
  EventAnalysis,
  EventDetail,
  EventReplay,
  HeatmapData,
  MeResponse,
  Race,
  TrainingAnalytics,
  UploadKind,
  UploadResult,
} from "./types";
import { sampleAnalysis } from "./sampleAnalysis";
import {
  sampleAthlete,
  sampleClubAnalytics,
  sampleCoachTrends,
  sampleEventAnalysis,
  sampleEventReplay,
  sampleRaces,
  sampleTrainingAnalytics,
} from "./sampleData";
import { authHeaders } from "./auth";
import { isDemoMode } from "./demo";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:8000";
const API_V1 = `${API_BASE}/api/v1`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: BodyInit | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Centralized fetch wrapper. Throws ApiError on non-2xx responses and on
 * network failures, so callers can decide whether to fall back to demo data.
 */
export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_V1}${path}`;
  let res: Response;
  // Retry transient network failures (e.g. a host that briefly restarts /
  // throttles mid-session and drops the connection) a couple of times.
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, {
        method: options.method ?? "GET",
        body: options.body,
        headers: { ...authHeaders(), ...options.headers },
        signal: options.signal,
        cache: "no-store",
      });
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err as Error;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
  }
  if (lastErr) {
    throw new ApiError(`Network error reaching ${url}: ${lastErr.message}`, 0);
  }
  res = res!;

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = (data && (data.detail || data.message)) || detail;
    } catch {
      /* ignore parse errors */
    }
    throw new ApiError(`${res.status} ${detail}`, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Resolve REAL backend data by default. Demo (bundled sample) data is returned
 * only when the user has explicitly enabled demo mode, or — as a clearly
 * labelled fallback — when the backend cannot be reached at all (so the page
 * still renders instead of crashing). The `demo` flag drives the on-page notice.
 */
async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<{ data: T; demo: boolean }> {
  if (isDemoMode()) {
    return { data: fallback, demo: true };
  }
  try {
    const data = await fn();
    return { data, demo: false };
  } catch {
    // Backend unreachable: render demo data but flag it so the UI explains why.
    return { data: fallback, demo: true };
  }
}

/* ----------------------------- Races ----------------------------- */

export async function createRace(
  name?: string,
  discipline = "orienteering"
): Promise<Race> {
  // Always send fields: an empty multipart body fails to parse server-side
  // ("There was an error parsing the body" / 400).
  const form = new FormData();
  form.append("name", name && name.trim() ? name.trim() : "Untitled race");
  form.append("discipline", discipline);
  return request<Race>("/races", { method: "POST", body: form });
}

export async function uploadFile(
  raceId: string,
  kind: UploadKind,
  file: File
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  return request<UploadResult>(`/races/${raceId}/uploads/${kind}`, {
    method: "POST",
    body: form,
  });
}

export async function analyzeRace(raceId: string): Promise<AnalyzeResult> {
  return request<AnalyzeResult>(`/races/${raceId}/analyze`, { method: "POST" });
}

export async function getRace(raceId: string): Promise<Race> {
  return request<Race>(`/races/${raceId}`);
}

export async function listRaces(): Promise<{ data: Race[]; demo: boolean }> {
  return withFallback(() => request<Race[]>("/races"), sampleRaces);
}

export async function getAnalysis(
  raceId: string
): Promise<{ data: Analysis; demo: boolean }> {
  return withFallback(
    () => request<Analysis>(`/races/${raceId}/analysis`),
    { ...sampleAnalysis, race_id: raceId }
  );
}

export async function getAthlete(): Promise<{
  data: AthleteProfile;
  demo: boolean;
}> {
  return withFallback(() => request<AthleteProfile>("/athletes/me"), sampleAthlete);
}

function jsonBody(data: unknown): RequestOptions {
  return {
    method: "POST",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  };
}

/* ----------------------------- Auth ----------------------------- */

export async function register(
  email: string,
  password: string,
  fullName?: string
): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/register", jsonBody({ email, password, full_name: fullName }));
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", jsonBody({ email, password }));
}

export async function getMe(): Promise<MeResponse> {
  return request<MeResponse>("/account/me");
}

export async function updateProfile(data: Record<string, unknown>): Promise<MeResponse> {
  return request<MeResponse>("/account/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: { "Content-Type": "application/json" },
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string; reset_token?: string }> {
  return request("/account/password-reset/request", jsonBody({ email }));
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<{ message: string }> {
  return request("/account/password-reset/confirm", jsonBody({ token, new_password: newPassword }));
}

/* ----------------------------- Events ----------------------------- */

export async function createEvent(data: Record<string, unknown>): Promise<EventDetail> {
  return request<EventDetail>("/events", jsonBody(data));
}

export async function listEvents(): Promise<{ data: EventDetail[]; demo: boolean }> {
  return withFallback(() => request<EventDetail[]>("/events"), []);
}

export async function getEvent(id: string): Promise<{ data: EventDetail; demo: boolean }> {
  return withFallback(() => request<EventDetail>(`/events/${id}`), {
    id, name: "Demo Event", slug: "demo-event", discipline: "orienteering",
    status: "published", is_public: true, entry_count: 2, matched_gps: 2, has_analysis: true,
  } as EventDetail);
}

export async function uploadEventResults(id: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  return request(`/events/${id}/results`, { method: "POST", body: form });
}

export async function uploadEventGps(id: string, files: File[]) {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  return request(`/events/${id}/gps-batch`, { method: "POST", body: form });
}

export async function analyzeEvent(id: string) {
  return request(`/events/${id}/analyze`, { method: "POST" });
}

export async function getEventAnalysis(
  id: string,
  course?: string
): Promise<{ data: EventAnalysis; demo: boolean }> {
  const q = course ? `?course=${encodeURIComponent(course)}` : "";
  return withFallback(() => request<EventAnalysis>(`/events/${id}/analysis${q}`), sampleEventAnalysis);
}

export async function getEventReplay(
  id: string,
  course?: string
): Promise<{ data: EventReplay; demo: boolean }> {
  const q = course ? `?course=${encodeURIComponent(course)}` : "";
  return withFallback(() => request<EventReplay>(`/events/${id}/replay${q}`), sampleEventReplay);
}

/* ----------------------------- Coach ----------------------------- */

export async function listCoachAthletes(): Promise<{ data: CoachAthlete[]; demo: boolean }> {
  return withFallback(() => request<CoachAthlete[]>("/coach/athletes"), sampleCoachTrends.athletes ?? []);
}

export async function linkAthlete(handle: string) {
  return request("/coach/athletes", jsonBody({ athlete_handle: handle }));
}

export async function getAthleteTrends(
  athleteId: string
): Promise<{ data: CoachTrends; demo: boolean }> {
  return withFallback(() => request<CoachTrends>(`/coach/athletes/${athleteId}/trends`), sampleCoachTrends);
}

export async function addCoachNote(athleteId: string, body: string, raceId?: string) {
  return request("/coach/notes", jsonBody({ athlete_id: athleteId, body, race_id: raceId }));
}

export async function listCoachNotes(athleteId: string) {
  return request(`/coach/athletes/${athleteId}/notes`);
}

/* ----------------------------- Clubs ----------------------------- */

export async function listClubs() {
  return withFallback(() => request<{ id: string; name: string; slug: string; members: number }[]>("/clubs"), []);
}

export async function createClub(name: string, country?: string) {
  return request("/clubs", jsonBody({ name, country }));
}

export async function getClubAnalytics(id: string): Promise<{ data: ClubAnalytics; demo: boolean }> {
  return withFallback(() => request<ClubAnalytics>(`/clubs/${id}/analytics`), sampleClubAnalytics);
}

export async function addClubMember(id: string, handle: string) {
  return request(`/clubs/${id}/members`, jsonBody({ athlete_handle: handle }));
}

/* ----------------------------- Training ----------------------------- */

export async function uploadTrainingSession(file: File, sport = "run") {
  const form = new FormData();
  form.append("file", file);
  form.append("sport", sport);
  return request("/training/sessions", { method: "POST", body: form });
}

export async function getTrainingAnalytics(): Promise<{ data: TrainingAnalytics; demo: boolean }> {
  return withFallback(() => request<TrainingAnalytics>("/training/analytics"), sampleTrainingAnalytics);
}

export async function createGoal(data: Record<string, unknown>) {
  return request("/training/goals", jsonBody(data));
}

export async function listGoals() {
  return withFallback(
    () => request<Record<string, unknown>[]>("/training/goals"),
    sampleTrainingAnalytics.goals ?? []
  );
}

/* ----------------------------- Billing ----------------------------- */

export async function getPlans(): Promise<{ data: BillingPlans; demo: boolean }> {
  return withFallback(() => request<BillingPlans>("/billing/plans"), {
    billing_enabled: false,
    plans: [
      { id: "free", name: "Free", price_month: 0, features: ["3 analyses / month", "Interactive replay"] },
      { id: "pro", name: "Pro", price_month: 9, features: ["Unlimited analyses", "AI coach + video", "Heatmaps"] },
      { id: "team", name: "Team", price_month: 29, features: ["Coach dashboard", "Up to 15 athletes"] },
      { id: "club", name: "Club", price_month: 79, features: ["Club dashboard", "Event hosting"] },
    ],
  });
}

export async function startCheckout(plan: string, successUrl: string, cancelUrl: string) {
  return request<{ checkout_url: string }>(
    "/billing/checkout",
    jsonBody({ plan, success_url: successUrl, cancel_url: cancelUrl })
  );
}

/* ----------------------------- Sharing / Replay ----------------------------- */

export async function createShare(resourceType: string, resourceId: string) {
  return request<{ token: string; url: string }>("/share", jsonBody({ resource_type: resourceType, resource_id: resourceId }));
}

export async function resolveShare(token: string) {
  return request<Record<string, unknown>>(`/share/${token}`);
}

export async function getRaceHeatmap(
  raceId: string,
  mode: "density" | "speed" | "error"
): Promise<{ data: HeatmapData; demo: boolean }> {
  return withFallback(
    () => request<HeatmapData>(`/replay/races/${raceId}/heatmap?mode=${mode}`),
    { mode, cell_m: 12, max_weight: 1, points: [] }
  );
}
