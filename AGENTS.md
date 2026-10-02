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
- Passo 4 (coach): a parte mais no ponto. Pedidos: melhorar transições; efeitos animados (pulsar) nas posições erradas para chamar atenção; o card da mão na câmera parece baixo e pouco relevante: ou mais discreto, ou com utilidade além da conferência visual (matching com o card coach e a prévia). Proposta: sobrepor à foto os contornos do alvo e um marcador pulsante no dedo errado (posições marcadas à mão, a foto é simulada), subir/ampliar o card; crossfade na troca de acorde e deslize do ponto observado → alvo; reduzir movimento troca pulso por opacidade.

## Plano pós-avaliação

Fase 1 concluída em 2026-10-02 (modos, HUD discreto, TRILHA esconde a pista inteira). Propostas dos passos 2 a 4 confirmadas pelo usuário.

1. Modos Aprendizado (padrão) e Desafio; HUD de score discreto; TRILHA desligada esconde a pista inteira. Atualizar spec, guia e testes.
2. Coach: câmera com sobreposição do alvo, pulso nos erros, transições.
3. Eventos `bend-miss`/`strum-miss`, sons em camadas, vaia opcional (CC0, desligada por padrão).
4. Cena Three.js no Desafio (import dinâmico; fallback Canvas 2D → SVG).
Cada fase: commit separado, testes, deploy.

## Meta funcional (2026-10-02)

O usuário pediu "finalizar e atualizar o projeto com um protótipo funcional sem ser apenas demo de UI". Arquitetura escolhida: inferência no navegador (opção B; A = Python local + WebRTC via Tailscale + Rails). Entregue: microfone com reconhecimento de acorde julgado contra a pista; câmera com MediaPipe e conferência de dedos. Pendentes: casa/corda por dedo (localizar o braço), bends/strum, sons em camadas e vaia, Three.js no Desafio, celular como câmera, calibração do limiar de dedo dobrado com mãos reais.

## Orientação das cordas (2026-10-02)

Os diagramas de acorde mostram o Mi grave em cima (ordem E A D G B e de cima para baixo), como as cordas ficam no violão do usuário; confirmado por ele. O formato de tablatura (e agudo em cima) segue disponível em Configurações. A pista (colunas E A D G B e da esquerda para a direita) não foi alterada e não houve reclamação sobre ela.
