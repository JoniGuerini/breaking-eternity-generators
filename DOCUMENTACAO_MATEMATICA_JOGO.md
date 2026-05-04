# Breaking Eternity: documentação matemática

Este documento descreve as regras matemáticas que governam a progressão do jogo.

## 1) Modelo geral

O jogo possui uma cadeia de geradores:

- `Gerador 1` produz `Recurso Base`.
- `Gerador N` (para `N >= 2`) produz unidades do `Gerador N-1`.
- A lista de geradores cresce indefinidamente conforme novos tiers são desbloqueados.

Todo valor numérico relevante usa `Decimal` (`break_eternity.js`), permitindo valores muito além de `float64`.

## 2) Estado inicial

Ao iniciar um save novo:

- `resource = 10`
- Geradores visíveis:
  - `Gerador 1`: desbloqueado, `count = 0`, `purchases = 0`
  - `Gerador 2`: bloqueado, `count = 0`, `purchases = 0`

## 3) Configuração do Gerador N

Para um gerador de índice `N`:

- **Custo base**
  - `baseCost(N) = 10^N`
- **Multiplicador de custo por compra**
  - `costMultiplier = 1.5`
- **Taxa de produção por unidade (por segundo)**
  - `productionRate(N) = max(0.1, 0.21 - 0.01*N)`
  - Exemplos:
    - `N=1 -> 0.20/s`
    - `N=2 -> 0.19/s`
    - `N=11 -> 0.10/s` (piso atingido)
- **Threshold de desbloqueio**
  - `unlockThreshold(N) = baseCost(N) = 10^N`

## 4) Custo de compra

Se um gerador tem `purchases = p`, o custo da próxima compra é:

`nextCost = baseCost * (costMultiplier^p)`

No estado atual, cada compra aumenta:

- `count += 1`
- `purchases += 1`
- `resource -= nextCost`

## 5) Simulação temporal (tick)

O loop roda em `requestAnimationFrame` (aprox. 60Hz), usando `dt` em segundos:

- `dt = (now - lastTime) / 1000`
- `clampedDt = clamp(dt, 0, 0.5)`

Esse teto (`0.5s`) evita spikes exagerados de produção após pausas longas de aba/frame.

## 6) Equações de produção por tick

### 6.1 Recurso Base

Somente o `Gerador 1` injeta recurso diretamente:

`resource += count(1) * productionRate(1) * clampedDt`

### 6.2 Produção entre tiers

Para cada `i` de `2` até `Nmax` (ou índice de array equivalente):

`count(i-1) += count(i) * productionRate(i) * clampedDt`

Ou seja:

- `Gerador 2` produz `Gerador 1`
- `Gerador 3` produz `Gerador 2`
- etc.

### 6.3 Ordem de atualização no frame

A atualização percorre os tiers de baixo para cima dentro do array de tiers superiores (`2 -> 3 -> 4 ...` em termos de ID), garantindo que a produção de um nível use o estado do nível superior no início daquele passo, evitando compostagem indevida no mesmo frame.

## 7) Desbloqueio passivo

Após ticks e compras, o jogo verifica desbloqueios:

- Se `resource >= unlockThreshold(N)` e o gerador `N` estiver bloqueado, ele é desbloqueado.
- O desbloqueio **não consome** recurso.

Na UI de gerador bloqueado:

- Barra de progresso usa `ratio = resource / unlockThreshold`.
- Percentual visual é `clamp(ratio * 100, 0, 100)`.

## 8) Expansão infinita da cadeia

Depois da checagem de desbloqueio:

- Se o último gerador da lista estiver desbloqueado, o jogo cria automaticamente o próximo (`N+1`) já visível porém bloqueado.

Isso mantém sempre um "próximo objetivo" na tela e permite progressão teoricamente infinita.

## 9) Taxa exibida na UI

A taxa mostrada no cabeçalho é:

`resourceRate = count(1) * productionRate(1)`

Importante: essa taxa é apenas do Recurso Base direto (não soma tiers superiores diretamente; eles impactam indiretamente ao aumentar `count(1)`).

## 10) Persistência e impacto matemático

No save, são persistidos somente dados de jogador:

- `resource`
- para cada gerador: `id`, `count`, `purchases`, `unlocked`
- `startedAt`

Parâmetros de balanceamento (`productionRate`, `baseCost`, `costMultiplier`, `unlockThreshold`) são reconstruídos via fórmula ao carregar. Isso permite rebalancear o jogo sem invalidar saves antigos.

## 11) Progresso offline

Ao abrir o jogo, o sistema lê `lastSavedAt` (campo `ts` do save) e calcula:

`elapsed = (Date.now() - lastSavedAt) / 1000`

Regras aplicadas:

- Ignora offline muito curto (`elapsed < 1s`).
- Não aplica cap máximo de tempo offline:
  - `offlineSeconds = max(0, elapsed)`.
- Simulação é executada em chunks de no máximo `0.5s` (mesmo `DT_CAP` do loop normal):
  - enquanto `remaining > 0`, roda produção com `step = min(0.5, remaining)`.

Durante essa simulação:

- Produção de recurso e de tiers segue as mesmas equações do tick normal.
- Desbloqueios passivos continuam valendo.
- Novos geradores podem aparecer se o último tier for desbloqueado no processo.

## 12) Observações de design

- Não há sistema de prestige/reset com bônus multiplicativos no estado atual.
- O reset disponível apenas limpa save e recria o estado inicial.
