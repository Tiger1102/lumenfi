import { ArrowDownUp, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Address, WalletClient } from "viem";
import { isCircleAppKitEnabled, requestSwap } from "../lib/circle";
import { ARC_GAS_RESERVE_USDC, ARC_TOKENS, formatTokenAmount, parseTokenAmount, type EIP1193Provider, type TokenSymbol } from "../lib/arc";
import type { AgentActionDraft } from "../lib/agent";
import { assertAgentDraftPolicy } from "../lib/agentPolicy";
import { approveSwap, getPoolSwapPreview, getSwapAllowance, poolSwap, supportsPoolSwap, swapPoolAddress } from "../lib/swapPool";
import { AgentDraftNotice } from "./AgentDraftNotice";
import { PanelNotice } from "./PanelNotice";
import { TokenSelect } from "./TokenSelect";

type SwapPanelProps = {
  address?: Address;
  provider?: EIP1193Provider;
  walletClient?: WalletClient;
  balances?: Partial<Record<TokenSymbol, bigint>>;
  balancesLoading?: boolean;
  agentDraft?: AgentActionDraft;
  onDismissAgentDraft?: () => void;
  onConnect: () => Promise<void>;
  setStatus: (message: string, state?: "success" | "error" | "loading", txHash?: string) => void;
};

const PUBLIC_SWAP_TOKENS: TokenSymbol[] = ["USDC", "EURC", "cirBTC"];

function readableSwapError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/user rejected|user denied|denied request|rejected the request/i.test(message)) {
    return "Swap cancelled in wallet.";
  }

  if (/insufficient/i.test(message)) {
    return message;
  }

  if (/POOL_LIQUIDITY_LOW|no output|Transaction failed|reverted/i.test(message)) {
    return "Swap could not execute with current pool liquidity. Try a smaller amount or add liquidity first.";
  }

  return message || "Pool swap failed.";
}

