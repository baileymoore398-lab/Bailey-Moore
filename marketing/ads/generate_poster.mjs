// RouteForge print poster (A4 portrait) with a scannable QR code.
//   node marketing/ads/generate_poster.mjs
// Output: marketing/ads/out/poster-a4.png  (2480×3508 ≈ 300dpi)
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import QRCode from "qrcode";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = pw;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
mkdirSync(OUT, { recursive: true });
const URL = "https://routeforge.world";
const DOMAIN = "routeforge.world";

const MARK = (size = 96) => `
<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
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

const CONTOURS = (w, h, opacity = 0.05) => {
  let p = "";
  for (let i = 0; i < 8; i++) {
    const cx = w * 0.78, cy = h * 0.2, rx = 160 + i * 110, ry = 120 + i * 85;
    p += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2ecf6e" stroke-width="2.5" transform="rotate(-18 ${cx} ${cy})"/>`;
  }
  for (let i = 0; i < 8; i++) {
    const cx = w * 0.15, cy = h * 0.9, rx = 130 + i * 100, ry = 100 + i * 78;
    p += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#2ecf6e" stroke-width="2.5" transform="rotate(22 ${cx} ${cy})"/>`;
  }
  return `<svg width="${w}" height="${h}" style="position:absolute;inset:0;opacity:${opacity}" xmlns="http://www.w3.org/2000/svg">${p}</svg>`;
};

const WORDMARK = (fs) => `<span style="font-size:${fs}px;font-weight:800;letter-spacing:-.5px"><span style="color:#fff">Route</span><span style="color:#2ecf6e">Forge</span></span>`;

const ROW = (t) => `<div style="display:flex;align-items:center;gap:26px;font-size:44px;font-weight:600;color:#dcefe3">
  <span style="width:52px;height:52px;flex:none;border-radius:14px;background:rgba(46,207,110,.14);border:1px solid rgba(46,207,110,.4);display:flex;align-items:center;justify-content:center;color:#2ecf6e;font-size:30px">✓</span>${t}</div>`;

const W = 1240, H = 1754; // ×2 device scale → 2480×3508 (A4 @ 300dpi)

const qrSvg = await QRCode.toString(URL, {
  type: "svg", margin: 1, errorCorrectionLevel: "M",
  color: { dark: "#0a1a10", light: "#ffffff" },
});

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;color:#fff;position:relative;
  background:radial-gradient(120% 80% at 80% 4%, #12351f 0%, #0c0e0a 44%, #08090a 100%)}
.accentbar{position:absolute;left:0;top:0;bottom:0;width:12px;background:linear-gradient(180deg,#34d977,#1c9e57)}
.frame{position:absolute;inset:0;padding:88px 84px;display:flex;flex-direction:column}
h1{font-weight:900;letter-spacing:-1.5px;line-height:1.0;font-size:106px}
.qrcard{background:#fff;border-radius:26px;padding:22px;width:280px;height:280px;flex:none}
.qrcard svg{width:100%;height:100%;display:block}
</style></head><body>
${CONTOURS(W, H)}
<div class="accentbar"></div>
<div class="frame">
  <div style="display:flex;align-items:center;gap:26px">${MARK(96)}${WORDMARK(60)}</div>
  <div style="margin-top:56px">
    <span style="font-size:38px;font-weight:700;color:#2ecf6e;letter-spacing:3px;text-transform:uppercase">AI race analysis</span>
    <h1 style="margin-top:24px">Forge a<br>faster route.</h1>
    <p style="margin-top:30px;font-size:43px;line-height:1.38;color:#9fb4a6;max-width:900px">
      Upload your GPS or paste your WinSplits and see exactly where you lost time —
      with a full replay and your own AI coach. For orienteering, MTBO, rogaining &amp; trail running.</p>
  </div>
  <div style="margin-top:56px;display:flex;flex-direction:column;gap:30px">
    ${ROW("Leg-by-leg time-loss breakdown")}
    ${ROW("Interactive route replay")}
    ${ROW("Personal AI coaching")}
    ${ROW("One-tap Strava &amp; WinSplits import")}
  </div>
  <div style="flex:1;min-height:60px"></div>
  <div style="display:flex;align-items:center;gap:44px;background:rgba(255,255,255,.04);border:1px solid rgba(46,207,110,.22);border-radius:32px;padding:44px">
    <div class="qrcard">${qrSvg}</div>
    <div style="display:flex;flex-direction:column;gap:14px">
      <span style="font-size:40px;font-weight:800;color:#fff">Scan to analyse<br>your race — free.</span>
      <span style="font-size:44px;font-weight:900;color:#2ecf6e">▸ ${DOMAIN}</span>
      <span style="font-size:28px;color:#7c8b80;font-weight:600">No credit card needed</span>
    </div>
  </div>
</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT, "poster-a4.png"), clip: { x: 0, y: 0, width: W, height: H } });
await browser.close();
console.log("✓ poster-a4.png (2480×3508, A4 300dpi) with scannable QR →", URL);
