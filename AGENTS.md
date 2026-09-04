# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

The approved guitar-practice visual source is `../outputs/ux-conceito-pratica-hibrida-v2-efeitos.png`: preserve its cyberpunk rock stage composition, image-backed stage/camera, metallic amplifier monitors, cyan/magenta/amber signal colors, and Barlow Condensed + Inter typography. Keep SCORE / zero-padded score / ACERTOS / x-multiplier as one clickable HUD, without duplicate SEQUÊNCIA copy. Current/next chord mini diagrams remain visible; correct Em targets (A2 and D2) override generated-image mistakes. Label the camera `Câmera simulada · posição observada`. Below 900px use a hand-coach bottom drawer and horizontal chord strip; below 640px simplify framing and show the landscape recommendation without blocking controls. Canvas musical diagrams, note highway and electric UI effects are approved deterministic UI, not substitutes for image assets.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
