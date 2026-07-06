import { ArrowLeftRight, Cable, CheckCircle2, Layers3, Route } from "lucide-react";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { estimateBridge, requestBridge, requestUnifiedBalances } from "../lib/circle";
import { arcPublicClient, ARC_TOKENS, erc20Abi, formatTokenAmount, getTokenAddress, type EIP1193Provider } from "../lib/arc";
import { PanelNotice } from "./PanelNotice";

type BridgePanelProps = {
  address?: Address;
  provider?: EIP1193Provider;
  setStatus: (message: string, state?: "success" | "error" | "loading", txHash?: string) => void;
};

type BridgeChain = "Arc_Testnet" | "Base_Sepolia" | "Ethereum_Sepolia" | "Arbitrum_Sepolia";

const BRIDGE_CHAINS: Array<{ value: BridgeChain; label: string }> = [
  { value: "Arc_Testnet", label: "Arc Testnet" },
  { value: "Base_Sepolia", label: "Base Sepolia" },
  { value: "Ethereum_Sepolia", label: "Ethereum Sepolia" },
  { value: "Arbitrum_Sepolia", label: "Arbitrum Sepolia" }
];

function chainLabel(value: BridgeChain) {
  return BRIDGE_CHAINS.find((chain) => chain.value === value)?.label ?? value.replace("_", " ");
}

