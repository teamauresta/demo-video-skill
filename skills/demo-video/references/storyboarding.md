# Storyboarding — turning a site tour into a film

The pipeline downstream of the storyboard is mechanical; the storyboard is where
the film is actually won or lost. Work through this BEFORE writing any recorder code.

## Step 0 — Three questions, written down

1. **Audience** — who watches this? (investor / buyer / client-being-pitched / staff)
2. **Goal** — what should they think or DO after 2 minutes?
3. **Thesis** — the ONE sentence the whole film argues. Every beat must serve it;
   beats that don't, get cut.

If you can't answer these, the result will be a screen tour with captions.

## Step 1 — Pick a narrative shape

- **Problem → Solution → Proof → CTA** — product demos (the default for apps)
- **Thesis tour** — brand/corporate sites: open with a claim, every section is
  evidence for it, close by restating it with an invitation
- **Day in the life** — follow one persona through a real task end-to-end
- **Before / After** — strongest when the product visibly transforms something

## Step 2 — Write the monologue FIRST, as one piece

Write the narration as a single flowing monologue and read it aloud start to
finish. If it reads like a list of captions, rewrite. Only THEN split it into
beats. (Writing per-beat first is what produces the robotic "section narrator"
feel.)

Narration rules:
- **Never read the headings.** If the screen says it, the voice must add to it —
  the why, the implication, the number behind it.
- One idea per line. Flowing clauses (TTS prosody dies on fragments).
- The first line is a HOOK: a question, a tension, or a bold claim — not the
  company name (that's what the title card is for).
- The last line is a CTA or a memorable restatement of the thesis.

## Step 3 — The beat table

| beat | visual | WHAT CHANGES on screen | narration (adds, never repeats) | pace |
|---|---|---|---|---|

The **"what changes" column is mandatory** — it's the anti-slideshow test:
- Best: a state change (login → prices drop; submit → result appears; empty → filled)
- Good: an interaction (click, type, calculator returning live data)
- Acceptable: a reveal (scroll INTO something, caption strap sliding in)
- Red flag: "scroll past static section" — merge such beats into one quick
  montage, overlay a kinetic caption, or cut them

Pace column: `hook` (≤5s), `quick` (2–4s montage), `dwell` (6–10s for the
moments that matter). Vary them — three identical dwells in a row reads as a
metronome. Consider one music-only breath (no narration) before the close.

**Interaction ordering**: sequence proofs so each acts on the largest possible
canvas. Filtering/searching/narrowing beats go AFTER grid-wide effects — a
search that collapses the view to two results leaves nothing for the next
proof to transform. (Found in testing: reordering tune/weights before search
was the difference between a demo and a damp squib.)

## Step 4 — Cut

Target ≤ 2:15. Rank beats by how hard they serve the thesis; cut from the
bottom, merge neighbours (two weak sections = one quick montage beat with a
single line). A 90-second film that argues one thing beats a 3-minute tour.

## Worked contrast (real example)

Site-tour beat (weak):
> visual: scroll past "Seven Houses" section
> narration: "Across them sit seven houses. Each keeps its own brand…"  ← the screen already says this

Thesis-tour beat (strong), same footage:
> thesis: "diversification that compounds, not fragments"
> visual: scroll INTO Seven Houses, dwell on two house cards
> narration: "Most groups this diverse fragment. Here, seven businesses share
> one balance sheet, one governance spine — so each house compounds the others."
> ← argues; adds what's not on screen

## Checklist before coding the recorder

- [ ] Audience, goal, thesis written at the top of the storyboard
- [ ] Monologue reads well aloud as one piece
- [ ] No narration line repeats on-screen text
- [ ] Every beat has a "what changes" entry; no red-flag beats survived
- [ ] Pacing varies; there's a hook ≤5s and a CTA
- [ ] Beat count ≤ 14, projected runtime ≤ 2:15
