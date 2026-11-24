# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/lishiyang786-debug/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/lishiyang786-debug/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A token launch radar: it reads a sealed DefiLlama snapshot (758 protocols, 40 on the house watchlist) and ranks all 198 standalone protocols that record no token yet by the market value their token would plausibly carry if it launched at peer pricing, each with an 8-step farm plan.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=rxcmkxs0&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>

## The model (radar-2.1, category-relative, small-sample capped)

No outside data and no hand-picked names: the snapshot prices its own protocols.

1. For every category, collect the live-token protocols and compute `market_cap / TVL`.
2. Winsorise those ratios to [0.03, 2.0] (the raw file contains a 400x prediction-market print
   that would otherwise poison its category), take the median, and shrink it toward the
   market-wide median (0.21x) with weight `n / (n + 6)` by peer count. On top of shrinkage, a
   small-sample confidence cap binds thin categories: at most 1.5x the global median with
   1 live peer, 2.5x with 2 peers, 4x with 3–4 peers, 6x with 5+. One observation is a hint,
   not a pricing regime — without the cap, the single-peer Risk Curators category (whose one
   peer prints at the winsor cap) put three curators on top of the board; curator TVL is also
   client assets under curation, not locked value, which is a structural reason for caution.
3. Price each pre-token protocol as `TVL x category multiple`, adjusted by clamped 7-day TVL
   momentum, track record without a token (age, up to 3 years), chain breadth, log-scale size,
   and a disclosed x1.10 confidence tilt for watchlist protocols.

Exchange balance sheets (CEX), wrapped/staked/bridged products of tokens that already trade,
and versioned pools are excluded by the same definition the snapshot's watchlist uses; protocols
whose token already trades are shown separately in the dashboard's Live view with their real
market caps — they are the peer evidence, never ranked.

Node 22.18+, standard library only, no network. Writes `out/board.json`, `out/data.js`,
`out/dashboard/`, `out/screenshots/` and `out/dossier.json`. The run is deterministic: the same
snapshot bytes produce the same output bytes.

## Layout

- `main.ts` — entry point: parse, score, validate, write outputs, build the dossier.
- `lib/model.ts` — the valuation model, the farm-plan generator and the board validator.
- `dashboard/` — the offline dashboard (board, detail view, category/chain/watchlist filters).
- `screenshots/` — the board, a protocol detail view and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored byte-for-byte from the kit.
