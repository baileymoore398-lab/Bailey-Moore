// RouteForge advertisement generator.
// Renders on-brand social ad creatives to PNG using the pre-installed Chromium.
//   node marketing/ads/generate_ads.mjs
// Output: marketing/ads/out/*.png
//
// Brand: bg #0c0e0a · accent #2ecf6e · logo gradient #34d977→#1c9e57 · control #f97316
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
const { chromium } = pw;
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
mkdirSync(OUT, { recursive: true });

const DOMAIN = "routeforge.world";

// Inline RouteForge logo mark (matches frontend/public/logo-mark.svg).
const MARK = (size = 96) => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="RouteForge">
  <defs><linearGradient id="rfg" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
    <stop stop-color="#34d977"/><stop offset="1" stop-color="#1c9e57"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#rfg)"/>
  <path d="M7 45 Q21 37 32 43 T57 39" fill="none" stroke="#0b3a1f" stroke-opacity="0.28" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M15 50 L26 31 L38 41 L49 17" fill="none" stroke="#0a1a10" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 50 L26 31 L38 41 L49 17" fill="none" stroke="#ffffff" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="15" cy="50" r="4.6" fill="#ffffff"/><circle cx="15" cy="50" r="2" fill="#1c9e57"/>
  <circle cx="49" cy="17" r="7.5" fill="none" stroke="#f97316" stroke-width="3.6"/>
  <circle cx="49" cy="17" r="2.7" fill="#f97316"/>
</svg>`;

// Faint topographic contour backdrop — nods to the orienteering map theme.
const CONTOURS = (w, h, opacity = 0.06) => {
  let paths = "";
  const rings = 7;
  for (let i = 0; i < rings; i++) {
    const cx = w * 0.72, cy = h * 0.32;
    const rx = 120 + i * 90, ry = 90 + i * 70;
    paths += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2ecf6e" stroke-width="2" transform="rotate(-18 ${cx} ${cy})"/>`;
  }
  for (let i = 0; i < rings; i++) {
    const cx = w * 0.18, cy = h * 0.82;
    const rx = 90 + i * 80, ry = 70 + i * 60;
    paths += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2ecf6e" stroke-width="2" transform="rotate(24 ${cx} ${cy})"/>`;
  }
  return `<svg width="${w}" height="${h}" style="position:absolute;inset:0;opacity:${opacity}" xmlns="http://www.w3.org/2000/svg">${paths}</svg>`;
};

// A stylised race-route line with control markers — the visual signature.
const ROUTE = (w, h) => {
  const y = h * 0.5;
  return `<svg width="${w}" height="${h}" style="position:absolute;inset:0;opacity:0.9" xmlns="http://www.w3.org/2000/svg">
    <path d="M${w * 0.08} ${y + 90} L${w * 0.26} ${y - 60} L${w * 0.44} ${y + 40} L${w * 0.63} ${y - 90} L${w * 0.82} ${y - 10} L${w * 0.94} ${y - 120}"
      fill="none" stroke="#2ecf6e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 16" stroke-opacity="0.55"/>
  </svg>`;
};

const CHIP = (t) =>
  `<span style="display:inline-flex;align-items:center;gap:10px;background:rgba(46,207,110,.12);border:1px solid rgba(46,207,110,.35);color:#bff3d4;border-radius:999px;padding:14px 24px;font-size:30px;font-weight:600;white-space:nowrap"><span style="width:10px;height:10px;border-radius:50%;background:#2ecf6e;display:inline-block"></span>${t}</span>`;

const WORDMARK = (fs = 40) =>
  `<span style="font-size:${fs}px;font-weight:800;letter-spacing:-.5px"><span style="color:#fff">Route</span><span style="color:#2ecf6e">Forge</span></span>`;

