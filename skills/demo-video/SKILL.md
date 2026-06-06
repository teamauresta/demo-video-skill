---
name: demo-video
description: End-to-end pipeline for producing narrated product-demo videos of any website or web app — Playwright screen recording with an animated cursor and timestamp marks, neural TTS narration (edge-tts), automatic narration-to-video sync scheduling with margin verification, music bed with sidechain ducking, b-roll bookends with crossfades, and ffmpeg assembly to a broadcast-loudness mp4. Use this whenever the user wants a demo video, walkthrough video, screen recording with voiceover, product video, client-facing video of a site/app, a backup video for a live demo, or asks to re-record/update/re-narrate an existing demo video. Also use it when they ask to "add narration", "add music", or "fix sync" on a screen recording.
---

# Demo Video Pipeline

Produce a 2–3 minute narrated product film of a website: cinematic b-roll open,
screen walkthrough with a visible animated cursor, branded captions, neural
voiceover that provably stays in sync, ducked music, broadcast loudness.

The pipeline's core idea: **measure both sides of sync**. The recorder logs a
timestamp (`MARK <seconds> <beat>`) at every story beat; ffprobe measures every
narration clip. A schedule is only rendered if every line ends before the next
visual beat (the margin audit). Never tune sync by ear.

## Phase 0 — Prerequisites

- A project with Playwright installed (import from its `node_modules`)
- `ffmpeg`/`ffprobe` (or Docker), `pip3 install --user edge-tts` — note: pip's
  `--user` bin dir (e.g. `~/Library/Python/3.x/bin` on macOS) is usually NOT on
  PATH; call it by full path or export PATH first, don't conclude it's missing
- The target site reachable; demo accounts/data staged

## Phase 1 — Storyboard (where the film is won or lost)

Read `references/storyboarding.md` and work through it BEFORE any code. The
essentials: declare audience/goal/thesis; pick a narrative shape (problem→
solution→proof→CTA for products, thesis-tour for brand sites); write the
narration as ONE flowing monologue first, then split into beats; every beat
needs a "what changes on screen" entry (state changes > interactions > reveals —
never "scroll past static section"); narration must ADD to the screen, never
read its headings; vary pacing (hook ≤5s, quick montage beats, long dwells);
end on a CTA. 10–14 beats, ≤2:15.

## Phase 1.5 — Mode gate: capture or synthesize?

This pipeline is the REAL-CAPTURE path: right for live app UIs, browser
storefronts, anything with state the viewer should trust. But when the demo
content is fully deterministic — terminal/CLI sessions, install walkthroughs,
config flows — a SYNTHETIC render (Remotion terminal scene or similar) beats
capture: pixel-perfect, privacy-safe, frame-accurate to narration, identical
output on every run. Don't burn takes recording something a renderer could
synthesize. (OpenMontage's screen-demo pipeline implements the synthetic path
if one is needed: github.com/calesthio/OpenMontage.)

## Phase 2 — The recorder

Copy `examples/storefront-record.mjs` and adapt. It already implements:
- 1920×1080 capture (`viewport` + `recordVideo.size`)
- **virtual cursor + click ripples** (headless capture shows no mouse — without
  this viewers can't tell what's being clicked); use `glideClick(locator)` for
  every visible click and `nav(url)` instead of `page.goto`
- full-screen brand cards for the bookends, **lower-third straps** for mid-video
  act titles (`caption(...)` / `strap(...)`)
- cinematic eased scrolling (`drift(y)`), human-paced typing (`type(sel, text)`)
- `mark('<beat>')` at every narration cue — the sync system depends on these

Site-state gotchas that have bitten before: dismiss age gates/newsletter popups
via their own buttons (CSS-nuking wrappers can blank the page); pre-warm any
slow API the demo touches (live shipping/pricing quotes) so waits look intentional;
batch form fills that trigger recalculation so the UI doesn't spinner-churn on
camera (type the personal fields, `fill()` the recalc-triggering ones, blur once).

