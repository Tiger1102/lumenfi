import { Banknote, HandCoins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Address, WalletClient } from "viem";
import { formatUnits } from "viem";
import { getAccountData, getLendingTokenPosition, lendingAction, lendingPoolAddress, type LendingTokenPosition } from "../lib/lending";
import { ARC_TOKENS, formatTokenAmount, parseTokenAmount, type TokenSymbol } from "../lib/arc";
import { PanelNotice } from "./PanelNotice";

type LendingPanelProps = {
  address?: Address;
  walletClient?: WalletClient;
  onConnect: () => Promise<void>;
  setStatus: (message: string, state?: "success" | "error" | "loading", txHash?: string) => void;
};

type LendingAction = "deposit" | "withdraw" | "borrow" | "repay";

const SUPPLY_APY = 3.2;
const BORROW_APR = 5.8;

function formatUsd(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function readableLendingError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (/user rejected|user denied|denied request|rejected the request/i.test(message)) {
    return "Transaction cancelled in wallet.";
  }

  if (/WOULD_BE_UNHEALTHY/i.test(message)) {
    return "Withdraw amount would make the lending position unhealthy. Repay debt or use a smaller amount.";
  }

  if (/INSUFFICIENT_COLLATERAL/i.test(message)) {
    return "Withdraw amount exceeds your supplied collateral.";
  }

  if (/LTV_EXCEEDED/i.test(message)) {
    return "Borrow amount exceeds your available borrowing power.";
  }

  if (/NO_DEBT/i.test(message)) {
    return "This wallet has no debt for the selected asset.";
  }

  if (/TRANSFER_FROM_FAILED|insufficient|balance/i.test(message)) {
    return "Insufficient token balance or approval for this lending action.";
  }

  return message || "Lending transaction failed.";
}

