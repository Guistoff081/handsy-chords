# Handsy Chords

Protótipo de uma pista de prática de violão no navegador: acordes que descem até a linha de acerto, letra sincronizada e um coach que compara o shape-alvo com a posição observada da mão.

- Site: https://guistoff081.github.io/handsy-chords/
- Demo: https://guistoff081.github.io/handsy-chords/demo/

## Estado

A experiência roda inteira no navegador, sem backend, e agora é funcional se você permitir microfone e câmera:

- **Microfone:** reconhece o acorde que você toca (Em, G) e o avalia contra a pista: acerto, atraso, acorde errado ou falta.
- **Câmera:** mostra sua mão com o esqueleto (MediaPipe) e confere quais dedos estão firmes contra os que o acorde exige.

Sem permissão, a música, o score e a análise da mão continuam **simulados**. A música em si não toca: você toca junto com a pista. A conferência de dedos é grossa (dedo dobrado ou não); casa e corda por dedo ainda não existem.

O que existe: modos Aprendizado e Desafio, pista em Canvas 2D, camadas TRILHA / LETRA / MÃO, score com multiplicador até x4, efeito elétrico com som opcional, fumaça de palco, redução de movimento e layout de desktop a celular. O diagrama de acordes é desenhado por um componente determinístico a partir dos dados musicais.

## Rodando

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm test           # Vitest
npm run build      # build de produção (dist/client)
```

`npm run build:pages` gera o demo para o subcaminho `/handsy-chords/demo/`. O workflow em `.github/workflows/pages.yml` junta esse build com a landing em `landing/` e publica no GitHub Pages a cada push em `main`.

## Estrutura

- `src/`: app (React 19 + Vite). Canvas para pista e fumaça; DOM para controles e texto.
- `tests/`: testes do modelo, dos componentes e da cena em Canvas.
- `landing/`: página de divulgação.
- `design-qa.md`, `qa/`: verificação visual contra o conceito aprovado.

## Arquitetura

A análise roda no navegador (inferência no cliente). O motor entrega eventos `{momento, acorde, confiança}` e a sessão os transforma em `hit` / `late` / `miss`; um serviço Python com WebRTC, ou o celular como câmera, pode alimentar o mesmo contrato depois. O modelo da mão e o WASM do MediaPipe vêm de CDN na primeira vez que a câmera é ligada (cerca de 8 MB); os quadros nunca saem do navegador.

## Próximos passos

Localizar o braço para dizer casa e corda por dedo, bends e palhetada, sons e efeitos mais fortes no Desafio (Three.js), e o celular como câmera.

## Licença

MIT. Fontes Barlow Condensed e Inter (SIL OFL) via Fontsource.
