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

## Live: signed permission controls

The Agent workspace now lets a connected wallet sign an EIP-712 policy for LumenFi-prepared drafts.

- Action allowlists for supply, repay, swap, and bridge.
- Per-action and rolling 24-hour USDC-equivalent limits using the draft's observed asset price.
- Expiry from one hour to seven days.
- Immediate local revocation and signed-policy replacement.
- Maximum Arc block age for recommendation evidence.
- Signature and policy-hash verification when the policy loads.
- A second policy check immediately before approval or execution.
- Existing gas estimation and contract-call simulation before the wallet request.

The signed policy is an application-level guard. It does not create a smart account, grant a session key, or protect calls made outside LumenFi. Every transaction still requires the connected wallet.

## Next: model-assisted reasoning

A server-side reasoning layer may translate natural-language requests into a strict action schema. Contract reads, limits, and transaction construction remain deterministic tools rather than model-generated calldata.

Required controls:

- Schema-validated tool calls.
- No browser-exposed model credentials.
- Prompt-injection and untrusted-content boundaries.
- Deterministic policy checks after model output.
- Complete traces for inputs, tools, and final drafts.

## Planned: ERC-4337 execution

Connect an audited smart-account provider, bundler, and paymaster so short-lived session permissions can submit actions that pass the same LumenFi policy schema.

- Contract-address and function-selector allowlists.
- Session-key scope, expiry, and immediate onchain revocation.
- Per-action and daily limits enforced by the smart account.
- Bundler and paymaster failure recovery.
- User-operation simulation before relay.
- Emergency pause and activity monitoring.

This phase requires an external ERC-4337 provider and independently reviewed smart-account modules. It is not marked live in the current release.

## Planned: independent risk engine

- Resilient oracle inputs and stale-price rejection.
- Utilization-based borrow and supply rates.
- Asset caps, liquidation monitoring, and stress tests.
- Machine-readable explanations for every risk decision.

## Research: cross-chain orchestration

- Route attestations and cost ceilings.
- Bridge, swap, and lending intent composition.
- End-to-end settlement states and recovery actions.
- Chain-specific policy limits and audit trails.

## Not planned for the current release

- Unrestricted autonomous trading.
- Custody of user keys.
- Background borrowing or leverage changes.
- Production financial advice.
- Mainnet deployment before audits and risk infrastructure.

## Acceptance criteria

Each roadmap item must have a visible product state, a reproducible test, and an explorer-verifiable result where an onchain action is involved. A feature is not marked live because a control exists in the interface.
