# LumenFi

LumenFi is an Arc Testnet stablecoin DeFi workspace with five reviewable product paths:

- Wallet connect, Arc Testnet balances, and inline transaction feedback.
- Stablecoin swaps through the deployed USDC/EURC LumenFi pool.
- Permissionless LP positions with share tracking and fee-accrual context.
- USDC bridge preparation and unified balance hooks through Circle App Kit.
- A Solidity lending pool for USDC/EURC collateral and borrowing.

The overview links to public contracts and the active market module keeps transaction status and explorer receipts in context. The LumenFi Agent reads Arc state, prepares bounded action drafts, and can enforce wallet-signed action, budget, expiry, revocation, and evidence-freshness policies before wallet approval.

## Why Arc

LumenFi is designed around Arc's stablecoin-native execution model. Arc lets the app present gas, balances, liquidity, collateral, and settlement in familiar stablecoin terms instead of forcing users to reason across separate network tokens and fragmented onboarding steps.

The project highlights four Arc-relevant ideas:

- Stablecoin-first UX for swaps, LP positions, and credit markets.
- USDC-denominated onboarding and transaction context.
- Testnet contracts that make Arc balances actionable from one interface.
- A deterministic action planner with live onchain evidence and signed permission controls, plus a separate path toward ERC-4337 session execution.

## Judge Quick Review

- Live demo: `https://lumenfi.click`
- Source code: `https://github.com/Tiger1102/lumenfi`
- Deployed Arc Testnet contracts: listed below and in `docs/deployments.md`
- Product docs: `docs/project-submission.md` and `docs/whitepaper.md`
- Contract tests: `npm test`
- Frontend build: `npm run build`
- On-chain deployment check: `node scripts/check-contracts.mjs`

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
ARC_TESTNET_PRIVATE_KEY=0x...
```

Do not put sensitive credentials in public files. `VITE_CIRCLE_APP_KIT_KEY` is optional and only enables App Kit swap routes that require a Kit Key; any Vite variable is exposed in the browser bundle. The public USDC/EURC pool does not require it.

## Run the web app

```bash
npm run dev
```

Open `http://localhost:5173`.

## Live app

```text
https://lumenfi.click
```

Project docs:

```text
docs/project-submission.md
docs/whitepaper.md
docs/deployments.md
docs/demo-script.md
docs/arc-agent-roadmap.md
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
0x212622812664e37abbb99774ee7488bc721b38b3
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

Before opening the wallet confirmation, LumenFi estimates contract gas through Arc RPC, adds a 25% gas-limit buffer, applies an EIP-1559 max-fee floor of 30 Gwei with a 1 Gwei priority fee, and checks the wallet's native USDC gas balance. Supplying these values prevents injected wallets from remaining indefinitely on “estimating network fee.” The wallet-add flow uses Arc's primary RPC and six display decimals as recommended for wallet integrations.

USDC Max actions keep a 0.02 USDC reserve for approval plus execution fees. Fee, gas-balance, and gas-limit reads retry once across Arc RPC fallbacks. Arc's USDC ERC-20 interface is a precompile, so some wallets may describe an exact `approve` call as a withdrawal permission; LumenFi shows the expected spender and amount before that wallet request.

The lending pool is an MVP contract, not production lending infrastructure. Before mainnet use it needs audited accounting, oracle hardening, interest accrual, reserves, liquidation testing, and risk parameters per asset.

## Test Coverage

The repository includes Node test runner + Viem tests for the two core contract paths and the signed Agent policy guard:

- PermissionlessStablePool: add liquidity, quote, swap, and remove liquidity.
- LendingPool: deposit, borrow, LTV enforcement, repay, and healthy withdrawal.
- Agent policy: EIP-712 binding, wallet-scoped activity, current-price action and budget limits, expiry, revocation, block freshness, Vietnamese intent handling, and fail-safe partial-read behavior.

Run:

```bash
npm test
```

## License

MIT