## Phase 3 — Record & convert

```bash
node record.mjs | tee marks.txt | grep MARK     # beats timeline
ffmpeg -y -i page@*.webm -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p -r 25 take.mp4
```
Recordings mutate site data (orders, carts) — note what to clean up afterwards.

## Phase 4 — Narration

One mp3 per beat, named exactly after its mark:
```bash
edge-tts --voice en-US-AndrewMultilingualNeural --text "…" --write-media vo/<beat>.mp3
```
Pick the voice tier by stakes, not habit:

| Tier | When | Notes |
|---|---|---|
| edge-tts Multilingual (Andrew/Ava) | default — internal, demos, drafts | free via an UNOFFICIAL Microsoft endpoint: outside MS terms for programmatic use, no usage licence on the audio, may break without notice — low-stakes for drafts; anything published or sold needs a licensed tier below |
| edge-tts accent voices (en-AU-Natasha…) | accent matters more than naturalness | noticeably more synthetic |
| ElevenLabs API | public/marketing use | paid — get explicit budget approval BEFORE generating; near-human |
| Human voice over the silent cut | personal pitches | best for audiences who'll meet the narrator; mix via the music path |

If a word is mispronounced, respell it phonetically in the TTS text only.

## Phase 5 — Schedule, verify, mix (the deterministic part)

```bash
python3 scripts/sync_mix.py --marks marks.txt --vo-dir vo --video take.mp4 \
  --music vo/music.mp3 --out narrated.mp4
```
Prints the margin table and **refuses to render overruns**. To fix a violation,
don't rush the voice — **stretch the video dwell at the flagged beat** (longer
`pause()`/caption) and re-record; the pipeline self-corrects from fresh marks.

## Phase 6 — B-roll bookends (optional, biggest "production" jump)

Source free clips (Mixkit serves direct mp4s; Pexels needs a rendered page),
pre-render them to the take's exact spec, then let sync_mix do the crossfades:
```bash
ffmpeg -y -i clip.mp4 -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=25,setsar=1" -t 5.5 -an -c:v libx264 -crf 20 -pix_fmt yuv420p seg-intro.mp4
# outro: same, plus drawtext end-title (fontfile=<brand>.ttf from google/fonts GitHub)
python3 scripts/sync_mix.py ... --intro seg-intro.mp4 --outro seg-outro.mp4
```
Voice offsets shift automatically by (intro − xfade). Pre-rendering segments to
uniform spec is what makes xfade reliable — see references/pipeline.md for the
ffmpeg traps (timebases, CFR, pad reuse) if composing graphs manually.

## Production discipline (learned at scale)

- **Revision cap**: if the same beat fails the margin audit twice, stop patching
  pauses — the storyboard is wrong (line too long for what the screen shows).
  Restructure the beat instead of taking a sixth take.
- **Budget gate**: anything paid (ElevenLabs, stock licences, video-gen APIs)
  needs the user's explicit OK with a number attached, before spending.
- **Artifact contract**: keep `marks.txt`, `vo/*.mp3`, `seg-*.mp4`, and the
  converted take as durable workspace artifacts — every later stage re-runs
  from them without redoing earlier ones (bookend swaps and remixes cost ~90s;
  protect that property).

## Phase 7 — QA gates before delivering

- Extract frames at each beat (`ffmpeg -ss <t> -frames:v 1`) and LOOK at them —
  broken UI states (empty quote lists, error banners) hide in motion
- Re-read the margin table; confirm audio stream exists and total duration
- Licensing: music/b-roll credits recorded wherever the project tracks attribution
- Clean up data the recording created on the site

For the full runbook with every known trap and fix, read
`references/pipeline.md`. Known-good working examples: `examples/storefront-record.mjs`
(+ `storefront-prewarm.mjs`, a product demo with login/checkout) and
`examples/brand-thesis-tour.mjs` (a corporate thesis tour) — both distilled from
real client productions.
