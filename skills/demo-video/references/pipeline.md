# Demo-Video Pipeline — Full Runbook

The long-form companion to SKILL.md. Everything here was learned the hard way on
a real client production (June 2026, five takes to final).

## Architecture

```
storyboard table
   │
record.mjs  ──────────────►  page@*.webm  +  marks.txt   (MARK <sec> <beat>)
   │  (Playwright: cursor, straps, drift, type, mark)
   ▼
ffmpeg convert (-r 25)  ──►  take.mp4
   │
edge-tts per beat  ───────►  vo/<beat>.mp3
   │
sync_mix.py  ─ schedule = max(cue, prev_end+gap)
             ─ AUDIT: every line must end ≥0.3s before next visual beat
             ─ ffmpeg: [voice bus]→asplit→(sidechain key | mix), music duck,
               optional intro/outro xfades, loudnorm -16 LUFS
   ▼
final.mp4
```

## Timing model

- The recorder is the single source of truth for WHEN things happen — `mark()`
  lines, captured via `node record.mjs | tee marks.txt`.
- Narration duration is measured with ffprobe, never estimated.
- Schedule rule: a line starts at its beat's mark (pushed later only if the
  previous line is still playing + 0.25s breathing gap).
- **Violation = line ends after the next mark.** Fix by stretching the VIDEO
  (longer dwell pause or caption at that beat), never by speeding the voice —
  rate-boosted TTS is what sounds robotic.
- Everything self-corrects on re-record: fresh marks → fresh schedule.

## Recorder details (see examples/storefront-record.mjs)

- **Virtual cursor**: `addInitScript` installs `window.__mkCursor`; a Node-side
  `glideClick(locator)` animates the dot (600ms ease), fires a ripple, then
  clicks. Re-create the cursor after each navigation (`nav()` helper keeps the
  position in a Node variable).
- **Captions**: full-screen brand card for open/close; lower-third strap
  (slide-in, 3s) for act titles. Both are injected DOM — they record perfectly.
- **drift(y)**: JS smooth-scroll ~8ms/step. Linear is fine; the win is avoiding
  instant jumps.
- **type()**: 55ms/char for "human" typing on personal fields only.
- **Spinner churn**: any field whose blur triggers recalculation (shipping,
  totals) must be `fill()`-ed in a batch with ONE blur at the end, or the order
  summary grey-flashes repeatedly on camera.
- **Popups**: click the popup's own close/confirm button. Do NOT
  `[class*="popup"]`-style CSS-nuke — broad selectors have removed page
  wrappers and produced a blank white recording.
- **Bot variance**: sites behave differently per user-agent (an age gate showed
  date inputs to Safari UAs and nothing to HeadlessChrome). Record with a real
  browser UA string, and verify gates/overlays with that same UA.
- **Pre-warm**: run a warmup script first so caches are hot (e.g. live freight
  quotes cache per destination — first call ~5s, cached <1s). Forms that need
  full data: a freight calculator may silently need suburb AND state AND
  postcode — verify the happy path renders quotes before recording.
- **Re-navigation mid-take**: `waitUntil: 'load'` fires before hydration/layout
  settles, so a scroll target measured right after a nav can be wrong even when
  the selector resolves (an SPA homepage measured 0 mid-reflow and the beat
  played over the hero). Pattern that fixes it: strap to cover the cut → nav →
  rough instant `scrollTo` → `waitForSelector` → poll `scrollHeight` until two
  samples agree → measure target → THEN `mark()` and drift. Marking after the
  page is ready costs a few silent seconds (music fills them) and the audit
  reschedules everything from the fresh marks.

## TTS

- `edge-tts --voice en-US-AndrewMultilingualNeural` (or AvaMultilingual) at
  default rate. Older neurals (Natasha/William) are noticeably more synthetic.
- Write narration as flowing sentences with commas; prosody dies on fragments.
- Phonetic respelling fixes mispronunciations (write "Acme A-I" for "AcmeAI" —
  in the TTS text only, never on screen).
