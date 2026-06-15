import type {
  Analysis,
  AnalyzeResult,
  AthleteProfile,
  Race,
  UploadKind,
  UploadResult,
} from "./types";
import { sampleAnalysis } from "./sampleAnalysis";
import { sampleAthlete, sampleRaces } from "./sampleData";

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
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      body: options.body,
      headers: options.headers,
      signal: options.signal,
      cache: "no-store",
    });
  } catch (err) {
    throw new ApiError(
      `Network error reaching ${url}: ${(err as Error).message}`,
      0
    );
  }

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
 * Run a request and, if it fails for any reason, resolve with bundled demo
 * data so the UI is fully demoable without a running backend.
 */
async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T
): Promise<{ data: T; demo: boolean }> {
  try {
    const data = await fn();
    return { data, demo: false };
  } catch {
    return { data: fallback, demo: true };
  }
}

/* ----------------------------- Races ----------------------------- */

export async function createRace(name?: string): Promise<Race> {
  const form = new FormData();
  if (name) form.append("name", name);
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
