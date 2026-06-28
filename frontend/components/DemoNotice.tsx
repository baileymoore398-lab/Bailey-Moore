/**
 * Prominent banner shown when a page is displaying bundled SAMPLE data because
 * the backend API could not be reached. This prevents the (very confusing)
 * situation where a user uploads a real activity but sees canned demo analysis
 * (fixed location, generic coach text) and assumes the AI is broken.
 */
export function DemoNotice({ context = "analysis" }: { context?: string }) {
  return (
    <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <div className="flex items-start gap-3">
        <span className="text-lg leading-none">⚠️</span>
        <div>
          <p className="font-semibold text-amber-100">
            Showing sample data — not your real {context}.
          </p>
          <p className="mt-1 text-amber-200/90">
            RouteForge could not reach its backend API, so this page is rendering
            a built-in demo (a fixed example track and example coaching text). The
            map location, AI report and stats here are <strong>not</strong> from
            your upload. Connect the backend to see real results:
          </p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-amber-200/90">
            <li>
              Deploy the backend (see <code>DEPLOY_QUICKSTART.md</code>) and set{" "}
              <code>NEXT_PUBLIC_API_URL</code> in your Vercel project to its URL.
            </li>
            <li>
              Add your frontend domain to the backend&apos;s{" "}
              <code>CORS_ORIGINS</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
