// RouteForge 30-second TEASER ad (vertical 1080×1920) — the domain is shown but
// blurred beyond reading, with a "Releasing soon" lock over it. For hype posts
// before/around launch.
//   node marketing/ads/generate_video_teaser.mjs
// Output: marketing/ads/out/routeforge-teaser-30.mp4
import pw from "/opt/node22/lib/node_modules/playwright/index.js";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = pw;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "out");
const FRAMES = join(__dirname, ".frames_teaser");
mkdirSync(OUT, { recursive: true });
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const FFMPEG = "ffmpeg";
const W = 1080, H = 1920, FPS = 30, DURATION = 30.0;
const FRAME_COUNT = Math.round(FPS * DURATION);

const MARK = (size) => `
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
const WORD = (fs) => `<span style="font-size:${fs}px;font-weight:800;letter-spacing:-.5px"><span style="color:#fff">Route</span><span style="color:#2ecf6e">Forge</span></span>`;
const CHIP = (t) => `<span style="display:inline-flex;align-items:center;gap:14px;background:rgba(46,207,110,.12);border:1px solid rgba(46,207,110,.35);color:#bff3d4;border-radius:999px;padding:20px 34px;font-size:38px;font-weight:700"><span style="width:12px;height:12px;border-radius:50%;background:#2ecf6e"></span>${t}</span>`;
const STEP = (n, title, sub) => `<div class="step" style="display:flex;align-items:center;gap:34px;width:100%">
  <span style="width:96px;height:96px;flex:none;border-radius:24px;background:linear-gradient(135deg,#34d977,#1c9e57);color:#06210f;font-size:52px;font-weight:900;display:flex;align-items:center;justify-content:center">${n}</span>
  <div style="display:flex;flex-direction:column;gap:8px">
    <span style="font-size:52px;font-weight:800;color:#fff">${title}</span>
    <span style="font-size:36px;color:#9fb4a6;font-weight:600">${sub}</span>
  </div></div>`;

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{font-family:Inter,system-ui,sans-serif;color:#fff;position:relative;
  background:radial-gradient(120% 80% at 78% 8%, #12351f 0%, #0c0e0a 46%, #08090a 100%)}
.accentbar{position:absolute;left:0;top:0;bottom:0;width:12px;background:linear-gradient(180deg,#34d977,#1c9e57)}
.layer{position:absolute;inset:0;will-change:opacity,transform}
.center{display:flex;align-items:center;justify-content:center;flex-direction:column}
h1{font-weight:900;letter-spacing:-1.5px;line-height:1.02;text-align:center}
.hdr{position:absolute;top:70px;left:80px;display:flex;align-items:center;gap:20px}
.eyebrow{font-size:34px;font-weight:700;color:#2ecf6e;letter-spacing:3px;text-transform:uppercase}
</style></head><body>
  <div class="accentbar"></div>
  <div id="introLogo" class="layer center" style="gap:36px">${MARK(190)}${WORD(78)}</div>
  <div id="hdrLogo" class="hdr">${MARK(64)}${WORD(38)}</div>

  <!-- 1 hook -->
  <div id="sHook" class="layer center" style="padding:0 70px">
    <span id="hookEyebrow" class="eyebrow" style="margin-bottom:36px">Something is coming</span>
    <h1 style="font-size:116px"><span class="hk">Know exactly</span><br><span class="hk">where you</span><br><span class="hk">lost time.</span></h1>
  </div>

  <!-- 2 how it works -->
  <div id="sSteps" class="layer center" style="padding:0 90px;align-items:flex-start;gap:60px">
    <h1 style="font-size:78px;text-align:left;align-self:flex-start">How it'll work</h1>
    <div style="display:flex;flex-direction:column;gap:54px;width:100%">
      ${STEP(1, "Upload your race", "GPX/GPS, or paste your WinSplits")}
      ${STEP(2, "Get instant analysis", "Every leg scored — no guesswork")}
      ${STEP(3, "Know what to fix", "Plain-English coaching for next time")}
    </div>
  </div>

  <!-- 3 route draws -->
  <div id="sRoute" class="layer center" style="gap:60px;padding:0 60px">
    <h1 style="font-size:96px">See every<br>second.</h1>
    <svg id="routeSvg" width="900" height="440" viewBox="0 0 900 440">
      <path id="ghost" d="M40 360 L200 120 L360 260 L520 90 L680 220 L860 60" fill="none" stroke="#243a2c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path id="route" d="M40 360 L200 120 L360 260 L520 90 L680 220 L860 60" fill="none" stroke="#2ecf6e" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle id="ctrl" cx="860" cy="60" r="20" fill="none" stroke="#f97316" stroke-width="8"/>
      <circle cx="860" cy="60" r="7" fill="#f97316"/>
      <circle cx="40" cy="360" r="11" fill="#fff"/>
    </svg>
    <span style="font-size:44px;color:#9fb4a6;font-weight:600">Replay every leg · spot the time you lost</span>
  </div>

  <!-- 4 stat reveal -->
  <div id="sStat" class="layer center" style="gap:20px;padding:0 70px">
    <span class="eyebrow" style="margin-bottom:20px">Down to the second</span>
    <span style="font-size:56px;font-weight:700;color:#e7ebdd">You lost</span>
    <div style="display:flex;align-items:baseline;gap:8px">
      <span id="statNum" style="font-size:280px;font-weight:900;color:#2ecf6e;line-height:1;letter-spacing:-4px">0</span>
      <span style="font-size:90px;font-weight:900;color:#2ecf6e">s</span>
    </div>
    <span style="font-size:56px;font-weight:800;color:#fff">on leg 4.</span>
    <span style="font-size:40px;color:#9fb4a6;font-weight:600;margin-top:20px">Soon you'll know exactly where — and why.</span>
  </div>

  <!-- 5 AI coach -->
  <div id="sCoach" class="layer center" style="padding:0 70px;gap:52px">
    <h1 style="font-size:84px">Your own<br>AI coach.</h1>
    <div id="coachCard" style="background:rgba(255,255,255,.045);border:1px solid rgba(46,207,110,.28);border-radius:32px;padding:52px;max-width:880px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.4)">
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:28px">
        <span style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#34d977,#1c9e57);display:flex;align-items:center;justify-content:center;font-size:30px">✦</span>
        <span style="font-size:38px;font-weight:800;color:#2ecf6e">RouteForge Coach</span>
      </div>
      <p style="font-size:46px;line-height:1.4;color:#eaf6ee;font-weight:600">"You overshot the control on leg 4. Next time attack from the track bend and check your compass before the reentrant."</p>
    </div>
  </div>

  <!-- 6 disciplines -->
  <div id="sDisc" class="layer center" style="gap:50px;padding:0 60px">
    <h1 style="font-size:92px">Built for<br>your sport.</h1>
    <div style="display:flex;flex-wrap:wrap;gap:22px;justify-content:center">
      ${CHIP("Orienteering")}${CHIP("MTBO")}${CHIP("Rogaining")}${CHIP("Trail running")}
    </div>
  </div>

  <!-- 7 teaser CTA: domain shown but blurred, lock pill on top -->
  <div id="sCTA" class="layer center" style="gap:46px;padding:0 70px">
    <span class="eyebrow">Something big is coming</span>
    <h1 style="font-size:100px">Know your race<br>like never before.</h1>
    <div style="position:relative;display:flex;align-items:center;justify-content:center;margin-top:10px">
      <span style="font-size:64px;font-weight:900;color:#2ecf6e;filter:blur(28px);user-select:none">routeforge.■■■■■</span>
      <div id="lockPill" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">
        <span style="display:inline-flex;align-items:center;gap:16px;background:rgba(8,10,6,.72);border:2px dashed rgba(46,207,110,.55);border-radius:20px;padding:22px 44px;font-size:44px;font-weight:900;color:#fff;white-space:nowrap">🔒 Releasing soon</span>
      </div>
    </div>
    <span style="font-size:40px;color:#9fb4a6;font-weight:600">Follow so you don't miss the launch.</span>
  </div>

<script>
  const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
  const ss = (a, b, t) => { const x = clamp01((t - a) / (b - a)); return x * x * (3 - 2 * x); };
  const env = (t, ai, bi, ao, bo) => Math.min(ss(ai, bi, t), 1 - ss(ao, bo, t));
  const routeEl = document.getElementById('route');
  const LEN = routeEl.getTotalLength();
  routeEl.style.strokeDasharray = LEN;
  const set = (id, o, tr) => { const e = document.getElementById(id); e.style.opacity = o; if (tr !== undefined) e.style.transform = tr; };
  const rise = (sel, t, start, gap) => document.querySelectorAll(sel).forEach((el, i) => {
    const p = ss(start + i * gap, start + 0.6 + i * gap, t);
    el.style.display = 'inline-block'; el.style.opacity = p; el.style.transform = 'translateY(' + (46 * (1 - p)) + 'px)';
  });

  window.render = (t) => {
    const introIn = ss(0.15, 1.0, t);
    set('introLogo', introIn * (1 - ss(2.0, 2.6, t)), 'scale(' + (0.86 + 0.14 * introIn) + ')');
    set('hdrLogo', ss(2.1, 2.7, t), 'translateY(' + (18 * (1 - ss(2.1, 2.7, t))) + 'px)');

    set('sHook', env(t, 2.3, 3.0, 5.0, 5.6));
    document.getElementById('hookEyebrow').style.opacity = ss(2.2, 2.7, t);
    rise('.hk', t, 2.35, 0.14);

    set('sSteps', env(t, 5.3, 5.9, 10.3, 10.9));
    rise('.step', t, 5.7, 0.42);

    set('sRoute', env(t, 10.6, 11.2, 15.2, 15.8));
    const draw = ss(10.9, 13.6, t);
    routeEl.style.strokeDashoffset = LEN * (1 - draw);
    const pulse = draw >= 1 ? (1 + 0.18 * Math.abs(Math.sin((t - 13.6) * 6))) : 1;
    document.getElementById('ctrl').setAttribute('r', 20 * (draw > 0.98 ? pulse : 1));
    document.getElementById('ctrl').style.opacity = ss(13.4, 13.7, t);

    set('sStat', env(t, 15.5, 16.1, 19.8, 20.4));
    document.getElementById('statNum').textContent = String(Math.round(48 * ss(16.2, 18.4, t)));

    set('sCoach', env(t, 20.1, 20.7, 24.6, 25.2));
    set('coachCard', 1, 'translateY(' + (40 * (1 - ss(20.4, 21.2, t))) + 'px) scale(' + (0.96 + 0.04 * ss(20.4, 21.2, t)) + ')');

    set('sDisc', env(t, 24.9, 25.5, 27.0, 27.6));

    set('sCTA', ss(27.3, 28.0, t));
    // Lock pill pops in with a small overshoot after the blurred domain appears.
    const pop = ss(28.0, 28.6, t);
    set('lockPill', pop, 'scale(' + (0.8 + 0.25 * pop - 0.05 * ss(28.6, 29.0, t)) + ')');
  };
  window.render(0);
</script>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await page.setContent(HTML, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
process.stdout.write(`Rendering ${FRAME_COUNT} frames`);
for (let f = 0; f < FRAME_COUNT; f++) {
  await page.evaluate((tt) => window.render(tt), f / FPS);
  await page.screenshot({ path: join(FRAMES, `f${String(f).padStart(4, "0")}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  if (f % 60 === 0) process.stdout.write(".");
}
process.stdout.write(" done\n");
await browser.close();

const mp4 = join(OUT, "routeforge-teaser-30.mp4");
execFileSync(FFMPEG, [
  "-y", "-framerate", String(FPS), "-i", join(FRAMES, "f%04d.png"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-vf", "scale=1080:1920:flags=lanczos", "-crf", "20", "-preset", "medium", mp4,
], { stdio: ["ignore", "ignore", "inherit"] });
rmSync(FRAMES, { recursive: true, force: true });
console.log("✓ routeforge-teaser-30.mp4 (1080×1920, " + DURATION + "s)");
