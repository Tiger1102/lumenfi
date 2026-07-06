import { ArrowDownUp } from "lucide-react";
import { useEffect, useState } from "react";
import type { Address, WalletClient } from "viem";
import { isCircleAppKitEnabled, requestSwap } from "../lib/circle";
import { ARC_TOKENS, formatTokenAmount, type EIP1193Provider, type TokenSymbol } from "../lib/arc";
import { getPoolSwapPreview, poolSwap, supportsPoolSwap, swapPoolAddress } from "../lib/swapPool";
import { PanelNotice } from "./PanelNotice";
import { TokenSelect } from "./TokenSelect";

type SwapPanelProps = {
  address?: Address;
  provider?: EIP1193Provider;
  walletClient?: WalletClient;
  balances?: Partial<Record<TokenSymbol, bigint>>;
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

export function SwapPanel({ address, provider, walletClient, balances = {}, setStatus }: SwapPanelProps) {
  const [from, setFrom] = useState<TokenSymbol>("USDC");
  const [to, setTo] = useState<TokenSymbol>("EURC");
  const [amount, setAmount] = useState("10");
  const [preview, setPreview] = useState("--");
  const [slippage, setSlippage] = useState("0.5");
  const [notice, setNotice] = useState<{ status: "loading" | "success" | "error"; message: string; txHash?: string }>();

  useEffect(() => {
    let cancelled = false;
    getPoolSwapPreview(address, from, to, amount)
      .then((nextPreview) => {
        if (!cancelled) {
          setPreview(nextPreview ? nextPreview.outputText : "--");
        }
      })
      .catch(() => {
        if (!cancelled) setPreview("--");
      });

    return () => {
      cancelled = true;
    };
  }, [address, from, to, amount]);

  const slippageValue = Math.max(0, Math.min(50, Number(slippage) || 0));
  const previewValue = Number(preview);
  const minimumReceived = Number.isFinite(previewValue) && preview !== "--" ? (previewValue * (1 - slippageValue / 100)).toFixed(4) : "--";
  const fromBalance = formatTokenAmount(balances[from] ?? 0n, ARC_TOKENS[from]);

  function reverseTokens() {
    setFrom(to);
    setTo(from);
  }

  async function execute() {
    if (!provider || !walletClient || !address) {
      setNotice({ status: "error", message: "Connect wallet before swapping." });
      setStatus("Connect wallet before swapping.", "error");
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
        const receipt = await poolSwap(walletClient, address, from, to, amount);
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
      <PanelNotice status={notice?.status} message={notice?.message} txHash={notice?.txHash} />

      <div className="swapPanelBody">
        <label className="field">
          <span>FROM</span>
          <TokenSelect value={from} onChange={setFrom} tokens={PUBLIC_SWAP_TOKENS} />
        </label>

        <label className="field">
          <div className="swapAmountHeader">
            <span>AMOUNT</span>
            <b>Wallet {fromBalance} {from}</b>
          </div>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
        </label>

        <button className="swapReverseButton" type="button" onClick={reverseTokens} aria-label="Reverse swap direction">
          <ArrowDownUp size={18} />
        </button>

        <label className="field">
          <span>TO</span>
          <TokenSelect value={to} onChange={setTo} tokens={PUBLIC_SWAP_TOKENS} />
        </label>

        <div className="swapPreview">
          <span>YOU RECEIVE</span>
          <strong>{preview} {to}</strong>
        </div>

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
            <strong>{minimumReceived} {to}</strong>
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
        <p className="hint">USDC/EURC routes through the LumenFi pool. cirBTC uses Circle App Kit routing when available.</p>
      </div>

      <div className="panelActionFooter">
        <button className="primaryButton" type="button" onClick={execute}>
          Swap on Arc
        </button>
      </div>
    </section>
  );
}
