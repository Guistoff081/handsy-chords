# Handsy Chords

Protótipo de uma pista de prática de violão no navegador: acordes que descem até a linha de acerto, letra sincronizada e um coach que compara o shape-alvo com a posição observada da mão.

- Site: https://guistoff081.github.io/handsy-chords/
- Demo: https://guistoff081.github.io/handsy-chords/demo/

## Estado

É uma experiência visual. Música, score, timing e análise da mão são **simulados**. Ainda não há captura de câmera ou microfone, reconhecimento de acordes, nem backend.

O que existe: pista em Canvas 2D, camadas TRILHA / LETRA / MÃO, score com multiplicador até x4, efeito elétrico com som opcional, fumaça de palco, redução de movimento e layout de desktop a celular. O diagrama de acordes é desenhado por um componente determinístico a partir dos dados musicais.

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

## Próximos passos

Captura pela câmera, reconhecimento de dedos e acorde, feedback de dedilhado e palhetada, e a integração com um backend.

## Licença

MIT. Fontes Barlow Condensed e Inter (SIL OFL) via Fontsource.
