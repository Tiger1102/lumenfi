# LumenFi

LumenFi is a premium stablecoin DeFi workspace for Arc Testnet with four production-style product paths:

- Wallet connect, Arc Testnet balances, and inline transaction feedback.
- Stablecoin swaps through the deployed USDC/EURC LumenFi pool.
- Permissionless LP positions with share tracking and fee-accrual context.
- USDC bridge preparation and unified balance hooks through Circle App Kit.
- A Solidity lending pool for USDC/EURC collateral and borrowing.

The current UI is built as an overview-first DeFi dashboard with professional dark-mode styling, public contract links, module-level receipts, and a roadmap toward an Arc Blueprints-powered AI Agent.

## Stack

- React, Vite, TypeScript
- viem wallet/RPC calls
- Circle App Kit and viem adapter
- Hardhat and Solidity
- Cloudflare Pages and Worker proxy
- Arc Testnet RPC: `https://rpc.testnet.arc.network`
- Arc Testnet chain ID: `5042002`

## Setup

```bash
npm install
cp .env.example .env
```

Set local credentials only in `.env`:

```bash
CIRCLE_KIT_KEY=your_circle_app_kit_key
ARC_TESTNET_PRIVATE_KEY=0x...
```

Do not put sensitive credentials in public files. Keep `VITE_CIRCLE_APP_KIT_KEY` empty for public builds unless you intentionally accept that the browser bundle will expose that key. The testnet deployment keeps service credentials out of the browser bundle.

## Run the web app

```bash
npm run dev
```

Open `http://localhost:5173`.

## Live app

```text
https://lumenfi.click
```

Latest Cloudflare Pages deployment:

```text
https://301a92f5.lumenfi.pages.dev
```

Project docs:

```text
docs/project-submission.md
docs/whitepaper.md
docs/deployments.md
```

Security notes:

```text
.env, tunnel credentials, and sensitive credentials must never be committed or shared.
Do not expose Circle Kit keys in VITE_CIRCLE_APP_KIT_KEY unless you accept browser exposure.
Use testnet-only wallets and rotate keys before any production release.
```

## Deploy contracts

The deploy scripts use Arc Testnet `USDC` and `EURC`:

- USDC: `0x3600000000000000000000000000000000000000`
- EURC: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

```bash
npm run compile
npm run deploy:arc
npm run deploy:swap-pool
```

Copy the printed contract addresses into `.env`:

```bash
VITE_LENDING_POOL_ADDRESS=0x...
VITE_SWAP_POOL_ADDRESS=0x...
```

Restart `npm run dev`.

Current Arc Testnet deployments:

```text
LendingPool:
0x474552ce815a68443bdfcafd089cdb345791d204

PermissionlessStablePool:
0xfd34e43021f20f585db8f078471c7107d8d1da30
```

If PermissionlessStablePool reserves are empty after a fresh deployment, add both USDC and EURC liquidity before expecting pool swaps to quote.

## Deploy web

```bash
npm run build
npx wrangler pages deploy dist --project-name lumenfi --commit-dirty=true
```

`lumenfi.click` is served by a Worker proxy that forwards to `https://lumenfi.pages.dev`.

## Notes

Arc uses USDC as native gas with 18 decimals, while ERC-20 USDC uses 6 decimals at `0x3600000000000000000000000000000000000000`. The app and lending pool use ERC-20 balances and approvals.

The lending pool is an MVP contract, not production lending infrastructure. Before mainnet use it needs audited accounting, oracle hardening, interest accrual, reserves, liquidation testing, and risk parameters per asset.

## License

MIT


