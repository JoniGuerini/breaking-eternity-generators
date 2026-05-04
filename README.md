# Breaking Eternity: Generators

Jogo incremental/idle desktop. Cadeia de geradores onde cada Gerador N produz unidades do Gerador N-1, e o Gerador 1 produz Recurso Base. Lista teoricamente infinita — desbloqueio passivo ao atingir thresholds.

Esta é a versão React + Vite + TypeScript, migrada da prova-de-conceito em HTML single-file (`breaking_eternity_generators.html` na raiz, mantido como spec executável de referência).

## Stack

- **Vite 8** + **React 19** + **TypeScript 5.9**
- **Zustand 5** pra estado global do jogo
- **break_eternity.js 2.1** pra números arbitrariamente grandes

## Rodar

```bash
npm install
npm run dev      # dev server em http://localhost:5173
npm run build    # build de produção em dist/
npm run preview  # preview do build
npm run typecheck
```

## Arquitetura resumida

```
src/
  game/
    types.ts         # Generator, GameState, SaveData
    config.ts        # getGenConfig, getBuyCost, createGenerator, constantes
    format.ts        # fmt, fmtCount
    persistence.ts   # load/persist/serialize, makeFreshState, clearSave
    store.ts         # Zustand store: applyTick, buy, reset, notify
    loop.ts          # game loop (rAF) + auto-save fora do React
  hooks/
    useWakeLock.ts   # Wake Lock API silenciosa
  components/
    App.tsx, Header.tsx, ResourceDisplay.tsx,
    GeneratorList.tsx, GeneratorCard.tsx,
    ProgressBar.tsx, ResetModal.tsx
  styles/
    tokens.css       # design tokens (paleta, fontes)
    global.css       # CSS global, port 1:1 do HTML original
  main.tsx, App.tsx
```

### Estratégia de estado

Decimals são objetos imutáveis (cada `.add()` retorna um novo). Reatribuímos referências dentro do store sem clonar arrays — o React **não** subscreve `resource`/`generators` diretamente. Em vez disso, o game loop incrementa um campo `tick` em cadência reduzida (~15Hz) que dispara re-render. Isso desacopla simulação (60Hz) de render.

Em componentes:

```ts
useGameStore((s) => s.tick); // força re-render quando o tick avança
const resource = useGameStore.getState().resource; // leitura direta
```

### Persistência

- Chave: `breaking_eternity_save_v1` (compatível com saves do HTML original)
- Decimals serializados via `toString()`, hidratados via `new Decimal(str)`
- Apenas dados do jogador são persistidos (`count`, `purchases`, `unlocked`); config (rates, custos, thresholds) é reconstruída via `getGenConfig(n)` no load — permite ajustar fórmulas sem invalidar saves antigos
- Auto-save: `setInterval(5s)` + `visibilitychange` (hidden) + `beforeunload`
- Flag `isResetting` no loop bloqueia saves durante o reset, pra evitar que `beforeunload` recrie o save logo depois do `clearSave()`

## Backlog (não implementado)

- Buy ×10 / Buy max
- Offline progress real (cap maior + cálculo no boot via `lastSaved`)
- Threshold de unlock independente do custo de compra
- Renomear "Recurso Base" pra algo temático
- Animação sutil ao atravessar ordem de magnitude
