import { AlertTriangle, Check, ChevronDown, CircleDot, Database, Landmark, ScanSearch, WalletCards } from "lucide-react";
import type { AgentSnapshot } from "../lib/agent";

type TraceStatus = "success" | "warning" | "active" | "pending";

type TraceStep = {
  title: string;
  detail: string;
  meta: string;
  status: TraceStatus;
  icon: typeof Database;
};

type AgentTraceProps = {
  loading?: boolean;
  snapshot?: AgentSnapshot;
};

function hasWarning(snapshot: AgentSnapshot | undefined, pattern: RegExp) {
  return Boolean(snapshot?.warnings.some((warning) => pattern.test(warning)));
}

function traceSteps(loading: boolean, snapshot?: AgentSnapshot): TraceStep[] {
  if (loading) {
    return [
      {
        title: "Wallet context received",
        detail: "Using the connected Arc address as the analysis subject. Signing authority remains in the wallet.",
        meta: "complete",
        status: "success",
        icon: WalletCards
      },
      {
        title: "Reading Arc market state",
        detail: "Requesting wallet balances, lending positions, USD prices, pool reserves, and the latest block in parallel.",
        meta: "6 sources",
        status: "active",
        icon: ScanSearch
      },
      {
        title: "Building account brief",
        detail: "Risk and allocation rules run only after the evidence reads settle, then produce a bounded action draft.",
        meta: "queued",
        status: "pending",
        icon: CircleDot
      }
    ];
  }

  const priceWarning = hasWarning(snapshot, /price/i);
  const lendingWarning = hasWarning(snapshot, /lending/i);
  const poolWarning = hasWarning(snapshot, /pool/i);
  const blockWarning = hasWarning(snapshot, /block/i);

  return [
    {
      title: "Wallet balances and prices",
      detail: priceWarning
        ? "Token balances loaded, but USD pricing used the documented parity fallback."
        : "USDC/EURC balances were valued with LendingPool USD prices.",
      meta: priceWarning ? "partial" : "verified",
      status: priceWarning ? "warning" : "success",
      icon: WalletCards
    },
    {
      title: "Lending position and health",
      detail: lendingWarning
        ? "One or more lending reads were unavailable; the brief avoids position-changing guidance."
        : "Collateral, debt, available borrow capacity, supplied assets, and health state were read from LendingPool.",
      meta: lendingWarning ? "partial" : "verified",
      status: lendingWarning ? "warning" : "success",
      icon: Landmark
    },
    {
      title: "Market liquidity context",
      detail: poolWarning
        ? "Pool reserves were unavailable, so swap guidance requires a fresh quote in the Swap module."
        : "USDC and EURC pool reserves were included as market context.",
      meta: poolWarning ? "partial" : "verified",
      status: poolWarning ? "warning" : "success",
      icon: Database
    },
    {
      title: "Arc evidence anchor",
      detail: blockWarning
        ? "The latest block number was unavailable; use Refresh before acting on this brief."
        : `Analysis anchored to Arc block ${snapshot?.blockNumber ?? "unavailable"}.`,
      meta: blockWarning ? "retry advised" : "verified",
      status: blockWarning ? "warning" : "success",
      icon: ScanSearch
    },
    {
      title: "Bounded action draft generated",
      detail: "The agent can prefill a supported module, but it cannot approve or sign. Live module validation and wallet confirmation remain mandatory.",
      meta: "user controlled",
      status: "success",
      icon: CircleDot
    }
  ];
}

// Interaction pattern adapted for LumenFi's native CSS stack from 21st's AI Planning Workflow.
export function AgentTrace({ loading = false, snapshot }: AgentTraceProps) {
  const steps = traceSteps(loading, snapshot);
  const warningCount = steps.filter((step) => step.status === "warning").length;
  const traceLabel = loading
    ? "Reading onchain evidence"
    : warningCount
      ? `${warningCount} partial source${warningCount === 1 ? "" : "s"}`
      : "All reads verified";

  return (
    <details className="agentTrace" open>
      <summary>
        <span className={`agentTraceState ${loading ? "active" : warningCount ? "warning" : "success"}`}>
          {loading ? <ScanSearch size={15} /> : warningCount ? <AlertTriangle size={15} /> : <Check size={15} />}
        </span>
        <span><strong>Onchain analysis trace</strong><small>{traceLabel}</small></span>
        <ChevronDown className="agentTraceChevron" size={16} />
      </summary>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li className={step.status} key={step.title}>
              <span className="agentTraceIcon">
                {step.status === "success" ? <Check size={13} /> : step.status === "warning" ? <AlertTriangle size={13} /> : <Icon size={13} />}
              </span>
              <div>
                <header><strong>{step.title}</strong><em>{step.meta}</em></header>
                <p>{step.detail}</p>
              </div>
              {index < steps.length - 1 && <i aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </details>
  );
}