export function BridgePanel({ address, provider, setStatus }: BridgePanelProps) {
  const [sourceChain, setSourceChain] = useState<BridgeChain>("Base_Sepolia");
  const [destinationChain, setDestinationChain] = useState<BridgeChain>("Arc_Testnet");
  const [amount, setAmount] = useState("25");
  const [recipient, setRecipient] = useState("");
  const [unifiedBalance, setUnifiedBalance] = useState<string>("--");
  const [arcUsdcBalance, setArcUsdcBalance] = useState("0 USDC");
  const [routeEstimate, setRouteEstimate] = useState("Ready to preview");
  const [notice, setNotice] = useState<{ status: "loading" | "success" | "error"; message: string; txHash?: string }>();
  const routeDisabled = sourceChain === destinationChain;

  async function loadArcUsdcBalance() {
    if (!address) {
      setArcUsdcBalance("0 USDC");
      return;
    }

    const balance = await arcPublicClient.readContract({
      address: getTokenAddress("USDC"),
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address]
    });
    setArcUsdcBalance(`${formatTokenAmount(balance, ARC_TOKENS.USDC)} USDC`);
  }

  useEffect(() => {
    loadArcUsdcBalance().catch(() => setArcUsdcBalance("0 USDC"));
  }, [address]);

  async function previewRoute() {
    if (!provider || !address) {
      setNotice({ status: "error", message: "Connect wallet before previewing a bridge route." });
      setStatus("Connect wallet before previewing bridge route.", "error");
      return;
    }

    if (routeDisabled) {
      setNotice({ status: "error", message: "Choose two different chains." });
      setStatus("Choose two different bridge chains.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: "Checking Circle bridge route..." });
      setStatus("Checking Circle bridge route...", "loading");
      const result = await estimateBridge({ provider, sourceChain, destinationChain, amount, recipientAddress: recipient || address });
      setRouteEstimate(readableRouteEstimate(result));
      setNotice({ status: "success", message: "Bridge route is available." });
      setStatus("Bridge route is available.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge estimate is not available for this route.";
      setRouteEstimate("Route estimate unavailable");
      setNotice({ status: "error", message });
      setStatus(message, "error");
    }
  }

  async function bridge() {
    if (!provider || !address) {
      setNotice({ status: "error", message: "Connect wallet before bridging." });
      setStatus("Connect wallet before bridging.", "error");
      return;
    }

    if (routeDisabled) {
      setNotice({ status: "error", message: "Choose two different chains." });
      setStatus("Choose two different bridge chains.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: "Bridge request pending in wallet..." });
      setStatus("Checking USDC bridge route...", "loading");
      const result = await requestBridge({ provider, sourceChain, destinationChain, amount, recipientAddress: recipient || address });
      const txHash = extractTransactionHash(result);
      setNotice({ status: "success", message: txHash ? "Bridge transaction submitted." : "Bridge request submitted.", txHash });
      setStatus(txHash ? "Bridge transaction submitted." : "Bridge request submitted.", "success", txHash);
      await loadArcUsdcBalance();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bridge routing is not available in this deployment.";
      setNotice({ status: "error", message });
      setStatus(message, "error");
    }
  }

  async function loadUnifiedBalance() {
    if (!provider || !address) {
      setNotice({ status: "error", message: "Connect wallet before reading unified balance." });
      setStatus("Connect wallet before reading unified balance.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: "Loading unified USDC balance..." });
      setStatus("Loading unified USDC balance...", "loading");
      const result = await requestUnifiedBalances(provider, address);
      setUnifiedBalance(formatUnifiedUsdcBalance(result));
      setNotice({ status: "success", message: "Unified balance loaded." });
      setStatus("Unified balance loaded.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unified balance is not available in this deployment.";
      setNotice({ status: "error", message });
      setStatus(message, "error");
    }
  }

  function reverseChains() {
    setSourceChain(destinationChain);
    setDestinationChain(sourceChain);
  }

  return (
    <section className="panel tall bridgePanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Cross-chain USDC</p>
          <h2>Bridge USDC</h2>
        </div>
        <Cable size={20} />
      </div>
      <PanelNotice status={notice?.status} message={notice?.message} txHash={notice?.txHash} />

      <div className="bridgeNetworkGrid" aria-label="Bridge networks">
        <label className="field">
          <span>From chain</span>
          <select value={sourceChain} onChange={(event) => setSourceChain(event.target.value as BridgeChain)}>
            {BRIDGE_CHAINS.map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}
          </select>
        </label>

        <button className="bridgeReverseButton" type="button" onClick={reverseChains} aria-label="Reverse bridge direction">
          <ArrowLeftRight size={18} />
        </button>

        <label className="field">
          <span>To chain</span>
          <select value={destinationChain} onChange={(event) => setDestinationChain(event.target.value as BridgeChain)}>
            {BRIDGE_CHAINS.map((chain) => <option value={chain.value} key={chain.value}>{chain.label}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="tokenLabel"><i style={{ background: ARC_TOKENS.USDC.accent }}>U</i> USDC amount</span>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
      </label>

      <label className="field">
        <span>Recipient</span>
        <input value={recipient || address || ""} onChange={(event) => setRecipient(event.target.value)} placeholder="Destination wallet address" />
      </label>

      <div className="routeSummary bridgeRouteSummary" aria-label="Bridge route">
        <div><span>Source network</span><strong>{chainLabel(sourceChain)}</strong></div>
        <i />
        <div><span>Destination network</span><strong>{chainLabel(destinationChain)}</strong></div>
      </div>

      <div className="bridgeRouteGrid" aria-label="Bridge route details">
        <div><Route size={16} /><span>Route status</span><strong>{routeDisabled ? "Select another chain" : routeEstimate}</strong></div>
        <div><CheckCircle2 size={16} /><span>Asset</span><strong className="inlineToken"><i style={{ background: ARC_TOKENS.USDC.accent }}>U</i> USDC</strong></div>
        <div><Layers3 size={16} /><span>Network type</span><strong>Testnet</strong></div>
      </div>

      <div className="buttonRow bridgeButtonRow">
        <button className="secondaryButton" type="button" onClick={previewRoute} disabled={routeDisabled}>
          Preview route
        </button>
        <button className="primaryButton" type="button" onClick={bridge} disabled={routeDisabled}>
          Bridge USDC
        </button>
      </div>

      <button className="secondaryButton fullWidthButton" type="button" onClick={loadUnifiedBalance}>
        <Layers3 size={16} />
        Unified balance
      </button>

      <div className="resultBox compactBalance" aria-label="Unified USDC balance">
        <span>{unifiedBalance === "--" ? "Arc USDC balance" : "Unified USDC balance"}</span>
        <strong className="inlineToken"><i style={{ background: ARC_TOKENS.USDC.accent }}>U</i> {unifiedBalance === "--" ? arcUsdcBalance : unifiedBalance}</strong>
      </div>
    </section>
  );
}

function readableRouteEstimate(result: unknown) {
  if (!result || typeof result !== "object") {
    return "Route available";
  }

  const record = result as Record<string, unknown>;
  const fee = record.fee ?? record.totalFee ?? record.bridgeFee;
  const eta = record.estimatedTime ?? record.eta ?? record.duration;

  if (fee || eta) {
    return [fee ? `Fee ${String(fee)}` : "", eta ? `ETA ${String(eta)}` : ""].filter(Boolean).join(" - ");
  }

  return "Route available";
}

function extractTransactionHash(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ["transactionHash", "txHash", "hash"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && /^0x[a-fA-F0-9]{64}$/.test(candidate)) {
      return candidate;
    }
  }

  for (const candidate of Object.values(record)) {
    const nestedHash = extractTransactionHash(candidate);
    if (nestedHash) {
      return nestedHash;
    }
  }

  return undefined;
}

function formatUnifiedUsdcBalance(result: unknown) {
  if (!result || typeof result !== "object") {
    return "0 USDC";
  }

  const record = result as Record<string, unknown>;
  const value = record.totalConfirmedBalance ?? record.totalBalance ?? record.balance ?? "0";
  const numericValue = typeof value === "number" ? value.toString() : typeof value === "string" ? value : "0";
  const cleanedValue = numericValue.replace(/\.?0+$/, "");

  return `${cleanedValue || "0"} USDC`;
}
