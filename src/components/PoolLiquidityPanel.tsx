import { RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Address, WalletClient } from "viem";
import { ARC_TOKENS, arcPublicClient, erc20Abi, formatTokenAmount, getTokenAddress, parseTokenAmount, readWithRetry } from "../lib/arc";
import { formatLpAmount, managePoolLiquidity, poolPosition, quoteRemoveLiquidity, removePoolLiquidity, swapPoolAddress } from "../lib/swapPool";
import { PanelNotice } from "./PanelNotice";

type PoolPosition = {
  usdcReserve: bigint;
  eurcReserve: bigint;
  totalSupply: bigint;
  lpBalance: bigint;
};

type PoolLiquidityPanelProps = {
  address?: Address;
  walletClient?: WalletClient;
  onConnect: () => Promise<void>;
  setStatus: (message: string, state?: "success" | "error" | "loading", txHash?: string) => void;
};

function readableLiquidityError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/user rejected|user denied|denied request|rejected the request/i.test(message)) {
    return "Transaction cancelled in wallet. To add liquidity, open MetaMask and click Confirm.";
  }

  if (/insufficient|balance/i.test(message)) {
    return "Insufficient token balance or gas balance for this liquidity transaction.";
  }

  return message || "Liquidity transaction failed.";
}

export function PoolLiquidityPanel({ address, walletClient, onConnect, setStatus }: PoolLiquidityPanelProps) {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [usdcAmount, setUsdcAmount] = useState("25");
  const [eurcAmount, setEurcAmount] = useState("25");
  const [removePercent, setRemovePercent] = useState("25");
  const [position, setPosition] = useState<PoolPosition | null>(null);
  const [walletBalances, setWalletBalances] = useState({ USDC: 0n, EURC: 0n });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ status: "loading" | "success" | "error"; message: string; txHash?: string }>();

  async function refresh() {
    if (!swapPoolAddress) {
      return;
    }

    setLoading(true);

    try {
      const nextPosition = await poolPosition(address);
      const usdcBalance = address
        ? await readWithRetry(
            () => arcPublicClient.readContract({ address: getTokenAddress("USDC"), abi: erc20Abi, functionName: "balanceOf", args: [address] }),
            "USDC wallet balance"
          )
        : 0n;
      const eurcBalance = address
        ? await readWithRetry(
            () => arcPublicClient.readContract({ address: getTokenAddress("EURC"), abi: erc20Abi, functionName: "balanceOf", args: [address] }),
            "EURC wallet balance"
          )
        : 0n;
      setPosition(nextPosition);
      setWalletBalances({ USDC: usdcBalance, EURC: eurcBalance });
    } catch (error) {
      const message = error instanceof Error ? `Pool read failed: ${error.message}` : "Pool read failed.";
      setNotice({ status: "error", message });
      setStatus(message, "error");
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function execute() {
    if (!address) {
      await onConnect();
      return;
    }

    if (loading || !canExecute) {
      return;
    }

    if (!walletClient || !address) {
      setNotice({ status: "error", message: "Connect wallet before managing liquidity." });
      setStatus("Connect wallet before managing liquidity.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: `${mode === "add" ? "Add" : "Remove"} liquidity pending...` });
      setStatus(`${mode === "add" ? "Adding" : "Removing"} liquidity...`, "loading");
      let receipt;
      if (mode === "add") {
        receipt = await managePoolLiquidity(walletClient, address, mode, usdcAmount, eurcAmount);
      } else {
        receipt = await removePoolLiquidity(walletClient, address, sharesToRemove);
      }
      const message = `Liquidity ${mode === "add" ? "added" : "removed"}. LP position updated.`;
      setNotice({ status: "success", message, txHash: receipt.transactionHash });
      setStatus(message, "success", receipt.transactionHash);
      await refresh();
    } catch (error) {
      const message = readableLiquidityError(error);
      setNotice({ status: "error", message });
      setStatus(message, "error");
    }
  }

  useEffect(() => {
    let cancelled = false;
    refresh().catch(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const poolShare = useMemo(() => {
    if (!position || position.totalSupply === 0n || position.lpBalance === 0n) {
      return "0.00%";
    }

    const basisPoints = (position.lpBalance * 1_000_000n) / position.totalSupply;
    return `${(Number(basisPoints) / 10_000).toFixed(2)}%`;
  }, [position]);

  const userUsdc = position && position.totalSupply > 0n ? (position.lpBalance * position.usdcReserve) / position.totalSupply : 0n;
  const userEurc = position && position.totalSupply > 0n ? (position.lpBalance * position.eurcReserve) / position.totalSupply : 0n;
  const poolValue = Number(formatTokenAmount(userUsdc, ARC_TOKENS.USDC)) + Number(formatTokenAmount(userEurc, ARC_TOKENS.EURC));
  const parsedRemovePercent = Math.max(0, Math.min(100, Number(removePercent) || 0));
  const sharesToRemove =
    position?.lpBalance && parsedRemovePercent >= 100
      ? position.lpBalance
      : position?.lpBalance
        ? (position.lpBalance * BigInt(Math.round(parsedRemovePercent * 100))) / 10_000n
        : 0n;
  const removePreview = position ? quoteRemoveLiquidity(position, sharesToRemove) : { usdcAmount: 0n, eurcAmount: 0n };
  const hasLpPosition = Boolean(position && position.lpBalance > 0n);
  const parsedUsdcAmount = useMemo(() => {
    try {
      return parseTokenAmount(usdcAmount, ARC_TOKENS.USDC);
    } catch {
      return 0n;
    }
  }, [usdcAmount]);
  const parsedEurcAmount = useMemo(() => {
    try {
      return parseTokenAmount(eurcAmount, ARC_TOKENS.EURC);
    } catch {
      return 0n;
    }
  }, [eurcAmount]);
  const addAmountsInvalid = parsedUsdcAmount === 0n || parsedEurcAmount === 0n;
  const insufficientUsdc = parsedUsdcAmount > walletBalances.USDC;
  const insufficientEurc = parsedEurcAmount > walletBalances.EURC;
  const canExecute =
    Boolean(address && walletClient && swapPoolAddress) &&
    !loading &&
    (mode === "add" ? !addAmountsInvalid && !insufficientUsdc && !insufficientEurc : hasLpPosition && sharesToRemove > 0n);
  const buttonLabel = !address
    ? "Connect Wallet"
    : loading
      ? "Loading Network Data..."
      : mode === "add" && insufficientUsdc
        ? "Insufficient USDC Balance"
        : mode === "add" && insufficientEurc
          ? "Insufficient EURC Balance"
          : mode === "add" && addAmountsInvalid
            ? "Enter Pool Amounts"
            : mode === "remove" && !hasLpPosition
              ? "No LP Shares"
              : mode === "remove" && sharesToRemove === 0n
                ? "Select LP Amount"
                : mode === "add" ? "Add Liquidity" : "Remove Liquidity";
  const poolRate =
    position && position.usdcReserve > 0n
      ? Number(formatTokenAmount(position.eurcReserve, ARC_TOKENS.EURC)) / Number(formatTokenAmount(position.usdcReserve, ARC_TOKENS.USDC))
      : 0;

  return (
    <section className="panel poolProPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Permissionless liquidity</p>
          <h2>USDC / EURC pool</h2>
        </div>
        <button className="iconButton" type="button" onClick={refresh} title="Refresh pool" disabled={loading}>
          <RefreshCcw size={18} />
        </button>
      </div>
      <PanelNotice status={notice?.status} message={notice?.message} txHash={notice?.txHash} />

      {!swapPoolAddress && <div className="notice">Set VITE_SWAP_POOL_ADDRESS to enable liquidity controls.</div>}

      <div className="poolModeTabs" aria-label="Liquidity action">
        <button className={mode === "add" ? "active" : ""} type="button" onClick={() => setMode("add")}>
          Add Liquidity
        </button>
        <button className={mode === "remove" ? "active" : ""} type="button" onClick={() => setMode("remove")}>
          Remove Liquidity
        </button>
      </div>

      <div className="poolProStats">
        <div className="poolProCard primary">
          <span>My pool assets</span>
          <strong>{loading ? <i className="skeletonText" /> : `$${poolValue.toLocaleString("en-US", { maximumFractionDigits: 4 })}`}</strong>
          <em>{loading ? <i className="skeletonText tiny" /> : `${poolShare} of active pool`}</em>
        </div>

        <div className="poolProCard">
          <span>USDC reserve</span>
          <strong>{loading ? <i className="skeletonText" /> : formatTokenAmount(position?.usdcReserve ?? 0n, ARC_TOKENS.USDC)}</strong>
        </div>

        <div className="poolProCard">
          <span>EURC reserve</span>
          <strong>{loading ? <i className="skeletonText" /> : formatTokenAmount(position?.eurcReserve ?? 0n, ARC_TOKENS.EURC)}</strong>
        </div>
      </div>

      <div className="poolProStats compact" aria-label="My pool position">
        <div className="poolProCard">
          <span>My USDC</span>
          <strong>{loading ? <i className="skeletonText small" /> : formatTokenAmount(userUsdc, ARC_TOKENS.USDC)}</strong>
        </div>
        <div className="poolProCard">
          <span>My EURC</span>
          <strong>{loading ? <i className="skeletonText small" /> : formatTokenAmount(userEurc, ARC_TOKENS.EURC)}</strong>
        </div>
        <div className="poolProCard">
          <span>My LP shares</span>
          <strong>{loading ? <i className="skeletonText small" /> : formatLpAmount(position?.lpBalance ?? 0n)}</strong>
        </div>
      </div>

      <div className="poolProControls">
        {mode === "add" ? (
          <div className="poolInputGrid poolSpanAll">
            <label className="poolAssetInput">
              <span>
                <i style={{ background: ARC_TOKENS.USDC.accent }}>U</i>
                USDC amount
              </span>
              <div>
                <input value={usdcAmount} onChange={(event) => setUsdcAmount(event.target.value)} inputMode="decimal" />
                <button type="button" onClick={() => setUsdcAmount(formatTokenAmount(walletBalances.USDC, ARC_TOKENS.USDC))}>
                  MAX
                </button>
              </div>
              <small>Wallet {formatTokenAmount(walletBalances.USDC, ARC_TOKENS.USDC)} USDC</small>
            </label>
            <label className="poolAssetInput">
              <span>
                <i style={{ background: ARC_TOKENS.EURC.accent }}>E</i>
                EURC amount
              </span>
              <div>
                <input value={eurcAmount} onChange={(event) => setEurcAmount(event.target.value)} inputMode="decimal" />
                <button type="button" onClick={() => setEurcAmount(formatTokenAmount(walletBalances.EURC, ARC_TOKENS.EURC))}>
                  MAX
                </button>
              </div>
              <small>Wallet {formatTokenAmount(walletBalances.EURC, ARC_TOKENS.EURC)} EURC</small>
            </label>
          </div>
        ) : (
          <div className="poolRemoveBox poolSpanAll">
            <div className="removeQuick poolSpanTwo" aria-label="Remove liquidity amount">
              {[25, 50, 75, 100].map((percent) => (
                <button
                  className={parsedRemovePercent === percent ? "active" : ""}
                  type="button"
                  key={percent}
                  onClick={() => setRemovePercent(String(percent))}
                >
                  {percent}%
                </button>
              ))}
            </div>
            <label className="poolAssetInput">
              <span>Remove percent</span>
              <div>
                <input value={removePercent} onChange={(event) => setRemovePercent(event.target.value)} inputMode="decimal" />
                <button type="button" onClick={() => setRemovePercent("100")}>
                  MAX
                </button>
              </div>
              <small>Available {loading ? "loading" : formatLpAmount(position?.lpBalance ?? 0n)} LP shares</small>
            </label>
          </div>
        )}

        {mode === "remove" && (
          <div className="removePreview poolSpanAll" aria-label="Remove liquidity preview">
            <div>
              <span>You receive</span>
              <strong>
                {formatTokenAmount(removePreview.usdcAmount, ARC_TOKENS.USDC)} USDC + {formatTokenAmount(removePreview.eurcAmount, ARC_TOKENS.EURC)} EURC
              </strong>
            </div>
            <div>
              <span>LP shares used</span>
              <strong>{formatLpAmount(sharesToRemove)}</strong>
            </div>
          </div>
        )}

        <div className="poolRateBox poolSpanAll">
          <span>Pool rate</span>
          <strong>{loading ? <i className="skeletonText small" /> : `1 USDC = ${poolRate ? poolRate.toFixed(4) : "0"} EURC`}</strong>
        </div>

        <button className="primaryButton" type="button" onClick={execute} disabled={address ? !canExecute : false}>
          {buttonLabel}
        </button>
      </div>

      <p className="hint">LP shares track your pool ownership. Fees accrue inside reserves.</p>
    </section>
  );
}
