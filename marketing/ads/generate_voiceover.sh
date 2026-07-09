#!/usr/bin/env bash
# Generate a timed voiceover for the 30s RouteForge ad and mux it in.
#   bash marketing/ads/generate_voiceover.sh
# Output: marketing/ads/out/routeforge-ad-30-voice.mp4
#
# Voice is espeak-ng + the mbrola "us2" (male US) voice — an OFFLINE synthesizer,
# used because premium neural TTS (Hugging Face / ElevenLabs / OpenAI) needs
# network access that isn't available in the build environment. To use a nicer
# voice, drop replacement WAVs in place of vo_0..vo_6 and re-run the mux step,
# or regenerate with your own TTS.
set -euo pipefail
cd "$(dirname "$0")"
OUT="out"
SRC="$OUT/routeforge-ad-30.mp4"
DST="$OUT/routeforge-ad-30-voice.mp4"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Narration lines, timed to the video's scenes (start time in ms).
LINES=(
  "Know exactly where you lost time."
  "Upload your race, or paste your splits, for instant, leg by leg analysis."
  "Replay every leg, and see every second."
  "RouteForge pinpoints exactly where it cost you. Down to the second."
  "Your own A I coach tells you what to fix for next time."
  "Built for your sport."
  "Analyse your race, free, at route forge dot world."
)
DELAYS=(2900 6000 11400 16300 21000 25200 27400)
SPEEDS=(150 155 150 152 152 150 155)

for i in "${!LINES[@]}"; do
  espeak-ng -v mb-us2 -s "${SPEEDS[$i]}" -p 42 "${LINES[$i]}" -w "$TMP/vo_$i.wav"
done

# Build the filter graph: delay each line to its cue, mix, then loudness-normalise.
inputs=(); filt=""; mixlabels=""
for i in "${!LINES[@]}"; do
  inputs+=(-i "$TMP/vo_$i.wav")
  filt+="[$((i+1)):a]adelay=${DELAYS[$i]}|${DELAYS[$i]},volume=1.9[a$i];"
  mixlabels+="[a$i]"
done
filt+="${mixlabels}amix=inputs=${#LINES[@]}:normalize=0:dropout_transition=0,"
filt+="afade=t=in:st=0:d=0.05,loudnorm=I=-16:TP=-1.5:LRA=11[aout];"
# Hold the last frame ~0.9s so the closing line finishes.
filt+="[0:v]tpad=stop_mode=clone:stop_duration=0.9[vout]"

ffmpeg -y -i "$SRC" "${inputs[@]}" \
  -filter_complex "$filt" \
  -map "[vout]" -map "[aout]" \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart -crf 20 -preset medium \
  -c:a aac -b:a 160k -t 30.9 "$DST" </dev/null

echo "✓ $DST"
