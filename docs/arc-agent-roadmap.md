# LumenFi agent roadmap

This roadmap separates capabilities that are live from work that still requires design, security review, or external infrastructure.

## Live: onchain action planner

The current agent reads Arc state and prepares bounded user actions.

- Wallet balances for USDC and EURC.
- Lending collateral, debt, available borrow, and health.
- Pool reserves and current Arc block evidence.
- Supply, repay, swap, and bridge drafts with explicit amounts.
- Live revalidation inside the destination module.
- Wallet approval and signing for every transaction.

The agent cannot access private keys, approve tokens, or execute in the background.

## Next: stronger evidence and simulation

- Record the exact block, contract addresses, inputs, and assumptions used for each recommendation.
- Show expected balance and health changes before the wallet opens.
- Reject stale drafts after a bounded block or time window.
- Add structured tests for every intent and degraded-data path.

## Next: model-assisted explanation

A server-side reasoning layer may translate natural-language requests into a strict action schema. Contract reads, limits, and transaction construction remain deterministic tools rather than model-generated calldata.

Required controls:

- Schema-validated tool calls.
- No browser-exposed model credentials.
- Prompt-injection and untrusted-content boundaries.
- Deterministic policy checks after model output.
- Complete traces for inputs, tools, and final drafts.

## Research: permissioned execution

Future automation must use a restricted smart-wallet policy rather than unrestricted custody.

- Contract and function allowlists.
- Per-action and daily USDC limits.
- Expiry and immediate revocation.
- Simulation before execution.
- Explicit user confirmation for financial actions.
- Emergency pause and activity monitoring.

## Not planned for the current release

- Unrestricted autonomous trading.
- Custody of user keys.
- Background borrowing or leverage changes.
- Production financial advice.
- Mainnet deployment before audits and risk infrastructure.

## Acceptance criteria

Each roadmap item must have a visible product state, a reproducible test, and an explorer-verifiable result where an onchain action is involved. A feature is not marked live because a control exists in the interface.
