#!/usr/bin/env python3
"""
sync_mix.py — schedule narration against video beat marks, audit sync margins,
and mix voice + (optionally ducked) music onto the video with broadcast loudness.

Inputs it expects:
  --marks   text file containing lines like "MARK 46.4 couriers" (recorder output)
  --vo-dir  directory with one <beat>.mp3 per narration line, named after marks
  --video   the screen recording (mp4, already converted from webm)
Optional:
  --music   background bed (mp3); sidechain-ducked under the voice
  --intro / --outro  pre-rendered, SAME-SPEC mp4 segments (1080p/25fps/yuv420p,
            no audio) for b-roll bookends, joined with crossfades
  --xfade   crossfade seconds (default 1.0)
  --margin  minimum allowed gap between a line's end and the next visual beat
            (default 0.3s); violations abort unless --force

Why margins matter: a "sync issue" is the voice still describing beat N when the
video has moved to beat N+1. Both sides are measurable (marks + ffprobe), so we
refuse to render a cut that will feel laggy.

Exit: writes and runs the ffmpeg command; prints the schedule table to stderr.
"""
import argparse, json, re, subprocess, sys
from pathlib import Path

def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True)
    return float(out.stdout.strip())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--marks", required=True)
    ap.add_argument("--vo-dir", required=True)
    ap.add_argument("--video", required=True)
    ap.add_argument("--music")
    ap.add_argument("--intro"); ap.add_argument("--outro")
    ap.add_argument("--xfade", type=float, default=1.0)
    ap.add_argument("--margin", type=float, default=0.3)
    ap.add_argument("--gap", type=float, default=0.25, help="min silence between lines")
    ap.add_argument("--music-vol", type=float, default=0.35)
    ap.add_argument("--out", default="final.mp4")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    marks = {}
    for line in open(a.marks):
        m = re.match(r"MARK ([\d.]+) (\w+)", line)
        if m:
            marks[m.group(2)] = float(m.group(1))
    order = list(marks)
    take_dur = ffprobe_duration(a.video)

    vo = Path(a.vo_dir)
    durs = {n: ffprobe_duration(vo / f"{n}.mp3") for n in marks if (vo / f"{n}.mp3").exists()}
    missing = [n for n in marks if n not in durs]
    if missing:
        print(f"# note: no narration clip for beats: {', '.join(missing)}", file=sys.stderr)

    # b-roll geometry: screen content shifts later by (intro - xfade)
    intro_d = ffprobe_duration(a.intro) if a.intro else 0.0
    outro_d = ffprobe_duration(a.outro) if a.outro else 0.0
    shift = max(0.0, intro_d - a.xfade) if a.intro else 0.0
    total = (intro_d - a.xfade if a.intro else 0) + take_dur + (outro_d - a.xfade if a.outro else 0)

    # schedule: start at the visual cue (pushed if the previous line is still talking)
    sched, prev_end, ok = {}, 0.0, True
    print(f"# {'beat':12} {'start':>7} {'end':>7} {'next':>7} {'margin':>7}", file=sys.stderr)
    for i, n in enumerate(order):
        if n not in durs:
            continue
        start = max(marks[n], prev_end + a.gap)
        end = start + durs[n]
        nxt = next((marks[order[j]] for j in range(i + 1, len(order))), take_dur)
        margin = nxt - end
        flag = "  ✗ OVERRUN" if margin < a.margin else ""
        print(f"# {n:12} {start:7.2f} {end:7.2f} {nxt:7.2f} {margin:7.2f}{flag}", file=sys.stderr)
        if margin < a.margin:
            ok = False
        sched[n] = start + shift
        prev_end = end
    print(f"# {'ALL MARGINS OK' if ok else 'SYNC VIOLATIONS — stretch the video at flagged beats and re-record'}",
          file=sys.stderr)
    if not ok and not a.force:
        print("# aborting (use --force to render anyway)", file=sys.stderr)
        sys.exit(1)

    # ---- build ffmpeg ----
    names = list(sched)
    inputs, idx = [], {}
    def add(path):
        inputs.append(str(path)); return len(inputs) - 1
    fc = []
    if a.intro:
        vi, vt, vo_i = add(a.intro), add(a.video), add(a.outro)
        off2 = (intro_d - a.xfade) + take_dur - a.xfade
        fc.append(f"[{vi}:v]settb=AVTB[v0]")
        fc.append(f"[{vt}:v]fps=25,setsar=1,settb=AVTB[v1]")
        fc.append(f"[{vo_i}:v]settb=AVTB[v2]")
        # xfade needs CFR + matching timebases on every input; re-stamp between fades
        fc.append(f"[v0][v1]xfade=transition=fade:duration={a.xfade}:offset={intro_d - a.xfade},fps=25,settb=AVTB[v01]")
        fc.append(f"[v01][v2]xfade=transition=fade:duration={a.xfade}:offset={off2:.3f}[vfinal]")
        vmap, reencode = "[vfinal]", True
    else:
        vt = add(a.video)
        vmap, reencode = f"{vt}:v", False

    mi = add(a.music) if a.music else None
    parts, mix = [], []
    for n in names:
        i = add(vo / f"{n}.mp3")
        ms = int(sched[n] * 1000)
        parts.append(f"[{i}:a]adelay={ms}|{ms}[d{i}]")
        mix.append(f"[d{i}]")
    fc.extend(parts)
    # a pad can feed only ONE filter — split the voice bus for sidechain key + final mix.
    # apad to the full cut: sidechaincompress EOFs when EITHER input ends, so an unpadded
    # voice bus silently killed the music at the last narration line (outros played mute).
    fc.append("".join(mix) + f"amix=inputs={len(names)}:normalize=0,"
              f"apad=whole_dur={total:.2f},asplit=2[vokey][vomix]")
    if mi is not None:
        fc.append(f"[{mi}:a]atrim=0:{total:.2f},afade=t=in:st=0:d=2.5,"
                  f"afade=t=out:st={max(0, total - 2.8):.2f}:d=2.8,volume={a.music_vol}[bg]")
        fc.append("[bg][vokey]sidechaincompress=threshold=0.02:ratio=12:attack=25:release=500[duck]")
        fc.append("[duck][vomix]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    else:
        fc.append("[vokey]anullsink;[vomix]loudnorm=I=-16:TP=-1.5:LRA=11[aout]")

    cmd = ["ffmpeg", "-y", "-loglevel", "error"]
    for i, p in enumerate(inputs):
        if mi is not None and i == mi:
            # loop beds shorter than the cut; input-level -t bounds the read so ffmpeg terminates
            cmd += ["-stream_loop", "-1", "-t", f"{total + 1:.2f}"]
        cmd += ["-i", p]
    cmd += ["-filter_complex", ";".join(fc), "-map", vmap, "-map", "[aout]"]
    cmd += (["-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p"]
            if reencode else ["-c:v", "copy"])
    cmd += ["-c:a", "aac", "-b:a", "192k", a.out]
    print("# running:", " ".join(cmd[:8]), "…", file=sys.stderr)
    subprocess.run(cmd, check=True)
    print(json.dumps({"out": a.out, "total": round(total, 2), "lines": len(names)}))

if __name__ == "__main__":
    main()
