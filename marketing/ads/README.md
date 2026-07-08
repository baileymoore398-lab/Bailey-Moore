# RouteForge ad kit

Ready-to-post advertisement creatives for RouteForge, rendered from
`generate_ads.mjs`. All use the real logo, brand colours (bg `#0c0e0a`,
accent `#2ecf6e`) and point at **routeforge.world**.

| File | Size | Where to use |
|------|------|--------------|
| `out/01-square-hero.png` | 1080×1080 | Instagram / Facebook feed post |
| `out/02-story-timeloss.png` | 1080×1920 | Instagram / Facebook / TikTok story or reel cover |
| `out/03-landscape-banner.png` | 1200×630 | Facebook link preview, X/Twitter card, website banner |
| `out/04-square-features.png` | 1080×1080 | Feed post — "what you get" grid |
| `out/05-square-cta.png` | 1080×1080 | Launch / call-to-action post |
| `out/routeforge-ad.mp4` | 1080×1920 · 7.6s | Short reel/story video ad |
| `out/routeforge-ad-long.mp4` | 1080×1920 · 16.6s | Longer reel with how-it-works + AI-coach story |
| `out/routeforge-ad-30.mp4` | 1080×1920 · 30s | Full 30s story: hook → steps → replay → stat → coach → disciplines → CTA |
| `out/poster-a4.png` | 2480×3508 (A4 @ 300dpi) | Printable flyer with scannable QR code |

## Suggested captions

**Feed (01 / 05):**
> 🧭 Just raced? Find out exactly where you lost time. RouteForge replays your
> route, scores every leg and gives you an AI coaching breakdown — free to try.
> 👉 routeforge.world  #orienteering #MTBO #rogaine #trailrunning

**Story (02):**
> Upload your GPS or paste your WinSplits → instant analysis. Swipe up / link in
> bio: routeforge.world

**Features (04):**
> Turn your GPS into a coach. Replay, time-loss map, AI coaching and one-tap
> Strava import. Try it free → routeforge.world

## Regenerating / editing

Edit copy or add new sizes, then run the matching generator:

```bash
node marketing/ads/generate_ads.mjs      # 5 social images  → out/*.png
node marketing/ads/generate_poster.mjs   # A4 poster + QR   → out/poster-a4.png
node marketing/ads/generate_video.mjs    # 7.6s reel      → out/routeforge-ad.mp4
node marketing/ads/generate_video_long.mjs # 16.6s reel   → out/routeforge-ad-long.mp4
```

Requirements (all preinstalled in the build/remote environment):
Playwright + Chromium, `qrcode` (poster QR), and a full `ffmpeg` with libx264
(the video encoder). `npm install` inside `marketing/` restores the `qrcode`
dependency if needed.
