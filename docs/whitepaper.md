# LumenFi whitepaper

LumenFi is a solo-built testnet project. It is not audited, production-ready, or financial advice.

## Product thesis

Stablecoin users still move between separate tools to check balances, swap assets, manage collateral, bridge USDC, and verify transactions. Each handoff adds network, token, approval, and fee decisions.

LumenFi tests a single Arc-native workspace where those decisions remain visible and close to the action. Arc is a useful environment for this experiment because USDC is the network gas token and the chain supports standard EVM wallets, Solidity contracts, and viem-based applications.

## Live product surface

### Wallet and network

Users connect an injected EVM wallet, switch to Arc Testnet, and read USDC and EURC balances. Before each contract write, LumenFi estimates gas, applies bounded EIP-1559 fee fields, and verifies that the wallet can cover the maximum network fee in USDC.

USDC Max actions reserve 0.02 USDC for approval and execution fees. Arc RPC fee reads retry before reporting an estimation failure, and the swap interface identifies the exact pool spender and approval amount because wallets can describe Arc's USDC precompile approval in unfamiliar terms.

### Stablecoin market

The deployed LumenFi pool supports USDC/EURC swaps and permissionless liquidity. The interface shows total liquidity estimated from contract prices, token reserves, the current quote, price impact, minimum received, wallet balances, and LP ownership.

Swap slippage and deadlines are enforced by the contract. Liquidity additions and removals also use minimum-output checks so the values shown before signing are not presentation-only.

### Lending market

The lending contract supports USDC and EURC deposits, withdrawals, borrowing, repayment, and liquidation. The interface shows collateral value, debt value, available borrowing power, and account health.

Rates are fixed interface parameters for this testnet release. Asset prices are owner-managed contract values, not decentralized oracle feeds.

### Cross-chain USDC

The bridge workspace integrates Circle App Kit for supported testnet routes and Unified Balance reads. Route availability depends on the connected wallet, source-chain funds, RPC availability, and Circle infrastructure. The interface reports unavailable routes instead of presenting them as completed transfers.

### Onchain action agent

The LumenFi Agent is a deterministic, user-controlled action planner. It reads wallet balances, lending positions, pool reserves, asset prices, and the current Arc block, then prepares a bounded swap, supply, repay, or bridge draft.

The current release does not send prompts to an external language model and does not hold keys. It cannot approve tokens or sign transactions. Destination modules refresh live state before execution, and the connected wallet remains the only signer.

Users can sign an EIP-712 policy that constrains Agent-prepared actions by allowlist, per-action USDC-equivalent limit, rolling 24-hour limit, expiry, revocation state, and Arc block freshness. Activity is stored per wallet. The policy hash and signature are verified when loaded, then the signature, draft fields, current Arc block, current contract price, and remaining limits are checked again before swap, lending, or bridge execution. Incomplete lending, price, or pool evidence does not produce a position-changing draft. This is an application-level guard, not a session key or autonomous smart account.

## Architecture

- React, TypeScript, and Vite frontend.
- viem for Arc Testnet reads, simulations, fee preparation, and wallet writes.
- Solidity contracts for lending and the USDC/EURC liquidity pool.
- Circle App Kit integration for cross-chain and Unified Balance workflows.
- Cloudflare Pages and a narrowly scoped proxy worker for public deployment.

The application lazy-loads market, bridge, and agent modules. Public RPC reads use bounded retry and fallback transports. Transaction results remain visible in the active module and link to Arc Explorer.

## Deployed contracts

### LendingPool

Address: `0x474552ce815a68443bdfcafd089cdb345791d204`

Core actions: deposit, withdraw, borrow, repay, liquidate, and account health reads.

Testnet parameters: 70% loan-to-value, 85% liquidation threshold, and 5% liquidation bonus.

### PermissionlessStablePool

Address: `0x212622812664e37abbb99774ee7488bc721b38b3`

Core actions: add liquidity, remove liquidity, quote, and swap for USDC/EURC.

### Assets

- USDC: `0x3600000000000000000000000000000000000000`
- EURC: `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a`

## Safety boundaries

- Testnet assets only.
- No custody or background execution.
- Explicit wallet approval for every write.
- Wallet-signed limits for Agent-prepared actions.
- Immediate policy revocation and stale-draft rejection.
- Gas and contract-call preflight before the wallet request.
- Onchain slippage limits for swaps and liquidity operations.
- Clear degraded states when RPC, market, or App Kit data is unavailable.
- Public contract addresses and explorer-linked receipts.

## Current limitations

LumenFi has not completed a smart-contract audit. The lending market uses owner-managed prices, fixed interface rates, and no interest accrual or reserve model. The pool is a compact constant-product implementation with limited testnet liquidity. Bridge completion can span multiple chains and external services. Signed Agent policies are enforced inside LumenFi and do not restrict direct contract calls made elsewhere.

A production release would require independent audits, invariant and fuzz testing, decentralized price infrastructure, asset caps, pause and incident controls, monitoring, bridge recovery flows, compliance review, and a formal upgrade policy.

## Roadmap

1. **Live — Core market release:** wallet connection, Arc balances, navigation, explorer-linked receipts, public contract references, and release documentation.
2. **Live — Permissionless LP pool:** USDC/EURC swaps, open liquidity provision, LP shares, fee accrual, minimum-output protection, reserves, and total-liquidity estimates.
3. **Beta — Circle bridge routes:** App Kit estimates, bridge requests, Unified Balance reads, pending states, and explicit recovery messages for supported testnet paths.
4. **Live — Lending market and risk controls:** USDC/EURC supply, withdraw, borrow, repay, liquidation logic, account health, borrowing limits, and max-withdraw guidance.
5. **Live — Market analytics:** live quotes, pool rate, minimum received, price impact, reserve depth, wallet balances, and LP ownership.
6. **Live — Onchain action agent:** deterministic intent classification, current Arc evidence, bounded supply, repay, swap, and bridge drafts, fail-safe handling of incomplete reads, and mandatory wallet confirmation.
7. **Live — Signed permission controls:** EIP-712 action allowlists, current-price USDC-equivalent action and rolling limits, expiry, local revocation, block freshness, wallet-scoped activity, signature verification, and final preflight. These controls apply inside LumenFi and are not onchain session permissions.
8. **Next — Model-assisted reasoning:** schema-bound natural-language intent, server-held model credentials, deterministic tools, prompt-injection boundaries, and complete decision traces.
9. **Planned — ERC-4337 smart-account relay:** audited smart accounts, scoped session permissions, bundler and paymaster recovery, user-operation simulation, and onchain policy enforcement.
10. **Planned — Independent risk engine:** resilient oracle inputs, stale-price rejection, dynamic rates, asset caps, liquidation monitoring, stress tests, audits, and incident controls.
11. **Research — Cross-chain strategy orchestration:** composed bridge, swap, and lending intents with route attestations, cost ceilings, recovery states, chain-specific limits, and settlement tracking.

## Verification

The repository includes contract tests and a live readiness script that checks deployed bytecode, token metadata, pool reserves, a real swap quote, listed lending assets, and transaction fee preparation.

Live application: https://lumenfi.click

Source code: https://github.com/Tiger1102/lumenfi

## Disclaimer

LumenFi is an Arc Testnet engineering build. Do not use it with production capital or rely on its output as financial advice.
