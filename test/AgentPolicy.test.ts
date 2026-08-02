import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentActionDraft, AgentActivity } from "../src/lib/agent";
import { hashTypedData, verifyTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { agentPolicyTypedData, evaluateAgentPolicy, type SignedAgentPolicy } from "../src/lib/agentPolicy";

const now = Date.parse("2026-08-02T12:00:00.000Z");
const owner = "0x0000000000000000000000000000000000000001" as const;

function policy(overrides: Partial<SignedAgentPolicy> = {}): SignedAgentPolicy {
  return {
    policy: {
      version: 1,
      owner,
      chainId: 5_042_002,
      allowedActions: { deposit: true, repay: true, swap: true, bridge: false },
      maxPerAction: "25",
      dailyLimit: "75",
      expiresAt: Math.floor(now / 1_000) + 3_600,
      maxDraftAgeBlocks: 50,
      nonce: `0x${"11".repeat(32)}`
    },
    policyId: `0x${"22".repeat(32)}`,
    signature: `0x${"33".repeat(65)}`,
    activatedAt: new Date(now - 1_000).toISOString(),
    ...overrides
  };
}

function draft(overrides: Partial<AgentActionDraft> = {}): AgentActionDraft {
  return {
    id: "swap-test",
    destination: "swap",
    action: "swap",
    asset: "USDC",
    secondaryAsset: "EURC",
    amount: "20",
    title: "Swap 20 USDC",
    rationale: "Test policy",
    expectedOutcome: "Policy evaluation",
    checks: [],
    createdAt: new Date(now).toISOString(),
    sourceBlock: "1000",
    ...overrides
  };
}

function activity(amount: string): AgentActivity {
  return {
    id: "activity-test",
    title: "Previous action",
    action: "deposit",
    asset: "USDC",
    amount,
    destination: "lending",
    txHash: `0x${"44".repeat(32)}`,
    completedAt: new Date(now - 60_000).toISOString()
  };
}

describe("LumenFi signed Agent policy", () => {
  it("binds the complete policy to an EIP-712 wallet signature", async () => {
    const account = privateKeyToAccount(`0x${"12".repeat(32)}`);
    const unsigned = { ...policy().policy, owner: account.address };
    const typedData = agentPolicyTypedData(unsigned);
    const signature = await account.signTypedData(typedData);
    assert.equal(await verifyTypedData({ address: account.address, signature, ...typedData }), true);
    assert.match(hashTypedData(typedData), /^0x[0-9a-f]{64}$/);
  });

  it("allows a fresh, allowlisted draft inside both budgets", () => {
    const decision = evaluateAgentPolicy(policy(), draft(), [activity("10")], "1020", now);
    assert.equal(decision.allowed, true);
    assert.equal(decision.dailyUsed, 10);
    assert.equal(decision.dailyRemaining, 65);
  });

  it("blocks action, daily-budget, expiry, revocation, and stale-evidence failures", () => {
    assert.equal(evaluateAgentPolicy(policy(), draft({ action: "bridge", destination: "bridge" }), [], "1020", now).allowed, false);
    assert.equal(evaluateAgentPolicy(policy(), draft({ amount: "26" }), [], "1020", now).allowed, false);
    assert.equal(evaluateAgentPolicy(policy(), draft(), [activity("60")], "1020", now).allowed, false);
    assert.equal(evaluateAgentPolicy(policy({ policy: { ...policy().policy, expiresAt: Math.floor(now / 1_000) - 1 } }), draft(), [], "1020", now).allowed, false);
    assert.equal(evaluateAgentPolicy(policy({ revokedAt: new Date(now).toISOString() }), draft(), [], "1020", now).allowed, false);
    assert.equal(evaluateAgentPolicy(policy(), draft(), [], "1100", now).allowed, false);
  });
});
