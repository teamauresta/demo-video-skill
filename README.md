# demo-video — narrated product films from any website, as a Claude Code skill

Point Claude Code at a URL and get back a 2–3 minute narrated product film:
cinematic b-roll open, screen walkthrough with an animated cursor and branded
captions, neural voiceover that **provably stays in sync**, a music bed that
ducks under the voice, broadcast loudness, end-title close.

Built and battle-tested across real client productions (storefront demos,
corporate brand tours, SaaS landing pages); every trap we hit on the way is
documented in the runbook.

## The core idea: measure both sides of sync

Most screen-recording voiceovers drift because timing is tuned by ear. This
pipeline refuses to:

- the Playwright recorder logs a timestamp (`MARK <sec> <beat>`) at every
  story beat;
- ffprobe measures every narration clip;
- `scripts/sync_mix.py` schedules each line at its beat and **aborts the render
  if any line would still be talking when the next visual beat arrives** (the
  margin audit).

Fixes go the right direction: stretch the video dwell, never speed up the
voice. Generate narration *first* and size dwells to the measured durations —
recent productions pass the audit on the first take.

## Install

As a Claude Code plugin (recommended) — inside Claude Code run:

```
/plugin marketplace add teamauresta/demo-video-skill
/plugin install demo-video@demo-video-skill
```

Or as a personal skill:

```bash
git clone https://github.com/teamauresta/demo-video-skill /tmp/demo-video-skill
cp -r /tmp/demo-video-skill/skills/demo-video ~/.claude/skills/demo-video
```

Then ask Claude Code: *"create a demo video for https://yoursite.com"*. The
skill triggers on demo/walkthrough/voiceover/fix-sync requests.

### Requirements

- Node with [Playwright](https://playwright.dev) installed in any project you
  can import from
- `ffmpeg` / `ffprobe`
- `pip3 install --user edge-tts` (note: pip's `--user` bin dir is usually not
  on PATH)

## What's inside

```
.claude-plugin/                   plugin + marketplace manifests
skills/demo-video/
  SKILL.md                        the 7-phase workflow Claude follows
  scripts/sync_mix.py             the deterministic engine: schedule, margin
                                  audit, duck, crossfade bookends, loudnorm
  references/storyboarding.md     where the film is won: thesis, beats,
                                  the change test, pacing
  references/pipeline.md          full runbook — every ffmpeg trap, TTS,
                                  b-roll sourcing, QA gates
  examples/storefront-record.mjs  product demo recorder (cursor, captions,
                                  login, checkout) + storefront-prewarm.mjs
  examples/brand-thesis-tour.mjs  corporate thesis-tour recorder
```

The examples use placeholder domains — adapt the beats to your site; the
helpers (virtual cursor, glide-click ripples, lower-third straps, eased
scrolling, human-paced typing) carry over unchanged.

## Pipeline at a glance

| Phase | What happens |
|---|---|
| 1 Storyboard | audience/goal/thesis, narration written as one monologue, beat table with a "what changes on screen" test |
| 2 Recorder | Playwright script: cursor, captions, `mark()` at every beat |
| 3 Record | `node record.mjs \| tee marks.txt`; convert webm → mp4 |
| 4 Narration | one TTS clip per beat, durations measured, dwells sized voice-first |
| 5 Mix | `sync_mix.py` — margin audit, sidechain-ducked music, loudnorm −16 LUFS |
| 6 B-roll | bookend clips pre-rendered to uniform spec, crossfaded in |
| 7 QA | frame-extract every beat and look; stream/duration checks |

## Responsible use & licensing notes

- **Record sites you own or have permission to film.** The output video
  embodies the target site's content; that content stays its owner's.
- **TTS tiers**: the default `edge-tts` tool reaches Microsoft's neural voices
  through the same undocumented endpoint Edge's "Read Aloud" feature uses.
  It's widely used for prototyping, but it sits outside Microsoft's terms for
  programmatic use, can break without notice, and attaches **no usage licence
  to the audio it produces** — a risk you accept even for drafts; we simply
  consider it low-stakes there. For anything published, sold, or delivered to
  a client, use a provider that licenses its output (Azure AI Speech,
  ElevenLabs) or record a human voice over the silent cut — the mixer supports
  both. (The edge-tts library itself is open source and invoked as an external
  CLI, like ffmpeg.)
- **Music & b-roll are never bundled.** The docs point at sources (Mixkit,
  incompetech, Google Fonts) — verify each asset's current terms yourself and
  attribute where required (e.g. Kevin MacLeod's music is CC-BY).
- **ffmpeg** is invoked as an external CLI; bring your own build and mind your
  codec licensing.

## Credits

- Mode-gate (capture vs synthesize), voice-tier and production-governance ideas
  adopted from [OpenMontage](https://github.com/calesthio/OpenMontage)
  (ideas only — this repo shares no code with it).
- Music/b-roll guidance references [incompetech](https://incompetech.com)
  (Kevin MacLeod, CC-BY) and [Mixkit](https://mixkit.co).

## License

[MIT](LICENSE)
