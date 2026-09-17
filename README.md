# Arc Predict

Prediction markets on the Arc network. Back your view on real world events with USDC - politics, crypto, sports, economics, tech and more - with live prices, an order book, and instant on-chain settlement.

## Features

- 136 live markets across 8 categories with cover art per market
- Simulated odds with price history charts (1D / 1W / 1M / All)
- Live trade ticker and activity feed
- Order book depth, resolution rules and sources per market
- Wallet connection (MetaMask, Coinbase Wallet, WalletConnect, Phantom)
- Leaderboard and trader rankings

## Stack

Plain HTML, CSS and JavaScript. No build step, no frameworks.

- `index.html` - shell (header, ticker, footer, modals)
- `js/data.js` - generated dataset (markets, odds history, activity)
- `js/app.js` - hash router, views, wallet, charts, live feed engine
- `css/style.css` - design system
- `scripts/generate.js` - regenerates `js/data.js` and the SVG covers in `img/covers/`

## Run locally

```bash
npx serve .
# or
python -m http.server
```

Then open the served URL in a browser.

## Deploy

The site is a static bundle and deploys anywhere. On Vercel:

```bash
vercel --prod
```

To regenerate market data after editing `scripts/generate.js`:

```bash
node scripts/generate.js
```