export function LendingPanel({ address, walletClient, onConnect, setStatus }: LendingPanelProps) {
  const [token, setToken] = useState<TokenSymbol>("USDC");
  const [actionMode, setActionMode] = useState<LendingAction>("deposit");
  const [amount, setAmount] = useState("50");
  const [accountData, setAccountData] = useState<readonly [bigint, bigint, bigint, bigint] | null>(null);
  const [tokenPosition, setTokenPosition] = useState<LendingTokenPosition | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ status: "loading" | "success" | "error"; message: string; txHash?: string }>();

  async function refreshAccountData() {
    if (!address || !lendingPoolAddress) {
      return;
    }

    setLoading(true);

    try {
      const data = await getAccountData(address);
      const nextTokenPosition = await getLendingTokenPosition(address, token);
      setAccountData(data);
      setTokenPosition(nextTokenPosition);
    } catch (error) {
      const message = error instanceof Error ? `Lending read failed: ${error.message}` : "Lending read failed.";
      setNotice({ status: "error", message });
      setStatus(message, "error");
      throw error;
    } finally {
      setLoading(false);
    }
  }

  async function execute(action: LendingAction = actionMode) {
    if (!address) {
      await onConnect();
      return;
    }

    if (loading || !canExecute) {
      return;
    }

    if (!walletClient || !address) {
      setNotice({ status: "error", message: "Connect wallet before using lending." });
      setStatus("Connect wallet before using lending.", "error");
      return;
    }

    try {
      setNotice({ status: "loading", message: `${actionLabel(action)} pending...` });
      setStatus(`${actionLabel(action)} pending...`, "loading");
      const receipt = await lendingAction(walletClient, address, action, token, amount);
      const message = `${actionLabel(action)} completed.`;
      setNotice({ status: "success", message, txHash: receipt.transactionHash });
      setStatus(message, "success", receipt.transactionHash);
      await refreshAccountData();
    } catch (error) {
      const message = readableLendingError(error);
      setNotice({ status: "error", message });
      setStatus(message, "error");
    }
  }

  useEffect(() => {
    refreshAccountData().catch(() => undefined);
  }, [address, token]);

  const tokenMeta = ARC_TOKENS[token];
  const collateral = accountData ? formatUnits(accountData[0], 6) : "0";
  const debt = accountData ? formatUnits(accountData[1], 6) : "0";
  const health = accountData && accountData[1] > 0n ? `${(Number(accountData[3]) / 100).toFixed(2)}%` : "No debt";
  const healthScore = accountData && accountData[1] > 0n ? Math.max(0, Math.min(100, Number(accountData[3]) / 100)) : 100;
  const healthTone = healthScore >= 80 ? "strong" : healthScore >= 55 ? "medium" : "low";
  const collateralValue = accountData ? Number(formatUnits(accountData[0], 6)) : 0;
  const debtValue = accountData ? Number(formatUnits(accountData[1], 6)) : 0;
  const estimatedSupplyInterest = collateralValue * (SUPPLY_APY / 100);
  const estimatedBorrowCost = debtValue * (BORROW_APR / 100);
  const netInterest = estimatedSupplyInterest - estimatedBorrowCost;
  const liquidationBuffer = debtValue > 0 ? Math.max(0, collateralValue - debtValue / 0.85) : 0;
  const walletBalanceText = tokenPosition ? formatTokenAmount(tokenPosition.walletBalance, tokenMeta) : "--";
  const parsedAmount = useMemo(() => {
    try {
      return parseTokenAmount(amount, tokenMeta);
    } catch {
      return 0n;
    }
  }, [amount, tokenMeta]);

  const maxWithdraw = useMemo(() => {
    if (!accountData || !tokenPosition) {
      return 0n;
    }

    if (accountData[1] === 0n) {
      return tokenPosition.collateral;
    }

    const minimumCollateral = (accountData[1] * 10_000n + 8_499n) / 8_500n;
    const safeWithdrawValue = accountData[0] > minimumCollateral ? accountData[0] - minimumCollateral : 0n;
    return tokenPosition.collateral < safeWithdrawValue ? tokenPosition.collateral : safeWithdrawValue;
  }, [accountData, tokenPosition]);

  const maxForAction = useMemo(() => {
    if (!tokenPosition) {
      return 0n;
    }

    if (actionMode === "deposit") return tokenPosition.walletBalance;
    if (actionMode === "withdraw") return maxWithdraw;
    if (actionMode === "borrow") return accountData?.[2] ?? 0n;
    return tokenPosition.debt < tokenPosition.walletBalance ? tokenPosition.debt : tokenPosition.walletBalance;
  }, [accountData, actionMode, maxWithdraw, tokenPosition]);

  const insufficientWalletBalance = Boolean(
    tokenPosition && (actionMode === "deposit" || actionMode === "repay") && parsedAmount > tokenPosition.walletBalance
  );
  const exceedsActionMax = Boolean(tokenPosition && (actionMode === "withdraw" || actionMode === "borrow" || actionMode === "repay") && parsedAmount > maxForAction);
  const canExecute =
    Boolean(address && walletClient && lendingPoolAddress) &&
    !loading &&
    parsedAmount > 0n &&
    !insufficientWalletBalance &&
    !exceedsActionMax;
  const ctaLabel = !address
    ? "Connect Wallet"
    : loading
      ? "Loading Network Data..."
      : parsedAmount === 0n
        ? "Enter Amount"
        : insufficientWalletBalance
          ? `Insufficient ${token} Balance`
          : exceedsActionMax
            ? `Amount Exceeds ${actionLabel(actionMode)} Limit`
            : actionLabel(actionMode);

  function setMaxAmount() {
    setAmount(formatTokenAmount(maxForAction, tokenMeta));
  }

  return (
    <section className="panel tall lendingCleanPanel">
      <div className="panelHeader">
        <div>
          <p className="eyebrow">Lending market</p>
          <h2>Lend and borrow</h2>
        </div>
        <HandCoins size={20} />
      </div>
      <PanelNotice status={notice?.status} message={notice?.message} txHash={notice?.txHash} />

      {!lendingPoolAddress && <div className="notice">Deploy LendingPool and set VITE_LENDING_POOL_ADDRESS.</div>}

      <div className="lendingCleanOverview" aria-label="Account overview">
        <div className="lendingCleanStat">
          <span>COLLATERAL</span>
          <strong>{loading ? <i className="skeletonText small" /> : collateral}</strong>
        </div>
        <div className="lendingCleanStat">
          <span>DEBT</span>
          <strong>{loading ? <i className="skeletonText small" /> : debt}</strong>
        </div>
        <div className="lendingCleanHealth">
          <div>
            <span>HEALTH</span>
            <strong>{loading ? <i className="skeletonText small" /> : health}</strong>
          </div>
          <div className={`lendingCleanHealthBar ${healthTone}`} aria-hidden="true">
            <i style={{ width: `${accountData ? healthScore : 0}%` }} />
          </div>
          <small>{debtValue > 0 ? `Liquidation Buffer: $${formatUsd(liquidationBuffer)}` : "Liquidation Buffer: No debt"}</small>
        </div>
      </div>

      <div className="lendingCleanBody">
        <div className="lendingCleanControls">
          <div className="lendingCleanAssetBlock">
            <div className="lendingCleanGroup">
              <span>ASSET</span>
              <div className="lendingCleanTokenTabs" aria-label="Lending asset">
                {(["USDC", "EURC"] as const).map((symbol) => (
                  <button className={token === symbol ? "active" : ""} type="button" key={symbol} onClick={() => setToken(symbol)}>
                    <i className="tokenIcon" style={{ background: ARC_TOKENS[symbol].accent }}>
                      {symbol.slice(0, 1)}
                    </i>
                    {symbol}
                  </button>
                ))}
              </div>
            </div>
            <div className="lendingCleanRates" aria-label="Selected asset rates">
              <div>
                <span>SUPPLY APY</span>
                <strong>{SUPPLY_APY.toFixed(2)}%</strong>
              </div>
              <div>
                <span>BORROW APR</span>
                <strong>{BORROW_APR.toFixed(2)}%</strong>
              </div>
              <div>
                <span>NET YEARLY</span>
                <strong>{loading ? <i className="skeletonText tiny" /> : `${netInterest >= 0 ? "+" : "-"}$${formatUsd(Math.abs(netInterest))}`}</strong>
              </div>
            </div>
          </div>

          <div className="lendingCleanActions" aria-label="Lending action">
            {(["deposit", "withdraw", "borrow", "repay"] as const).map((action) => (
              <button className={actionMode === action ? "active" : ""} type="button" key={action} onClick={() => setActionMode(action)}>
                {actionLabel(action)}
              </button>
            ))}
          </div>

          <div className="lendingCleanAmountBlock">
            <div className="lendingCleanPositions" aria-label="Selected asset position">
              <div>
                <span>MY SUPPLIED</span>
                <strong>{loading ? <i className="skeletonText tiny" /> : formatTokenAmount(tokenPosition?.collateral ?? 0n, tokenMeta)}</strong>
              </div>
              <div>
                <span>MY DEBT</span>
                <strong>{loading ? <i className="skeletonText tiny" /> : formatTokenAmount(tokenPosition?.debt ?? 0n, tokenMeta)}</strong>
              </div>
              <div>
                <span title="Maximum available for the selected action">MAX AVAIL.</span>
                <strong>{loading ? <i className="skeletonText tiny" /> : formatTokenAmount(maxForAction, tokenMeta)}</strong>
              </div>
            </div>
            <label className="field amountField">
              <div className="lendingCleanAmountHeader">
                <span>Amount to {actionLabel(actionMode)}</span>
                <b>{loading ? <i className="skeletonText tiny" /> : `Wallet ${walletBalanceText} ${token}`}</b>
              </div>
              <div className="lendingCleanInputRow">
                <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
                <button type="button" onClick={setMaxAmount}>
                  Max
                </button>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div className="panelActionFooter">
        <button className="primaryButton" type="button" onClick={() => execute()} disabled={address ? !canExecute : false}>
          <Banknote size={16} />
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}

function actionLabel(action: LendingAction) {
  if (action === "deposit") return "Deposit";
  if (action === "withdraw") return "Withdraw";
  if (action === "borrow") return "Borrow";
  return "Repay";
}
