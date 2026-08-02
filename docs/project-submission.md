# LumenFi project submission

## Project

LumenFi is an Arc Testnet workspace for USDC/EURC swaps, permissionless liquidity, collateralized lending, cross-chain USDC preparation, and onchain account guidance.

Live application: https://lumenfi.click

Source code: https://github.com/Tiger1102/lumenfi

## What is live

- Injected-wallet connection and Arc Testnet switching.
- USDC and EURC wallet balances.
- Deployed USDC/EURC liquidity pool with swaps, LP shares, and withdrawals.
- Deployed lending contract with deposit, withdraw, borrow, repay, and account-health reads.
- Preflight gas estimation and USDC fee checks before contract writes.
- Explorer-linked transaction receipts.
- A deterministic action agent grounded in current Arc contract reads.
- Wallet-signed Agent policies with action, budget, expiry, revocation, and block-freshness controls.

The connected wallet is the only signer. The agent prepares bounded drafts and never holds keys or sends transactions independently.

## Why Arc

Arc aligns the gas asset, market assets, and protocol accounting around stablecoins. LumenFi uses this model to express network fees, collateral, liquidity, and account state in familiar units without introducing a separate volatile gas token.

## Technical implementation

- React, TypeScript, Vite, and native CSS.
- viem for Arc reads, simulations, fee preparation, and wallet transactions.
- Solidity and Hardhat for the lending and liquidity contracts.
- Circle App Kit integration for bridge and Unified Balance workflows.
- Cloudflare Pages for the public frontend.

LendingPool: `0x474552ce815a68443bdfcafd089cdb345791d204`

PermissionlessStablePool: `0x212622812664e37abbb99774ee7488bc721b38b3`

## Agent boundary

The current agent is an onchain action planner, not an autonomous custodian. It reads balances, lending risk, pool reserves, prices, and block evidence, then prepares a supply, repay, swap, or bridge draft. A connected wallet can sign an EIP-712 policy with action allowlists, per-action and rolling daily USDC-equivalent limits, expiry, immediate revocation, and a maximum draft age. Activity accounting is isolated per wallet, and the destination module verifies the signature, current Arc block, current contract price, draft fields, and remaining limits again before the wallet opens. Incomplete lending, price, or pool evidence does not produce a position-changing Agent draft.

No external language model or session-key relay is used in this release. This keeps recommendations reproducible for judging and makes the trust boundary explicit. The policy protects Agent flows inside LumenFi; it is not represented as onchain smart-account enforcement.

## Bridge status

The bridge page uses Circle App Kit interfaces for route estimates, execution, and Unified Balance reads. Availability depends on the connected wallet and supported testnet route. The app shows explicit errors when a route or service is unavailable.

## Validation

- Production build passes.
- Solidity compilation passes.
- Contract tests cover liquidity, swaps, slippage, expiry, lending LTV, repayment, and healthy withdrawals.
- Live checks confirm deployed bytecode, asset metadata, pool reserves, swap quotes, lending configuration, and Arc gas preparation.
- Responsive smoke tests cover desktop, mobile, landscape, and reduced-motion layouts.

## Review focus

Feedback is most useful on Arc-specific fee UX, the clarity of wallet-controlled agent drafts, lending risk communication, cross-chain recovery states, and the controls required before a production deployment.

## Release boundary

LumenFi is an unaudited testnet build. It is not a production lending product and is not financial advice.
