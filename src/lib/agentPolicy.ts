import { formatUnits, hashTypedData, parseUnits, type Address, type Hex, type WalletClient } from "viem";
import type { AgentActionDraft, AgentActionKind, AgentActivity } from "./agent";
import { arcPublicClient, ARC_TESTNET_CHAIN_ID, readWithRetry } from "./arc";
import { getLendingAssetPrice } from "./lending";

export const AGENT_ACTIVITY_STORAGE_KEY = "lumenfi:agent-activity:v2";
const POLICY_STORAGE_PREFIX = "lumenfi:agent-policy:v1";
const POLICY_DECIMALS = 6;
const ROLLING_DAY_MS = 24 * 60 * 60 * 1_000;

export const POLICY_ACTIONS: AgentActionKind[] = ["deposit", "repay", "swap", "bridge"];

export type AgentPolicyInput = {
  allowedActions: Record<AgentActionKind, boolean>;
  maxPerAction: string;
  dailyLimit: string;
  durationHours: number;
  maxDraftAgeBlocks: number;
};

export type AgentPolicy = {
  version: 1;
  owner: Address;
  chainId: number;
  allowedActions: Record<AgentActionKind, boolean>;
  maxPerAction: string;
  dailyLimit: string;
  expiresAt: number;
  maxDraftAgeBlocks: number;
  nonce: Hex;
};

export type SignedAgentPolicy = {
  policy: AgentPolicy;
  policyId: Hex;
  signature: Hex;
  activatedAt: string;
  revokedAt?: string;
};

export type AgentPolicyDecision = {
  allowed: boolean;
  mode: "manual" | "policy";
  title: string;
  reason: string;
  checks: Array<{ label: string; passed: boolean }>;
  dailyUsed: number;
  dailyRemaining: number;
};

const policyTypes = {
  AgentPolicy: [
    { name: "owner", type: "address" },
    { name: "allowedActions", type: "uint8" },
    { name: "maxPerAction", type: "uint256" },
    { name: "dailyLimit", type: "uint256" },
    { name: "expiresAt", type: "uint64" },
    { name: "maxDraftAgeBlocks", type: "uint32" },
    { name: "nonce", type: "bytes32" }
  ]
} as const;

function policyStorageKey(owner: Address) {
  return `${POLICY_STORAGE_PREFIX}:${owner.toLowerCase()}`;
}

export function agentActivityStorageKey(owner: Address) {
  return `${AGENT_ACTIVITY_STORAGE_KEY}:${owner.toLowerCase()}`;
}

function actionMask(actions: Record<AgentActionKind, boolean>) {
  return POLICY_ACTIONS.reduce((mask, action, index) => mask | (actions[action] ? 1 << index : 0), 0);
}

function amountUnits(value: string) {
  return parseUnits(value || "0", POLICY_DECIMALS);
}

export function agentPolicyTypedData(policy: AgentPolicy) {
  return {
    domain: {
      name: "LumenFi Policy Guard",
      version: "1",
      chainId: ARC_TESTNET_CHAIN_ID
    },
    types: policyTypes,
    primaryType: "AgentPolicy" as const,
    message: {
      owner: policy.owner,
      allowedActions: actionMask(policy.allowedActions),
      maxPerAction: amountUnits(policy.maxPerAction),
      dailyLimit: amountUnits(policy.dailyLimit),
      expiresAt: BigInt(policy.expiresAt),
      maxDraftAgeBlocks: policy.maxDraftAgeBlocks,
      nonce: policy.nonce
    }
  };
}