const PAGE = (w, h, inner, pad = 90) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${w}px;height:${h}px;overflow:hidden}
  body{font-family:Inter,system-ui,-apple-system,sans-serif;
    background:radial-gradient(120% 90% at 78% 8%, #12351f 0%, #0c0e0a 46%, #08090a 100%);
    color:#fff;position:relative}
  .frame{position:absolute;inset:0;padding:${pad}px;display:flex;flex-direction:column}
  .accentbar{position:absolute;left:0;top:0;bottom:0;width:14px;background:linear-gradient(180deg,#34d977,#1c9e57)}
  h1{font-weight:900;letter-spacing:-1.5px;line-height:1.02}
  .sub{color:#9fb4a6;line-height:1.35}
  .url{display:inline-flex;align-items:center;gap:14px;color:#2ecf6e;font-weight:800}
</style></head><body>
  ${CONTOURS(w, h)}
  <div class="accentbar"></div>
  <div class="frame">${inner}</div>
</body></html>`;

// ---- Ad definitions ---------------------------------------------------------
const ads = [];

// 1 — Instagram square: hero brand + tagline + feature chips
ads.push({
  name: "01-square-hero",
  w: 1080, h: 1080,
  html: PAGE(1080, 1080, `
    <div style="display:flex;align-items:center;gap:26px">${MARK(84)}${WORDMARK(52)}</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:34px">
      <h1 style="font-size:104px">Forge a<br>faster route.</h1>
      <p class="sub" style="font-size:40px;max-width:820px">AI race analysis for orienteering, MTBO, rogaining &amp; trail running. See exactly where you lost time — and how to get it back.</p>
      <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:8px">
        ${CHIP("AI coach")}${CHIP("Interactive replay")}${CHIP("Strava import")}${CHIP("Split analysis")}
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span class="url" style="font-size:44px">▸ ${DOMAIN}</span>
      <span style="font-size:30px;color:#7c8b80;font-weight:600">Free to start</span>
    </div>
  `),
});

// 2 — Story / Reel: vertical, benefit-led
ads.push({
  name: "02-story-timeloss",
  w: 1080, h: 1920,
  html: PAGE(1080, 1920, `
    ${ROUTE(1080, 1920)}
    <div style="display:flex;align-items:center;gap:24px">${MARK(78)}${WORDMARK(46)}</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:44px">
      <span style="font-size:34px;font-weight:700;color:#2ecf6e;letter-spacing:2px;text-transform:uppercase">Every race has a story</span>
      <h1 style="font-size:128px">Know exactly<br>where you<br>lost time.</h1>
      <p class="sub" style="font-size:46px;max-width:860px">Upload your GPS or paste your WinSplits. RouteForge replays the race, scores every leg, and your AI coach tells you what to fix.</p>
      <div style="display:flex;flex-direction:column;gap:22px;margin-top:12px">
        ${CHIP("Leg-by-leg time-loss")}${CHIP("Route-choice replay")}${CHIP("Personal AI coach")}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px">
      <div style="background:#2ecf6e;color:#06210f;font-size:46px;font-weight:900;text-align:center;border-radius:20px;padding:30px">Analyse your race free →</div>
      <span class="url" style="font-size:48px;justify-content:center">${DOMAIN}</span>
    </div>
  `, 80),
});

// 3 — Facebook / link landscape (1200×630, OG-safe)
ads.push({
  name: "03-landscape-banner",
  w: 1200, h: 630,
  html: PAGE(1200, 630, `
    <div style="flex:1;display:flex;align-items:center;gap:56px">
      <div style="flex:1;display:flex;flex-direction:column;gap:26px">
        <div style="display:flex;align-items:center;gap:20px">${MARK(66)}${WORDMARK(40)}</div>
        <h1 style="font-size:74px">Forge a faster route.<br><span style="color:#2ecf6e">Learn from every race.</span></h1>
        <p class="sub" style="font-size:28px;max-width:640px">AI race analysis, interactive replay &amp; a personal coach for orienteering and endurance sport.</p>
        <span class="url" style="font-size:32px">▸ ${DOMAIN}</span>
      </div>
      <div style="width:300px;height:300px;flex:none;display:flex;align-items:center;justify-content:center;background:rgba(46,207,110,.08);border:1px solid rgba(46,207,110,.25);border-radius:32px">${MARK(190)}</div>
    </div>
  `, 70),
});

// 4 — Instagram square: feature grid / "what you get"
ads.push({
  name: "04-square-features",
  w: 1080, h: 1080,
  html: PAGE(1080, 1080, `
    <div style="display:flex;align-items:center;gap:24px">${MARK(72)}${WORDMARK(44)}</div>
    <h1 style="font-size:76px;margin-top:40px">Turn your GPS<br>into a coach.</h1>
    <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:26px;margin-top:48px">
      ${[
        ["◎", "Race replay", "Watch your route back, leg by leg"],
        ["◈", "Time-loss map", "Spot the exact legs that cost you"],
        ["✦", "AI coach", "Plain-English fixes for next time"],
        ["⟳", "Strava + WinSplits", "Import in one tap, or paste splits"],
      ].map(([ic, t, d]) => `
        <div style="background:rgba(255,255,255,.04);border:1px solid rgba(46,207,110,.2);border-radius:24px;padding:38px;display:flex;flex-direction:column;gap:16px">
          <span style="font-size:56px;color:#2ecf6e">${ic}</span>
          <span style="font-size:38px;font-weight:800">${t}</span>
          <span class="sub" style="font-size:27px">${d}</span>
        </div>`).join("")}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:44px">
      <span class="url" style="font-size:40px">▸ ${DOMAIN}</span>
      <span style="font-size:28px;color:#7c8b80;font-weight:600">Free · no card needed</span>
    </div>
  `),
});

// 5 — Instagram square: bold CTA / launch
ads.push({
  name: "05-square-cta",
  w: 1080, h: 1080,
  html: PAGE(1080, 1080, `
    ${ROUTE(1080, 1080)}
    <div style="display:flex;align-items:center;gap:24px">${MARK(72)}${WORDMARK(44)}</div>
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:40px">
      <span style="font-size:32px;font-weight:700;color:#2ecf6e;letter-spacing:2px;text-transform:uppercase">Now live</span>
      <h1 style="font-size:118px">Analyse<br>your race<br>in minutes.</h1>
      <p class="sub" style="font-size:40px;max-width:800px">Upload a track, get a full breakdown, replay and coaching — instantly, and free to start.</p>
      <div style="background:#2ecf6e;color:#06210f;font-size:44px;font-weight:900;border-radius:18px;padding:28px 52px">Try it at ${DOMAIN}</div>
    </div>
  `),
});

// ---- Render -----------------------------------------------------------------
const browser = await chromium.launch();
const index = [];
for (const ad of ads) {
  const page = await browser.newPage({ viewport: { width: ad.w, height: ad.h }, deviceScaleFactor: 2 });
  await page.setContent(ad.html, { waitUntil: "networkidle" });
  await page.waitForTimeout(350); // let webfont settle
  const file = join(OUT, `${ad.name}.png`);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: ad.w, height: ad.h } });
  await page.close();
  index.push({ file: `${ad.name}.png`, size: `${ad.w}×${ad.h}` });
  console.log(`✓ ${ad.name}.png  (${ad.w}×${ad.h})`);
}
await browser.close();
writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 2));
console.log(`\nDone — ${ads.length} ads in ${OUT}`);
