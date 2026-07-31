# LumenFi Arc agent roadmap

This roadmap follows the current Arc agentic economy documentation. It replaces the earlier generic Arc Blueprints wording with standards and acceptance criteria that can be verified on Arc Testnet.

## Current boundary

LumenFi does not currently run an autonomous agent. The live product provides wallet reads, swaps, liquidity, lending, bridge preparation, transaction receipts, and public contract links.

Agent features must progress from read-only analysis to narrowly authorized execution. No phase grants an agent unrestricted custody or unlimited transaction authority.

## Phase 06: ERC-8004 agent identity

Goal: give the LumenFi agent a verifiable onchain identity.

- Publish versioned agent metadata.
- Register through the Arc Testnet ERC-8004 IdentityRegistry.
- Display agent ID, owner, metadata URI, reputation, and validation status.
- Keep all portfolio and risk outputs read-only.

Acceptance criteria:

- Registration transaction is linked on Arcscan.
- The UI can read `ownerOf`, `tokenURI`, reputation feedback, and validation state.
- Agent version and capabilities are visible and auditable.

Arc references:

- IdentityRegistry: `0x8004A818BFB912233c491871b3d84c89A494BD9e`
- ReputationRegistry: `0x8004B663056A597Dffe9eCcC1965A193B7388713`
- ValidationRegistry: `0x8004Cb1BF31DAf7788923b405b754f57acEB4272`
- Guide: https://docs.arc.io/arc/tutorials/register-your-first-ai-agent

## Phase 07: read-only risk copilot

Goal: turn verified market and account state into explainable guidance.

- Monitor swap, liquidity, lending, and token events.
- Summarize collateral, debt, health factor, liquidity, and slippage.
- Produce action drafts with inputs, expected output, risks, and contract target.
- Never sign or submit a transaction.

Acceptance criteria:

- Every recommendation cites the block number and data timestamp.
- Stale or unavailable RPC data produces a clear warning instead of an action.
- Users can inspect the exact calldata intent before any later execution phase.

Arc reference:

- Event monitoring: https://docs.arc.io/arc/tutorials/monitor-contract-events

## Phase 08: ERC-8183 USDC jobs

Goal: support accountable agent work with escrow and evaluator approval.

- Create a job with provider, evaluator, expiry, and description.
- Set the budget and fund escrow in USDC.
- Submit a deliverable hash.
- Complete or reject the job through the evaluator role.
- Display job state and settlement transactions in LumenFi.

Acceptance criteria:

- The UI represents Open, Funded, Submitted, Completed, Rejected, and Expired states.
- Budget and escrow balances use six-decimal ERC-20 USDC values.
- Deliverables are content-addressed and independently verifiable.

Arc references:

- AgenticCommerce reference implementation: `0x0747EEf0706327138c69792bF28Cd525089e4583`
- Guide: https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job

## Phase 09: guarded execution research

Goal: test constrained execution without creating an unrestricted trading agent.

- Evaluate smart wallets, paymasters, and session keys.
- Allowlist contract addresses and function selectors.
- Apply per-action and daily USDC limits.
- Require expiry, revocation, simulation, and explicit confirmation.
- Log every proposed and submitted action.

No production execution is permitted without contract audits, monitoring, incident response, and a legal and compliance review.

Arc references:

- Account abstraction: https://docs.arc.io/arc/tools/account-abstraction
- Agentic economy: https://docs.arc.io/build/agentic-economy
