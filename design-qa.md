# Design QA

Reference visual truth: `../outputs/ux-conceito-pratica-hibrida-v2-efeitos.png`

Primary implementation screenshot: `qa/prototype-1586x992.png`

Responsive implementation screenshots: `qa/prototype-1024x768.png`, `qa/prototype-390x844.png`, `qa/prototype-640x360.png`

Full-view comparison evidence: `qa/comparison-1586-final.png` (reference on the left, final browser capture on the right)

Focused comparison evidence: `qa/comparison-focus-hud-em.png` (HUD and Em coach crop, reference on the left and final browser capture on the right)

Responsive iteration evidence: `qa/comparison-responsive-iterations.png` (before/after pairs for 390 × 844 and 640 × 360)

## Capture normalization

- Reference pixels: 1586 × 992 PNG.
- Primary implementation pixels: 1586 × 992 PNG.
- CSS viewport: 1586 × 992.
- Browser `devicePixelRatio`: 1.
- Density normalization: none required; source and implementation have equal pixel dimensions at 1 CSS px per output pixel.
- Additional CSS viewports and output pixels: 1024 × 768, 390 × 844, and 640 × 360, all captured at `devicePixelRatio: 1`.
- Primary state: all three guidance layers active, playing, score `024 680`, streak `12`, multiplier `x4`, settings closed.
- State-match note: the source includes a lightning bloom around `x4`; the runtime intentionally renders lightning only during the 700 ms multiplier celebration, which changes the deterministic score to `024 880` and streak to `24`. The required exact score/streak capture therefore records the non-celebrating frame. Celebration and lightning were verified separately in `qa/score-celebration.png`.

## Findings

- P0: none.
- P1: none.
- P2: none after the three recorded correction passes below.
- P3: the rotated next-chord monitor extends about 3 px past the right edge at 1024 × 768. Its border is lightly cropped, but all chord content and confidence values remain visible and the intentional angled-monitor composition is preserved.

## Required fidelity surfaces

- Fonts and typography: Barlow Condensed is used for display/HUD copy and Inter for supporting UI copy. Final captures preserve the source's condensed hierarchy, weights, line-height, tracking, and legibility. The mobile score remains on one line after the width correction; no required copy truncates.
- Spacing and layout rhythm: the 72 px performance bar, centered guidance controls, central highway, angled monitor composition, HUD grouping, and responsive bottom drawer follow the intended hierarchy. Final browser metrics report no document overflow at any tested viewport.
- Colors and visual tokens: obsidian, stage indigo, cyan, magenta, amber, and off-white tokens map to the source's signal hierarchy. Active, focus, status, and reduced-motion states retain contrast.
- Image quality and asset fidelity: the stage, hand-camera feed, and transparent smoke use the approved raster assets at their intended crops. No target image asset is replaced by CSS art or a handcrafted SVG; interface icons come from the selected Phosphor icon family. Canvas is limited to the approved deterministic musical diagrams, highway, and effects.
- Copy and content: song metadata, lyrics, score, `12 ACERTOS`, `x4`, coach correction, confidence labels, simulation disclosure, camera label, and the short-screen landscape recommendation are coherent and visible in their intended states.
- Em correctness: the focused browser evidence shows the cyan targets on the transformed D and A string lines. The canonical accessible description is `dedo 2 na corda A, casa 2; dedo 3 na corda D, casa 2`; this renderer truth intentionally overrides the misplaced dots in the generated reference.

## Interaction, responsiveness, and accessibility verification

- Play/pause works from the control and from `Space` when focus is outside an interactive element; a second `Space` returns to paused.
- `Trilha`, `Letra`, and `Mão` toggle independently and restore without changing the other layers.
- Settings opens and closes. Fumaça, Efeito elétrico, Som elétrico, and Reduzir movimento each transition independently and restore to their initial values.
- Sound starts disabled. The multiplier demonstration succeeds before opt-in without enabling sound; after explicit sound opt-in the same demonstration completes with visual lightning independently configurable.
- The score demonstration reaches `024 880`, `24 ACERTOS`, and `x4`; `data-celebrating` is true during the pulse and false after 700 ms.
- Reduced motion sets the root reduced-motion state and computes `animation-name: none`, `animation-duration: 0s`, and `transition-duration: 0s` for the multiplier.
- Keyboard focus reaches the score control with a visible 3 px off-white outline.
- At 390 × 844 the score stays on one line, all persistent controls fit the viewport, settings stays within bounds, and the coach is a collapsed bottom drawer that expands to a scrollable 430 px panel.
- At 640 × 360 the score, current lyric, simplified chord strip, landscape recommendation, and coach drawer occupy distinct vertical bands; the expanded coach remains scrollable and its collapse control remains reachable.
- Console review after the complete interaction flow: 0 errors and 0 warnings, including no repeated animation or timer warnings.

## Comparison history

1. Desktop pass — P2: the diagonal coach panel obscured the multiplier's `x`, leaving only `4` visibly legible. Evidence: `qa/comparison-1586-pass-1.png`. Fix: raised the HUD stacking level above the coach while retaining the intended overlap. Post-fix evidence: `qa/comparison-1586-final.png` and `qa/comparison-focus-hud-em.png`, where the complete `x4` is visible.
2. Mobile pass — P2: the desktop `max-width: 210px` cap persisted at 390 × 844, wrapping `024 680` into two lines and colliding with `Em`. Evidence: `qa/prototype-390x844-pass-1.png`. Fix: removed the max-width cap only below 640 px. Post-fix evidence: `qa/prototype-390x844.png`; the HUD measures 358 × 50 px and ends at y=200 while lyrics begin at y=207.
3. Short-landscape pass — P2: at 640 × 360 the score, lyric, chord strip, and feedback overlapped. Evidence: `qa/prototype-640x360-pass-1.png`. Fix: added a short-height layout that compacts the chord strip, reduces lyrics to the current line, hides nonessential duplicate feedback/loop copy, and assigns distinct vertical bands. Post-fix evidence: `qa/prototype-640x360.png`; the score ends at y=188, lyric occupies y=190–212, chord strip y=232–270, landscape guidance y=285–300, and drawer y=307–360.

## Open questions

- None blocking. The source does not define tablet or mobile layouts; those states were evaluated against the stated responsive behavior and interaction requirements rather than false pixel-level fidelity.

## Implementation checklist

- [x] Make the complete `x4` legible without flattening the monitor overlap.
- [x] Keep canonical Em targets on D and A after the coach transform.
- [x] Prevent score wrapping at 390 × 844.
- [x] Preserve controls, guidance, chord strip, and coach access at 640 × 360.
- [x] Verify keyboard, toggles, settings, score, lightning, sound opt-in, reduced motion, collapse, and console state.
- [x] Capture and compare the final browser render against the reference in one combined image.

final result: passed
