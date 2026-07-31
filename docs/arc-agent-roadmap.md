# LumenFi Arc agent roadmap

This roadmap maps the original LumenFi Arc Blueprint concept to a working read-only agent and the current Arc agentic economy standards. Each phase has a separately verifiable capability boundary.

## Current boundary

LumenFi now runs a read-only account analysis agent. It reads wallet balances, lending state, pool reserves, and the latest Arc block to produce portfolio, risk, yield, swap, and bridge guidance. It does not approve, sign, or submit transactions.

Agent features must progress from read-only analysis to narrowly authorized execution. No phase grants an agent unrestricted custody or unlimited transaction authority.

## Phase 06: AI Agent (Arc Blueprints) beta

Goal: deliver the original LumenFi assistant scope with onchain-grounded, read-only guidance.

- Read wallet USDC and EURC balances.
- Read collateral, debt, borrow capacity, health factor, supplied assets, pool reserves, and the latest Arc block.
- Answer portfolio, risk, yield, passive management, swap, and bridge prompts.
- Link recommendations to the relevant user-controlled LumenFi module.
- Never request token approval or a wallet signature.

Acceptance criteria:

- A connected wallet receives an account brief sourced from live Arc reads.
- Every brief shows its observed block, timestamp, and partial-read warnings.
- RPC failures render an inline retry state instead of blocking the interface.
- Recommendations clearly distinguish displayed market rates from guaranteed returns.

Arc references:

- Agentic economy: https://docs.arc.io/build/agentic-economy
- Build overview: https://docs.arc.io/build

## Phase 07: ERC-8004 agent identity

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
