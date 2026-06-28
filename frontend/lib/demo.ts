/**
 * Explicit, opt-in demo mode.
 *
 * Real backend data is the DEFAULT everywhere. Demo (bundled sample) data is
 * only shown when the user deliberately turns it on via a "View demo" button,
 * OR — as a graceful, clearly-labelled fallback — when the backend can't be
 * reached at all (so pages still render instead of crashing).
 *
 * State is stored in localStorage and can also be forced with `?demo=1`.
 */
const KEY = "rf_demo";

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") return true;
    if (params.get("demo") === "0") return false;
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function enableDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, "1");
}

export function disableDemo(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