- Next quality tier: ElevenLabs API, or the human records over the silent cut
  (QuickTime audio recording while playing it; mux with sync_mix's music path).

## ffmpeg traps (each cost a failed render)

1. **A filter pad feeds exactly one filter.** Reusing `[vo]` for sidechain key
   and final mix fails with "matches no streams" — `asplit` first.
2. **xfade wants matching timebases** → `settb=AVTB` on every input.
3. **xfade wants constant frame rate** → `fps=25` again AFTER the first xfade
   (its output loses CFR), and on any chain that was screen-recorded.
4. When a mega-graph keeps failing: **pre-render segments to uniform spec**
   (same size/fps/pix_fmt, `-an`) and run a minimal graph over those files.
5. Playwright webm has no audio stream; always `-map` explicitly when mixing.
6. macOS `zsh` lacks bash-5 `${var@Q}`; pass values to node scripts via files.
7. BSD vs GNU quirks: `stat -f%z`, `sed -i ''`, grep BRE alternation — prefer
   python3 for anything beyond trivial text work.

## B-roll sourcing

- **Mixkit**: server-rendered pages; asset URLs `assets.mixkit.co/videos/<id>/<id>-<res>.mp4`
  — probe 1080/720/360 with HEAD. Free for use at time of writing — verify the
  current license terms before publishing.
- **Pexels**: JS-rendered; needs Playwright to extract `videos.pexels.com/video-files/...`.
- **Wikimedia Commons**: CC drone clips, hit-or-miss quality.
- Always curate visually: build a contact sheet (base64 thumbs in one HTML,
  screenshot it) instead of reading images one by one.
- Brand fonts for drawtext end titles: `github.com/google/fonts/raw/main/ofl/<family>/`.

## Audio finishing

- Music bed at ~0.35 volume + **sidechaincompress** keyed by the voice bus
  (threshold .02, ratio 12, attack 25, release 500) — the duck is what makes it
  sound produced. A constant-low bed sounds amateur.
- **apad the voice bus to the full cut length before the sidechain.**
  sidechaincompress EOFs when either input ends, so an unpadded voice bus kills
  the music at the last narration line and the outro plays mute (looked like
  "abrupt ending" in review; the audio stream was literally shorter than the
  video). `amix,apad=whole_dur=<total>,asplit` fixes it.
- `loudnorm=I=-16:TP=-1.5:LRA=11` as the final audio filter.
- Fade music in 2.5s; fade out over the LAST ~3s so the bed carries through the
  outro to the final frame. Loop the bed (`-stream_loop -1` + input-level `-t`)
  in case it's shorter than the cut.

## QA checklist

- [ ] Margin table: ALL OK (sync_mix refuses otherwise)
- [ ] Frame-extract each beat and look — empty lists/errors hide in motion
- [ ] Audio + video stream durations within ~1s of each other
- [ ] Site cleanup: delete orders/data the recording created
- [ ] Attribution recorded for music/b-roll/fonts wherever the project tracks it
- [ ] Watch the whole thing once, with sound, before sending anywhere

## Ideas adopted from OpenMontage (github.com/calesthio/OpenMontage)

Studied 2026-06-06. An agent-driven video studio (12 pipelines, 14 video-gen
providers, stage-director orchestration). What we folded in: the synthetic-vs-
capture mode gate, voice-provider tiers, revision caps and budget gates. What
we kept ours: the marks→measure→margin-audit sync loop for real captures (their
real-capture mode syncs by post-hoc script timestamping + qualitative checklist
— ours is mechanical and refuses to render violations) and the virtual cursor
for headless captures. Candidate upstream PR if ever motivated: the marks
convention + sync audit for their playwright path. Note their AGPLv3 if any
hosted service is ever built on it.

## Deliverable set that worked well

- `final.mp4` — b-roll bookends + narration + music (the showpiece)
- `narrated.mp4` — screen-only with voice (no b-roll), for embedding
- `silent.mp4` — the live-demo fallback the presenter narrates over