export function SwapPanel({
  address,
  provider,
  walletClient,
  balances = {},
  balancesLoading = false,
  agentDraft,
  onDismissAgentDraft,
  onConnect,
  setStatus
}: SwapPanelProps) {
  const [from, setFrom] = useState<TokenSymbol>("USDC");
  const [to, setTo] = useState<TokenSymbol>("EURC");
  const [amount, setAmount] = useState("10");
  const [preview, setPreview] = useState("");
  const [allowance, setAllowance] = useState(0n);
  const [allowanceLoading, setAllowanceLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [notice, setNotice] = useState<{ status: "loading" | "success" | "error"; message: string; txHash?: string }>();

  useEffect(() => {
    if (!agentDraft || agentDraft.destination !== "swap" || agentDraft.action !== "swap") return;
    setFrom(agentDraft.asset);
    setTo(agentDraft.secondaryAsset ?? (agentDraft.asset === "USDC" ? "EURC" : "USDC"));
    setAmount(agentDraft.amount);
    setNotice(undefined);
  }, [agentDraft?.id]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    setPreviewError("");

    if (!supportsPoolSwap(from, to) || !swapPoolAddress) {
      setPreview("");
      setPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setPreviewLoading(true);
    timer = window.setTimeout(() => {
      getPoolSwapPreview(undefined, from, to, amount)
        .then((nextPreview) => {
          if (!cancelled) {
            setPreview(nextPreview ? nextPreview.outputText : "");
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPreview("");
            setPreviewError(error instanceof Error ? error.message : "Swap quote failed.");
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPreviewLoading(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [from, to, amount]);

  useEffect(() => {
    let cancelled = false;
    if (!address || !supportsPoolSwap(from, to)) { setAllowance(0n); return; }
    setAllowanceLoading(true);
    getSwapAllowance(address, from).then((value) => { if (!cancelled) setAllowance(value); }).catch((error) => setStatus(error instanceof Error ? error.message : "Allowance read failed.", "error")).finally(() => { if (!cancelled) setAllowanceLoading(false); });
    return () => { cancelled = true; };
  }, [address, from, to]);

  const slippageValue = Math.max(0, Math.min(50, Number(slippage) || 0));
  const previewValue = Number(preview);
  const minimumReceived = Number.isFinite(previewValue) && preview ? (previewValue * (1 - slippageValue / 100)).toFixed(4) : "";
  const fromBalance = formatTokenAmount(balances[from] ?? 0n, ARC_TOKENS[from]);
  const usdcBalance = balances.USDC ?? 0n;
  const spendableFromBalance = from === "USDC"
    ? usdcBalance > ARC_GAS_RESERVE_USDC ? usdcBalance - ARC_GAS_RESERVE_USDC : 0n
    : balances[from] ?? 0n;
  const parsedAmount = useMemo(() => {
    try {
      return parseTokenAmount(amount, ARC_TOKENS[from]);
    } catch {
      return 0n;
    }
  }, [amount, from]);
  const hasInsufficientBalance = Boolean(address && parsedAmount > spendableFromBalance);
  const hasInsufficientGasReserve = Boolean(address && !balancesLoading && usdcBalance < ARC_GAS_RESERVE_USDC);
  const conflictsWithGasReserve = Boolean(address && from === "USDC" && parsedAmount <= usdcBalance && parsedAmount > spendableFromBalance);
  const needsApproval = Boolean(address && supportsPoolSwap(from, to) && parsedAmount > allowance);
  const isLoadingNetworkData = balancesLoading || previewLoading || allowanceLoading;
  const isValidSwap = Boolean(address && walletClient && provider && from !== to && parsedAmount > 0n && !hasInsufficientBalance && !hasInsufficientGasReserve && !isLoadingNetworkData);
  const ctaLabel = !address
    ? "Connect Wallet"
    : isLoadingNetworkData
      ? "Loading Network Data..."
      : from === to
        ? "Select Different Tokens"
        : parsedAmount === 0n
          ? "Enter Amount"
          : hasInsufficientGasReserve
            ? "Keep 0.02 USDC For Gas"
          : conflictsWithGasReserve
            ? "Leave 0.02 USDC For Gas"
          : hasInsufficientBalance
            ? `Insufficient ${from} Balance`
            : needsApproval ? `Approve ${from}` : "Swap";

  function reverseTokens() {
    setFrom(to);
    setTo(from);
    onDismissAgentDraft?.();
  }

  function setMaxAmount() {
    setAmount(formatTokenAmount(spendableFromBalance, ARC_TOKENS[from]));
    onDismissAgentDraft?.();
  }

  async function execute() {
    if (!address) {
      await onConnect();
      return;
    }

    if (!isValidSwap) {
      return;
    }

    if (!provider || !walletClient || !address) {
      setNotice({ status: "error", message: "Connect wallet before swapping." });
      setStatus("Connect wallet before swapping.", "error");
      return;
    }

    try {
      await assertAgentDraftPolicy(address, agentDraft, { action: "swap", asset: from, secondaryAsset: to, amount });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Signed policy validation failed.";
      setNotice({ status: "error", message });
      setStatus(message, "error");
      return;
    }

    if (needsApproval) {
      try {
        setStatus(`Approving ${from}...`, "loading");
        await approveSwap(walletClient, address, from, amount);
        setAllowance(parsedAmount);
        setStatus(`${from} approved.`, "success");
      } catch (error) {
        setStatus(readableSwapError(error), "error");
      }
      return;
    }

    if (from === to) {
      setNotice({ status: "error", message: "Choose two different tokens." });
      setStatus("Choose two different tokens.", "error");
      return;
    }

    if (supportsPoolSwap(from, to) && swapPoolAddress) {
      try {
        setNotice({ status: "loading", message: "Waiting for wallet approval..." });
        setStatus("Swap transaction pending.", "loading");
        const receipt = await poolSwap(walletClient, address, from, to, amount, Math.round(slippageValue * 100));
        setNotice({ status: "success", message: "Confirmed.", txHash: receipt.transactionHash });
        setStatus("Swap confirmed.", "success", receipt.transactionHash);
        return;
      } catch (poolError) {
        const message = readableSwapError(poolError);
        setNotice({ status: "error", message });
        setStatus(message, "error");
        return;
      }
    }

    if (!isCircleAppKitEnabled()) {
      setNotice({ status: "error", message: "cirBTC route requires Circle App Kit routing." });
      setStatus("USDC/EURC uses the LumenFi pool. cirBTC routes require Circle App Kit routing to be available.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: "Circle App Kit route pending..." });
      setStatus("Requesting Circle App Kit swap...", "loading");
      await requestSwap({ provider, from, to, amount });
      setNotice({ status: "success", message: "Swap request submitted." });
      setStatus("Swap submitted.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Swap failed.";
      setNotice({ status: "error", message });
      setStatus(`${message}. Try USDC <-> EURC through the LumenFi pool.`, "error");
    }
  }

  return (
    <section className="panel swapPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">LumenFi pool</p>
          <h2>Swap</h2>
        </div>
      </div>
      <AgentDraftNotice draft={agentDraft?.destination === "swap" ? agentDraft : undefined} onDismiss={onDismissAgentDraft} />
      <PanelNotice status={notice?.status} message={notice?.message} txHash={notice?.txHash} />

      {needsApproval && (
        <aside className="approvalGuidance">
          <ShieldAlert size={17} />
          <div>
            <strong>Step 1 of 2 · exact token approval</strong>
            <p>Some wallets label Arc USDC approval as a withdrawal permission. Verify spender {swapPoolAddress.slice(0, 8)}...{swapPoolAddress.slice(-6)} and amount {amount} {from}; no swap occurs in this step.</p>
          </div>
        </aside>
      )}

      <div className="swapPanelBody">
        <div className="tokenAmountBox">
          <div className="tokenAmountTop">
            <span>Pay</span>
            <b>{balancesLoading ? <i className="skeletonText small" /> : `Wallet ${fromBalance} ${from}`}</b>
          </div>
          <div className="tokenAmountMain">
            <TokenSelect value={from} onChange={(value) => { setFrom(value); onDismissAgentDraft?.(); }} tokens={PUBLIC_SWAP_TOKENS} />
            <input value={amount} onChange={(event) => { setAmount(event.target.value); onDismissAgentDraft?.(); }} inputMode="decimal" aria-label="Swap amount" />
            <button type="button" onClick={setMaxAmount}>MAX</button>
          </div>
          {from === "USDC" && <small className="gasReserveNote">Max leaves 0.02 USDC for approval and swap network fees.</small>}
        </div>

        <button className="swapReverseButton" type="button" onClick={reverseTokens} aria-label="Reverse swap direction">
          <ArrowDownUp size={18} />
        </button>

        <div className="tokenAmountBox receive">
          <div className="tokenAmountTop">
            <span>Receive</span>
            <b>{supportsPoolSwap(from, to) ? "Pool quote" : "Circle App Kit"}</b>
          </div>
          <div className="tokenAmountMain">
            <TokenSelect value={to} onChange={(value) => { setTo(value); onDismissAgentDraft?.(); }} tokens={PUBLIC_SWAP_TOKENS} />
            <strong>{previewLoading ? <i className="skeletonText" /> : preview ? `${preview} ${to}` : "--"}</strong>
            <button type="button" disabled>OUT</button>
          </div>
        </div>
        {previewError && <div className="notice" role="alert">Pool quote is temporarily unavailable. Try again in a moment.</div>}

        <div className="slippagePanel" aria-label="Swap quote controls">
          <div className="slippageHeader">
            <span>SLIPPAGE</span>
            <strong>{slippageValue.toFixed(slippageValue % 1 === 0 ? 0 : 1)}%</strong>
          </div>
          <div className="slippageOptions">
            {["0.5", "1"].map((value) => (
              <button className={slippage === value ? "active" : ""} type="button" key={value} onClick={() => setSlippage(value)}>
                {value}%
              </button>
            ))}
            <label className="slippageCustom">
              <input aria-label="Custom slippage" value={slippage} onChange={(event) => setSlippage(event.target.value)} inputMode="decimal" placeholder="Custom" />
              <span>%</span>
            </label>
          </div>
          <div className="minimumReceived">
            <span>MINIMUM RECEIVED</span>
            <strong>{previewLoading ? <i className="skeletonText small" /> : minimumReceived ? `${minimumReceived} ${to}` : "--"}</strong>
          </div>
          {slippageValue > 1 && <p className="slippageWarning">Higher slippage may accept a worse execution price.</p>}
        </div>

        <div className="routeMeta" aria-label="Swap route details">
          <div>
            <span>ROUTE</span>
            <strong>{supportsPoolSwap(from, to) ? "USDC/EURC pool" : "Circle App Kit"}</strong>
          </div>
          <div>
            <span>SETTLEMENT</span>
            <strong>On-chain</strong>
          </div>
        </div>
      </div>

      <div className="panelActionFooter">
        <button className="primaryButton" type="button" onClick={execute} disabled={address ? !isValidSwap : false}>
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