function randomNonce(): Hex {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function defaultAgentPolicyInput(): AgentPolicyInput {
  return {
    allowedActions: { deposit: true, repay: true, swap: true, bridge: false },
    maxPerAction: "25",
    dailyLimit: "75",
    durationHours: 6,
    maxDraftAgeBlocks: 50
  };
}

export function validateAgentPolicyInput(input: AgentPolicyInput) {
  const maxPerAction = Number(input.maxPerAction);
  const dailyLimit = Number(input.dailyLimit);
  if (!POLICY_ACTIONS.some((action) => input.allowedActions[action])) {
    throw new Error("Allow at least one action before signing the policy.");
  }
  if (!Number.isFinite(maxPerAction) || maxPerAction <= 0) {
    throw new Error("Per-action limit must be greater than zero.");
  }
  if (!Number.isFinite(dailyLimit) || dailyLimit < maxPerAction) {
    throw new Error("Daily limit must be greater than or equal to the per-action limit.");
  }
  if (!Number.isInteger(input.durationHours) || input.durationHours < 1 || input.durationHours > 168) {
    throw new Error("Policy duration must be between 1 and 168 hours.");
  }
  if (!Number.isInteger(input.maxDraftAgeBlocks) || input.maxDraftAgeBlocks < 1 || input.maxDraftAgeBlocks > 5_000) {
    throw new Error("Draft freshness must be between 1 and 5,000 blocks.");
  }
  amountUnits(input.maxPerAction);
  amountUnits(input.dailyLimit);
}

export function createAgentPolicy(owner: Address, input: AgentPolicyInput): AgentPolicy {
  validateAgentPolicyInput(input);
  return {
    version: 1,
    owner,
    chainId: ARC_TESTNET_CHAIN_ID,
    allowedActions: { ...input.allowedActions },
    maxPerAction: input.maxPerAction,
    dailyLimit: input.dailyLimit,
    expiresAt: Math.floor(Date.now() / 1_000) + input.durationHours * 60 * 60,
    maxDraftAgeBlocks: input.maxDraftAgeBlocks,
    nonce: randomNonce()
  };
}

export async function signAgentPolicy(walletClient: WalletClient, owner: Address, policy: AgentPolicy): Promise<SignedAgentPolicy> {
  const typedData = agentPolicyTypedData(policy);
  const signature = await walletClient.signTypedData({ account: owner, ...typedData });
  const record: SignedAgentPolicy = {
    policy,
    policyId: hashTypedData(typedData),
    signature,
    activatedAt: new Date().toISOString()
  };
  const verified = await verifyAgentPolicyRecord(record, owner);
  if (!verified) throw new Error("The wallet signature did not verify for this policy.");
  return record;
}

export async function verifyAgentPolicyRecord(record: SignedAgentPolicy, owner: Address) {
  if (record.policy.owner.toLowerCase() !== owner.toLowerCase()) return false;
  if (record.policy.chainId !== ARC_TESTNET_CHAIN_ID || record.policy.version !== 1) return false;
  const typedData = agentPolicyTypedData(record.policy);
  if (hashTypedData(typedData) !== record.policyId) return false;
  return arcPublicClient.verifyTypedData({ address: owner, signature: record.signature, ...typedData });
}

export function saveAgentPolicy(record: SignedAgentPolicy) {
  window.localStorage.setItem(policyStorageKey(record.policy.owner), JSON.stringify(record));
}

export function readAgentPolicyRecord(owner: Address): SignedAgentPolicy | undefined {
  try {
    const stored = window.localStorage.getItem(policyStorageKey(owner));
    return stored ? (JSON.parse(stored) as SignedAgentPolicy) : undefined;
  } catch {
    return undefined;
  }
}

export async function loadVerifiedAgentPolicy(owner: Address): Promise<SignedAgentPolicy | undefined> {
  const record = readAgentPolicyRecord(owner);
  if (!record) return undefined;
  if (!(await verifyAgentPolicyRecord(record, owner))) {
    throw new Error("Stored policy signature is invalid. Revoke it and sign a new policy.");
  }
  return record;
}

export function revokeAgentPolicy(record: SignedAgentPolicy) {
  const revoked = { ...record, revokedAt: new Date().toISOString() };
  saveAgentPolicy(revoked);
  return revoked;
}

export function readAgentActivity(owner: Address): AgentActivity[] {
  try {
    const stored = window.localStorage.getItem(agentActivityStorageKey(owner));
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as AgentActivity[]).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function saveAgentActivity(owner: Address, activity: AgentActivity[]) {
  window.localStorage.setItem(agentActivityStorageKey(owner), JSON.stringify(activity.slice(0, 12)));
}

function rollingDailyUsage(activity: AgentActivity[], nowMs: number) {
  return activity.reduce((total, item) => {
    const completedAt = Date.parse(item.completedAt);
    const amount = Number(item.budgetAmountUsd ?? item.amount);
    if (!Number.isFinite(completedAt) || nowMs - completedAt > ROLLING_DAY_MS || !Number.isFinite(amount) || amount <= 0) return total;
    return total + amount;
  }, 0);
}

export function evaluateAgentPolicy(
  record: SignedAgentPolicy | undefined,
  draft: AgentActionDraft,
  activity: AgentActivity[],
  currentBlock?: string,
  nowMs = Date.now()
): AgentPolicyDecision {
  if (!record) {
    return {
      allowed: true,
      mode: "manual",
      title: "Manual wallet approval",
      reason: "No signed policy is active; the wallet remains the only authorization boundary.",
      checks: [],
      dailyUsed: 0,
      dailyRemaining: 0
    };
  }

  const { policy } = record;
  const amount = Number(draft.budgetAmountUsd ?? draft.amount);
  const maxPerAction = Number(policy.maxPerAction);
  const dailyLimit = Number(policy.dailyLimit);
  const dailyUsed = rollingDailyUsage(activity, nowMs);
  const expiresAtMs = policy.expiresAt * 1_000;
  const sourceBlock = draft.sourceBlock ? BigInt(draft.sourceBlock) : undefined;
  const observedBlock = currentBlock ? BigInt(currentBlock) : sourceBlock;
  const fresh = sourceBlock !== undefined && observedBlock !== undefined && observedBlock >= sourceBlock
    ? observedBlock - sourceBlock <= BigInt(policy.maxDraftAgeBlocks)
    : false;
  const checks = [
    { label: `${draft.action} is allowlisted`, passed: policy.allowedActions[draft.action] },
    { label: `${draft.amount} ${draft.asset} is within the ${policy.maxPerAction} USDC-equivalent action cap`, passed: Number.isFinite(amount) && amount > 0 && amount <= maxPerAction },
    { label: `Rolling usage remains within ${policy.dailyLimit} USDC equivalent`, passed: Number.isFinite(amount) && dailyUsed + amount <= dailyLimit },
    { label: "Policy is not expired", passed: nowMs < expiresAtMs },
    { label: `Evidence is within ${policy.maxDraftAgeBlocks} Arc blocks`, passed: fresh },
    { label: "Policy has not been revoked", passed: !record.revokedAt }
  ];
  const failed = checks.find((check) => !check.passed);

  return {
    allowed: !failed,
    mode: "policy",
    title: failed ? "Blocked by signed policy" : "Allowed by signed policy",
    reason: failed?.label ?? "All signed policy checks passed. The wallet must still approve and sign the transaction.",
    checks,
    dailyUsed,
    dailyRemaining: Math.max(0, dailyLimit - dailyUsed)
  };
}

export function attachPolicyAuthorization(draft: AgentActionDraft, record: SignedAgentPolicy): AgentActionDraft {
  return {
    ...draft,
    policyAuthorization: {
      policyId: record.policyId,
      expiresAt: new Date(record.policy.expiresAt * 1_000).toISOString()
    }
  };
}

export async function assertAgentDraftPolicy(
  owner: Address,
  draft: AgentActionDraft | undefined,
  expected: { action: AgentActionKind | "withdraw" | "borrow"; asset: string; amount: string; secondaryAsset?: string }
) {
  if (!draft) return;
  const sameAmount = amountUnits(draft.amount) === amountUnits(expected.amount);
  const sameAction = draft.action === expected.action && draft.asset === expected.asset;
  const sameSecondaryAsset = !draft.secondaryAsset || draft.secondaryAsset === expected.secondaryAsset;
  if (!sameAmount || !sameAction || !sameSecondaryAsset) {
    throw new Error("Agent draft changed after review. Return to Agent and prepare a new action.");
  }
  if (expected.asset !== "USDC" && expected.asset !== "EURC") {
    throw new Error("Agent policy pricing is only available for USDC and EURC actions.");
  }

  const stored = readAgentPolicyRecord(owner);
  if (!stored) {
    if (draft.policyAuthorization) throw new Error("The signed policy for this draft is no longer available.");
    return;
  }
  const [verified, currentBlock, currentAssetPrice] = await Promise.all([
    verifyAgentPolicyRecord(stored, owner),
    readWithRetry(() => arcPublicClient.getBlockNumber(), "Agent policy block"),
    getLendingAssetPrice(expected.asset)
  ]);
  if (!verified) {
    throw new Error("Stored policy signature is invalid. Revoke it and sign a new policy.");
  }
  if (draft.policyAuthorization?.policyId && draft.policyAuthorization.policyId !== stored.policyId) {
    throw new Error("The active policy changed after this draft was prepared. Return to Agent and review it again.");
  }
  const currentBudgetUnits = (amountUnits(expected.amount) * currentAssetPrice) / 1_000_000n;
  const repricedDraft = { ...draft, budgetAmountUsd: formatUnits(currentBudgetUnits, POLICY_DECIMALS) };
  const decision = evaluateAgentPolicy(stored, repricedDraft, readAgentActivity(owner), currentBlock.toString());
  if (!decision.allowed) throw new Error(`Policy blocked this action: ${decision.reason}.`);
}
