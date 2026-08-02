import { Check, Clock3, KeyRound, LockKeyhole, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Address, WalletClient } from "viem";
import type { AgentActionKind, AgentActivity } from "../lib/agent";
import {
  POLICY_ACTIONS,
  createAgentPolicy,
  defaultAgentPolicyInput,
  revokeAgentPolicy,
  saveAgentPolicy,
  signAgentPolicy,
  type AgentPolicyInput,
  type SignedAgentPolicy
} from "../lib/agentPolicy";

type AutomationPolicyPanelProps = {
  address: Address;
  walletClient?: WalletClient;
  activity: AgentActivity[];
  policy?: SignedAgentPolicy;
  policyError?: string;
  onPolicyChange: (policy: SignedAgentPolicy) => void;
};

const actionLabels: Record<AgentActionKind, string> = {
  deposit: "Supply",
  repay: "Repay",
  swap: "Swap",
  bridge: "Bridge"
};

function inputFromPolicy(policy?: SignedAgentPolicy): AgentPolicyInput {
  if (!policy) return defaultAgentPolicyInput();
  return {
    allowedActions: { ...policy.policy.allowedActions },
    maxPerAction: policy.policy.maxPerAction,
    dailyLimit: policy.policy.dailyLimit,
    durationHours: 6,
    maxDraftAgeBlocks: policy.policy.maxDraftAgeBlocks
  };
}

export function AutomationPolicyPanel({ address, walletClient, activity, policy, policyError, onPolicyChange }: AutomationPolicyPanelProps) {
  const [input, setInput] = useState<AgentPolicyInput>(() => inputFromPolicy(policy));
  const [busy, setBusy] = useState<"sign" | "revoke">();
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(!policy);
  const active = Boolean(policy && !policy.revokedAt && policy.policy.expiresAt * 1_000 > Date.now());
  const usedToday = useMemo(() => activity.reduce((total, item) => {
    const recent = Date.now() - Date.parse(item.completedAt) <= 24 * 60 * 60 * 1_000;
    const amount = Number(item.budgetAmountUsd ?? item.amount);
    return recent && Number.isFinite(amount) ? total + amount : total;
  }, 0), [activity]);

  useEffect(() => {
    if (policy) setInput(inputFromPolicy(policy));
  }, [policy?.policyId]);

  function updateAction(action: AgentActionKind, enabled: boolean) {
    setInput((current) => ({ ...current, allowedActions: { ...current.allowedActions, [action]: enabled } }));
  }

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!walletClient) {
      setError("Reconnect the wallet before signing a policy.");
      return;
    }
    setBusy("sign");
    setError("");
    try {
      const nextPolicy = createAgentPolicy(address, input);
      const signed = await signAgentPolicy(walletClient, address, nextPolicy);
      saveAgentPolicy(signed);
      onPolicyChange(signed);
      setExpanded(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The policy could not be signed.");
    } finally {
      setBusy(undefined);
    }
  }

  function revoke() {
    if (!policy) return;
    setBusy("revoke");
    const revoked = revokeAgentPolicy(policy);
    onPolicyChange(revoked);
    setExpanded(true);
    setBusy(undefined);
  }

  return (
    <section className="agentPolicyConsole" aria-labelledby="agent-policy-title">
      <header className="agentPolicyHeader">
        <div>
          <p className="eyebrow">Signed policy guard</p>
          <h3 id="agent-policy-title">Permission controls</h3>
          <p>Bind Agent drafts to explicit action, budget, expiry, and freshness limits.</p>
        </div>
        <span className={`agentPolicyState ${active ? "active" : "inactive"}`}>
          {active ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
          {active ? "Active" : policy?.revokedAt ? "Revoked" : policy ? "Expired" : "Not configured"}
        </span>
      </header>

      {policy && (
        <div className="agentPolicyMetrics" aria-label="Policy status">
          <div><span>Per action</span><strong>{policy.policy.maxPerAction} USDC-eq</strong></div>
          <div><span>Daily remaining</span><strong>{Math.max(0, Number(policy.policy.dailyLimit) - usedToday).toFixed(2)} USDC-eq</strong></div>
          <div><span>Expires</span><strong>{new Date(policy.policy.expiresAt * 1_000).toLocaleString()}</strong></div>
          <div><span>Policy</span><strong title={policy.policyId}>{policy.policyId.slice(0, 8)}...{policy.policyId.slice(-6)}</strong></div>
        </div>
      )}

      <button className="agentPolicyDisclosure" type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
        <span><KeyRound size={16} />{policy ? "Review or replace policy" : "Configure policy"}</span>
        <span>{expanded ? "Hide" : "Open"}</span>
      </button>

      {expanded && (
        <form className="agentPolicyForm" onSubmit={activate}>
          <fieldset>
            <legend>Allowed Agent actions</legend>
            <div className="agentPolicyActions">
              {POLICY_ACTIONS.map((action) => (
                <label key={action}>
                  <input type="checkbox" checked={input.allowedActions[action]} onChange={(event) => updateAction(action, event.target.checked)} />
                  <span><Check size={13} />{actionLabels[action]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="agentPolicyFields">
            <label>
              <span>Maximum per action</span>
              <div><input value={input.maxPerAction} onChange={(event) => setInput((current) => ({ ...current, maxPerAction: event.target.value }))} inputMode="decimal" /><b>USDC-eq</b></div>
              <small>Hard cap for one Agent-prepared action.</small>
            </label>
            <label>
              <span>Rolling 24-hour limit</span>
              <div><input value={input.dailyLimit} onChange={(event) => setInput((current) => ({ ...current, dailyLimit: event.target.value }))} inputMode="decimal" /><b>USDC-eq</b></div>
              <small>Includes verified Agent-assisted receipts.</small>
            </label>
            <label>
              <span>Policy duration</span>
              <div><input value={input.durationHours} onChange={(event) => setInput((current) => ({ ...current, durationHours: Number(event.target.value) }))} inputMode="numeric" /><b>hours</b></div>
              <small>Valid from 1 to 168 hours.</small>
            </label>
            <label>
              <span>Draft freshness</span>
              <div><input value={input.maxDraftAgeBlocks} onChange={(event) => setInput((current) => ({ ...current, maxDraftAgeBlocks: Number(event.target.value) }))} inputMode="numeric" /><b>blocks</b></div>
              <small>Stale evidence is rejected before execution.</small>
            </label>
          </div>

          {(error || policyError) && <p className="agentPolicyError" role="alert">{error || policyError}</p>}
          <div className="agentPolicyControls">
            <button className="primaryButton" type="submit" disabled={Boolean(busy)}>
              <LockKeyhole size={16} />{busy === "sign" ? "Waiting for signature..." : policy ? "Sign replacement policy" : "Sign and activate"}
            </button>
            {policy && !policy.revokedAt && (
              <button className="agentPolicyRevoke" type="button" onClick={revoke} disabled={Boolean(busy)}>
                Revoke now
              </button>
            )}
          </div>
          <p className="agentPolicyBoundary"><Clock3 size={14} />This signature does not grant custody or background execution. Every transaction still opens in the wallet.</p>
        </form>
      )}
    </section>
  );
}
