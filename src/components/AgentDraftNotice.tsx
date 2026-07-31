import { Check, Sparkles, X } from "lucide-react";
import type { AgentActionDraft } from "../lib/agent";

type AgentDraftNoticeProps = {
  draft?: AgentActionDraft;
  onDismiss?: () => void;
};

export function AgentDraftNotice({ draft, onDismiss }: AgentDraftNoticeProps) {
  if (!draft) return null;

  return (
    <aside className="agentDraftNotice" aria-label="Agent-prepared action">
      <div className="agentDraftNoticeHeader">
        <span><Sparkles size={15} />Agent-prepared draft</span>
        {onDismiss && (
          <button type="button" onClick={onDismiss} aria-label="Dismiss agent draft">
            <X size={14} />
          </button>
        )}
      </div>
      <div className="agentDraftNoticeBody">
        <div>
          <strong>{draft.title}</strong>
          <p>{draft.rationale}</p>
        </div>
        <dl>
          <div><dt>Action</dt><dd>{draft.action}</dd></div>
          <div><dt>Amount</dt><dd>{draft.amount} {draft.asset}</dd></div>
          <div><dt>Evidence</dt><dd>{draft.sourceBlock ? `Arc block ${draft.sourceBlock}` : "Latest available reads"}</dd></div>
        </dl>
      </div>
      <div className="agentDraftChecks">
        {draft.checks.map((check) => <span key={check}><Check size={12} />{check}</span>)}
      </div>
      <p className="agentDraftBoundary">Review the live values below. No transaction has been sent.</p>
    </aside>
  );
}
