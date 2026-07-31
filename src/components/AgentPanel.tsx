import { ArrowRight, Bot, BrainCircuit, CheckCircle2, Clock3, Database, ExternalLink, RefreshCcw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Address } from "viem";
import type { TokenSymbol } from "../lib/arc";
import { AgentTrace } from "./AgentTrace";
import {
  buildAgentAnswer,
  loadAgentSnapshot,
  type AgentActionDraft,
  type AgentActivity,
  type AgentAnswer,
  type AgentDestination,
  type AgentSnapshot
} from "../lib/agent";

type AgentPanelProps = {
  address?: Address;
  balances: Partial<Record<TokenSymbol, bigint>>;
  balancesLoading: boolean;
  activity: AgentActivity[];
  onConnect: () => Promise<void>;
  onNavigate: (destination: AgentDestination, draft?: AgentActionDraft) => void;
};

const promptPresets = [
  "Review my portfolio",
  "Check lending risk",
  "Find a guarded yield action",
  "Plan a USDC/EURC swap",
  "Prepare a bridge"
];

export function AgentPanel({ address, balances, balancesLoading, activity, onConnect, onNavigate }: AgentPanelProps) {
  const [snapshot, setSnapshot] = useState<AgentSnapshot>();
  const [answer, setAnswer] = useState<AgentAnswer>();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestRef = useRef(0);

  async function refresh(nextPrompt = "Review my portfolio") {
    if (!address) return;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError("");

    try {
      const nextSnapshot = await loadAgentSnapshot(address, balances);
      if (requestId !== requestRef.current) return;
      setSnapshot(nextSnapshot);
      setAnswer(buildAgentAnswer(nextSnapshot, nextPrompt));
    } catch (cause) {
      if (requestId !== requestRef.current) return;
      setError(cause instanceof Error ? cause.message : "The Arc data review could not be completed.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }

  function ask(nextPrompt: string) {
    const cleanPrompt = nextPrompt.trim();
    if (!cleanPrompt) return;
    setPrompt(cleanPrompt);
    if (snapshot) {
      setAnswer(buildAgentAnswer(snapshot, cleanPrompt));
      return;
    }
    refresh(cleanPrompt).catch(() => undefined);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    ask(prompt);
  }

  useEffect(() => {
    setSnapshot(undefined);
    setAnswer(undefined);
    setError("");
    if (address && !balancesLoading) refresh().catch(() => undefined);
    return () => {
      requestRef.current += 1;
    };
  }, [address, balancesLoading]);

  if (!address) {
    return (
      <section className="agentConnectState">
        <div className="agentOrb" aria-hidden="true"><BrainCircuit size={28} /></div>
        <p className="eyebrow">User-controlled Arc agent</p>
        <h2>Connect a wallet for account-aware guidance.</h2>
        <p>The LumenFi Agent reads public Arc state, builds a bounded action draft, and hands it to the connected wallet for review. It never signs transactions itself.</p>
        <button className="primaryButton" type="button" onClick={onConnect}>Connect wallet <ArrowRight size={17} /></button>
      </section>
    );
  }

  return (
    <section className="agentWorkspace" aria-label="LumenFi AI Agent">
      <div className="agentCommand">
        <div className="agentIdentity">
          <div className="agentOrb" aria-hidden="true"><Bot size={24} /></div>
          <div>
            <p className="eyebrow">Arc action planner, beta</p>
            <h2>LumenFi Agent</h2>
          </div>
          <span className="agentOnline"><i />Onchain reads</span>
        </div>

        <div className="agentBoundary">
          <ShieldCheck size={18} />
          <div><strong>User approval boundary</strong><span>Agent drafts; the wallet validates and signs</span></div>
        </div>

        <form className="agentPrompt" onSubmit={submit}>
          <label htmlFor="agent-question">Ask about this wallet</label>
          <div>
            <input
              id="agent-question"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Check my lending risk..."
              autoComplete="off"
            />
            <button type="submit" aria-label="Analyze prompt" disabled={loading || !prompt.trim()}><Send size={17} /></button>
          </div>
        </form>

        <div className="agentPresets" aria-label="Suggested agent prompts">
          {promptPresets.map((preset) => (
            <button type="button" key={preset} onClick={() => ask(preset)} disabled={loading}>{preset}</button>
          ))}
        </div>

        <button className="agentRefresh" type="button" onClick={() => refresh(prompt || "Review my portfolio")} disabled={loading}>
          <RefreshCcw className={loading ? "spin" : ""} size={16} />
          {loading ? "Reading Arc state..." : "Refresh onchain evidence"}
        </button>
      </div>

      <div className="agentOutput" aria-live="polite">
        {loading && !answer ? (
          <div className="agentLoading" role="status">
            <Sparkles size={22} />
            <div><strong>Building account brief</strong><span>Reading balances, lending state, pool reserves, and the latest Arc block.</span></div>
            <AgentTrace loading />
          </div>
        ) : error ? (
          <div className="agentError" role="alert">
            <strong>Arc data is unavailable</strong>
            <p>{error}</p>
            <button type="button" onClick={() => refresh(prompt || "Review my portfolio")}>Try again</button>
          </div>
        ) : answer && snapshot ? (
          <>
            <header className="agentAnswerHeader">
              <div>
                <p className="eyebrow">{answer.intent} brief</p>
                <h3>{answer.headline}</h3>
                <p>{answer.summary}</p>
              </div>
              <Sparkles size={21} />
            </header>

            <div className="agentFacts">
              {answer.details.map((detail) => <div key={detail}><span /><p>{detail}</p></div>)}
            </div>

            <AgentTrace snapshot={snapshot} />

            <div className="agentRecommendations">
              <p className="agentSectionLabel">Prepared action plan</p>
              {answer.recommendations.map((item) => (
                <article className={`agentRecommendation ${item.tone}`} key={`${item.destination}-${item.title}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                    {item.draft && (
                      <div className="agentDraftPreview">
                        <span>{item.draft.action}</span>
                        <b>{item.draft.amount} {item.draft.asset}{item.draft.secondaryAsset ? ` → ${item.draft.secondaryAsset}` : ""}</b>
                        <small>{item.draft.expectedOutcome}</small>
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => onNavigate(item.destination, item.draft)}>{item.actionLabel}<ArrowRight size={15} /></button>
                </article>
              ))}
            </div>

            {activity.length > 0 && (
              <section className="agentActivity" aria-label="Recent agent-assisted transactions">
                <div className="agentActivityHeader">
                  <div><CheckCircle2 size={16} /><span>Verified outcomes</span></div>
                  <small>Wallet-approved transactions</small>
                </div>
                {activity.slice(0, 3).map((item) => (
                  <a href={`https://testnet.arcscan.app/tx/${item.txHash}`} target="_blank" rel="noreferrer" key={item.id}>
                    <span><strong>{item.title}</strong><small>{new Date(item.completedAt).toLocaleString()}</small></span>
                    <code>{item.txHash.slice(0, 8)}...{item.txHash.slice(-6)}</code>
                    <ExternalLink size={13} />
                  </a>
                ))}
              </section>
            )}

            <footer className="agentEvidence">
              <span><Database size={14} />{snapshot.blockNumber ? `Arc block ${snapshot.blockNumber}` : "Block unavailable"}</span>
              <span><Clock3 size={14} />{new Date(snapshot.observedAt).toLocaleTimeString()}</span>
              <span>{snapshot.warnings.length ? `${snapshot.warnings.length} partial read warning(s)` : "All evidence reads completed"}</span>
            </footer>
          </>
        ) : null}
      </div>
    </section>
  );
}
