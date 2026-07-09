#!/usr/bin/env python3
"""Procedurally compose the 30s ad backing track (royalty-free by construction).

Synthesizes an upbeat electronic track — kick, hats, sidechained bass, 16th-note
arp, and pads — in A minor at 124 BPM, with section energy that follows the
video's scenes (soft logo intro, build through the steps, peak at the stat
reveal, pulled back for the coach card, full for the CTA, fade-out).

    python3 marketing/ads/generate_music.py   ->  marketing/ads/out/music-30.wav

Pure numpy; no samples, no downloads — safe to use commercially.
"""
import struct
import wave
from pathlib import Path

import numpy as np

SR = 44100
DUR = 30.0
BPM = 124.0
BEAT = 60.0 / BPM                      # 0.4839 s
N = int(SR * DUR)
t = np.arange(N) / SR

rng = np.random.default_rng(7)

# ---------------------------------------------------------------- helpers
def env_exp(n, decay):
    """Exponential decay envelope of n samples."""
    return np.exp(-np.arange(n) / (SR * decay))

def place(buf, start_s, sig):
    """Add sig into buf at start_s seconds (clipped to buffer end)."""
    i = int(start_s * SR)
    if i >= N:
        return
    m = min(len(sig), N - i)
    buf[i:i + m] += sig[:m]

def lowpass(x, alpha):
    """One-pole lowpass (cheap, good enough for synth tones)."""
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc += alpha * (v - acc)
        y[i] = acc
    return y

# Section energy automation (by scene): times -> gain multipliers.
# intro | hook/steps | route | stat peak | coach | disciplines+CTA | fade handled at mux
SECTIONS = [(0.0, 0.45), (2.9, 0.75), (10.9, 0.9), (15.5, 1.0), (20.4, 0.8), (25.2, 1.0)]
def section_gain(ts):
    g = np.full_like(ts, SECTIONS[-1][1])
    for (t0, g0), (t1, g1) in zip(SECTIONS, SECTIONS[1:]):
        m = (ts >= t0) & (ts < t1)
        # smooth 0.4s crossfade into each section
        x = np.clip((ts[m] - t0) / 0.4, 0, 1)
        g[m] = g0 + (g1 - g0) * 0  # hold section level; fades below
        g[m] = g0
    # smooth the steps with a moving average (~0.3s)
    k = int(0.3 * SR)
    kernel = np.ones(k) / k
    return np.convolve(g, kernel, mode="same")

# ---------------------------------------------------------------- notes
A1, C2, D2, E2, F1, G1 = 55.0, 65.41, 73.42, 82.41, 43.65, 49.0
# Am – F – C – G progression, one chord per bar (4 beats), repeated.
CHORDS = [
    {"root": A1, "triad": [220.0, 261.63, 329.63]},   # A3 C4 E4
    {"root": F1, "triad": [174.61, 220.0, 261.63]},   # F3 A3 C4
    {"root": C2, "triad": [261.63, 329.63, 392.0]},   # C4 E4 G4
    {"root": G1, "triad": [196.0, 246.94, 293.66]},   # G3 B3 D4
]
BAR = 4 * BEAT
n_bars = int(DUR / BAR) + 1

# ---------------------------------------------------------------- drums
kick = np.zeros(N)
hat = np.zeros(N)
n_beats = int(DUR / BEAT) + 1
for b in range(n_beats):
    ts0 = b * BEAT
    if ts0 < 2.9:                       # no drums under the logo intro
        continue
    # Kick: 4-on-the-floor, pitch sweep 160->45 Hz.
    n = int(0.30 * SR)
    tt = np.arange(n) / SR
    f = 45 + 115 * np.exp(-tt * 28)
    kick_sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.09) * 1.0
    place(kick, ts0, kick_sig)
    # Hats: offbeat 8ths, short noise bursts.
    for off, g in ((0.5, 0.32), (0.25, 0.10), (0.75, 0.10)):
        if ts0 < 10.9 and off != 0.5:   # 16th hats only from the route scene
            continue
        n = int(0.05 * SR)
        noise = rng.standard_normal(n)
        noise = noise - lowpass(noise, 0.25)          # crude highpass
        place(hat, ts0 + off * BEAT, noise * env_exp(n, 0.012) * g)

