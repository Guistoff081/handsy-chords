# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

The approved guitar-practice visual source is `../outputs/ux-conceito-pratica-hibrida-v2-efeitos.png`: preserve its cyberpunk rock stage composition, image-backed stage/camera, metallic amplifier monitors, cyan/magenta/amber signal colors, and Barlow Condensed + Inter typography. Keep SCORE / zero-padded score / ACERTOS / x-multiplier as one clickable HUD, without duplicate SEQUÊNCIA copy. Current/next chord mini diagrams remain visible; correct Em targets (A2 and D2) override generated-image mistakes. Label the camera `Câmera simulada · posição observada`. Below 900px use a hand-coach bottom drawer and horizontal chord strip; below 640px simplify framing and show the landscape recommendation without blocking controls. Canvas musical diagrams, note highway and electric UI effects are approved deterministic UI, not substitutes for image assets.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Avaliação do usuário (2026-10-02)

- Passo 1 (pista × coach da mão): dá para acompanhar os dois. O card de SCORE/ACERTOS/multiplicador distrai e rouba atenção da pista e do coach. Pedido: deixá-lo mais discreto e/ou reposicioná-lo. Pendente de implementação, a decidir após os 4 passos da avaliação. Restrição: manter score, acertos e multiplicador como um único HUD clicável.
- Passo 2 (camadas): a pista só faz sentido com TRILHA ligada, e o score também; coach, letra e prévia do próximo acorde ajudam mais no aprendizado. Proposta (aguardando confirmação do usuário): dois modos, **Aprendizado** (letra + coach + próximo acorde; sem pista, score, multiplicador nem feedback em ms) e **Desafio** (pista, score, multiplicador, efeitos, timing; coach recolhido). Modos como presets das camadas existentes; TRILHA desligada esconde a pista inteira. Exige atualizar a spec (hoje TRILHA preserva a linha de execução).
- Passo 3 (efeitos): fumaça, efeitos visuais e sons quase imperceptíveis; pouca relevância para um modo desafio. Ideias do usuário: sons melhores, efeitos de falha de bend e strum, vaias nos erros, animação melhor com Three.js. Proposta (aguardando confirmação): (1) modos + HUD discreto; (2) eventos `bend-miss`/`strum-miss`, sons em camadas (Web Audio) e vaia opcional, desligada por padrão, só no Desafio, amostra CC0; (3) cena Three.js só no Desafio, com import dinâmico e fallback Canvas 2D → SVG estático. Tremor/flash respeitam reduzir movimento.
