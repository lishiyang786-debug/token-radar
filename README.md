# Token Launch Radar

A token launch radar for make.fun's `token-radar-01` bounty. It reads the sealed DefiLlama
snapshot (758 protocols, 40 on the house watchlist) and ranks every standalone protocol that
records no token yet — 198 of them, down to the $5M TVL floor — by the market value its token
would plausibly carry if it launched at peer pricing. Each ranked protocol carries an 8-step
farm plan with costs and times.

## The model (radar-2, category-relative)

No outside data and no hand-picked names: the snapshot prices its own protocols.

1. For every category, collect the live-token protocols and compute `market_cap / TVL`.
2. Winsorise those ratios to [0.03, 2.0] (the raw file contains a 400x prediction-market print
   that would otherwise poison its category), take the median, and shrink it toward the
   market-wide median (0.21x) with weight `n / (n + 6)` by peer count.
3. Price each pre-token protocol as `TVL x category multiple`, adjusted by clamped 7-day TVL
   momentum, track record without a token (age, up to 3 years), chain breadth, log-scale size,
   and a disclosed x1.10 confidence tilt for watchlist protocols.

Exchange balance sheets (CEX), wrapped/staked/bridged products of tokens that already trade,
and versioned pools are excluded by the same definition the snapshot's watchlist uses; protocols
whose token already trades are shown separately in the dashboard's Live view with their real
market caps — they are the peer evidence, never ranked.

## Run it

```sh
mkdir -p out
MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

Node 22.18+, standard library only, no network. Writes `out/board.json`, `out/data.js`,
`out/dashboard/`, `out/screenshots/` and `out/dossier.json`. The run is deterministic: the same
snapshot bytes produce the same output bytes.

## Layout

- `main.ts` — entry point: parse, score, validate, write outputs, build the dossier.
- `lib/model.ts` — the valuation model, the farm-plan generator and the board validator.
- `dashboard/` — the offline dashboard (board, detail view, category/chain/watchlist filters).
- `screenshots/` — the board, a protocol detail view and a filtered view.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored byte-for-byte from the kit.