# ---------------------------------------------------------------- bass
bass = np.zeros(N)
for bar in range(n_bars):
    ch = CHORDS[bar % 4]
    ts0 = bar * BAR
    for eighth in range(8):
        s = ts0 + eighth * BEAT / 2
        if s >= DUR:
            break
        n = int(BEAT / 2 * SR * 0.95)
        tt = np.arange(n) / SR
        f0 = ch["root"] * (2 if eighth in (3, 7) else 1)
        sig = np.sin(2 * np.pi * f0 * tt) + 0.4 * np.sin(2 * np.pi * 2 * f0 * tt) \
            + 0.15 * np.sign(np.sin(2 * np.pi * f0 * tt)) * 0.5
        sig *= env_exp(n, 0.14) * 0.5
        place(bass, s, sig)

# ---------------------------------------------------------------- arp (16ths)
arp = np.zeros(N)
for bar in range(n_bars):
    ch = CHORDS[bar % 4]
    seq = [ch["triad"][0], ch["triad"][1], ch["triad"][2], ch["triad"][1] * 2]
    ts0 = bar * BAR
    for six in range(16):
        s = ts0 + six * BEAT / 4
        if s >= DUR or s < 1.0:
            continue
        f0 = seq[six % 4] * (2 if (six // 4) % 2 else 1)
        n = int(BEAT / 4 * SR * 0.9)
        tt = np.arange(n) / SR
        sig = (np.sign(np.sin(2 * np.pi * f0 * tt)) * 0.3 + np.sin(2 * np.pi * f0 * tt) * 0.7)
        sig = sig * env_exp(n, 0.05) * 0.16
        place(arp, s, sig)
arp = lowpass(arp, 0.18)
# simple echo for space
d = int(BEAT * 0.75 * SR)
arp[d:] += arp[:-d] * 0.3

# ---------------------------------------------------------------- pads
pad = np.zeros(N)
for bar in range(n_bars):
    ch = CHORDS[bar % 4]
    ts0 = bar * BAR
    n = int(min(BAR * 1.05, DUR - ts0) * SR)
    if n <= 0:
        continue
    tt = np.arange(n) / SR
    sig = np.zeros(n)
    for f0 in ch["triad"]:
        for det in (0.997, 1.0, 1.004):               # detuned saw-ish layers
            ph = 2 * np.pi * f0 * det * tt
            sig += (np.sin(ph) + 0.3 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph))
    a = np.minimum(tt / 0.6, 1.0) * np.minimum((n / SR - tt) / 0.8, 1.0)  # slow AR
    place(pad, ts0, sig * a * 0.028)
pad = lowpass(pad, 0.08)

# ---------------------------------------------------------------- sidechain pump
pump = np.ones(N)
for b in range(n_beats):
    s = int(b * BEAT * SR)
    if b * BEAT < 2.9:
        continue
    n = int(0.22 * SR)
    if s >= N:
        break
    m = min(n, N - s)
    pump[s:s + m] *= 0.45 + 0.55 * (np.arange(m) / m) ** 1.5

mix = kick * 0.9 + hat * 0.8 + (bass * 0.8 + arp + pad) * pump
mix *= section_gain(t)

# gentle master fade-out over the last 1.8 s
fade = np.ones(N)
nf = int(1.8 * SR)
fade[-nf:] = np.linspace(1, 0, nf) ** 1.2
mix *= fade

# soft-clip & normalise to -1 dBFS
mix = np.tanh(mix * 1.4)
mix *= (10 ** (-1 / 20)) / np.max(np.abs(mix))

out = Path(__file__).parent / "out" / "music-30.wav"
out.parent.mkdir(exist_ok=True)
pcm = (mix * 32767).astype(np.int16)
with wave.open(str(out), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f"wrote {out} ({DUR}s @ {SR}Hz)")
