import { formatUnits, type Address } from "viem";
import { arcPublicClient, ARC_TOKENS, type TokenSymbol } from "./arc";
import { getLendingAssetPrice, getLendingSnapshot } from "./lending";
import { poolReserves } from "./swapPool";

export type AgentIntent = "portfolio" | "risk" | "yield" | "swap" | "bridge" | "passive";
export type AgentDestination = "swap" | "lending" | "bridge";

export type AgentSnapshot = {
  address: Address;
  blockNumber?: string;
  observedAt: string;
  wallet: {
    usdc: number;
    eurc: number;
    usdcPriceUsd: number;
    eurcPriceUsd: number;
    totalUsd: number;
  };
  lending: {
    collateralValue: number;
    debtValue: number;
    availableBorrows: number;
    healthFactorBps: number;
    usdcSupplied: number;
    eurcSupplied: number;
  };
  pool?: {
    usdcReserve: number;
    eurcReserve: number;
  };
  warnings: string[];
};

export type AgentRecommendation = {
  title: string;
  description: string;
  actionLabel: string;
  destination: AgentDestination;
  tone: "positive" | "neutral" | "warning";
};

export type AgentAnswer = {
  intent: AgentIntent;
  headline: string;
  summary: string;
  details: string[];
  recommendations: AgentRecommendation[];
};

const AGENT_READ_TIMEOUT_MS = 7_000;

function withAgentTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(
      () => reject(new Error(`${label} did not respond within 7 seconds.`)),
      AGENT_READ_TIMEOUT_MS
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) globalThis.clearTimeout(timeoutId);
  });
}

function numberFromUnits(value: bigint | undefined, decimals = 6) {
  return value === undefined ? 0 : Number(formatUnits(value, decimals));
}

export async function loadAgentSnapshot(
  address: Address,
  balances: Partial<Record<TokenSymbol, bigint>>
): Promise<AgentSnapshot> {
  const [blockResult, usdcResult, eurcResult, poolResult, pricesResult] = await Promise.allSettled([
    withAgentTimeout(arcPublicClient.getBlockNumber(), "Arc block"),
    withAgentTimeout(getLendingSnapshot(address, "USDC"), "USDC lending data"),
    withAgentTimeout(getLendingSnapshot(address, "EURC"), "EURC lending data"),
    withAgentTimeout(poolReserves(), "Pool reserves"),
    withAgentTimeout(
      Promise.all([getLendingAssetPrice("USDC"), getLendingAssetPrice("EURC")]),
      "Lending asset prices"
    )
  ]);

  const warnings: string[] = [];
  if (blockResult.status === "rejected") warnings.push("Block number unavailable");
  if (usdcResult.status === "rejected") warnings.push("USDC lending read unavailable");
  if (eurcResult.status === "rejected") warnings.push("EURC lending read unavailable");
  if (poolResult.status === "rejected") warnings.push("Pool reserve read unavailable");
  if (pricesResult.status === "rejected") warnings.push("USD price read unavailable; token parity fallback applied");

  const usdcSnapshot = usdcResult.status === "fulfilled" ? usdcResult.value : null;
  const eurcSnapshot = eurcResult.status === "fulfilled" ? eurcResult.value : null;
  const accountData = usdcSnapshot?.accountData ?? eurcSnapshot?.accountData;
  const usdcWallet = usdcSnapshot?.position.walletBalance ?? balances.USDC;
  const eurcWallet = eurcSnapshot?.position.walletBalance ?? balances.EURC;
  const usdc = numberFromUnits(usdcWallet, ARC_TOKENS.USDC.decimals);
  const eurc = numberFromUnits(eurcWallet, ARC_TOKENS.EURC.decimals);
  const [usdcPriceRaw, eurcPriceRaw] = pricesResult.status === "fulfilled"
    ? pricesResult.value
    : [1_000_000n, 1_000_000n];
  const usdcPriceUsd = numberFromUnits(usdcPriceRaw);
  const eurcPriceUsd = numberFromUnits(eurcPriceRaw);
  const pool = poolResult.status === "fulfilled" ? poolResult.value : null;

  return {
    address,
    blockNumber: blockResult.status === "fulfilled" ? blockResult.value.toString() : undefined,
    observedAt: new Date().toISOString(),
    wallet: {
      usdc,
      eurc,
      usdcPriceUsd,
      eurcPriceUsd,
      totalUsd: usdc * usdcPriceUsd + eurc * eurcPriceUsd
    },
    lending: {
      collateralValue: numberFromUnits(accountData?.[0]),
      debtValue: numberFromUnits(accountData?.[1]),
      availableBorrows: numberFromUnits(accountData?.[2]),
      healthFactorBps: Number(accountData?.[3] ?? 0n),
      usdcSupplied: numberFromUnits(usdcSnapshot?.position.collateral),
      eurcSupplied: numberFromUnits(eurcSnapshot?.position.collateral)
    },
    pool: pool
      ? {
          usdcReserve: numberFromUnits(pool.usdcReserve),
          eurcReserve: numberFromUnits(pool.eurcReserve)
        }
      : undefined,
    warnings
  };
}

export function detectAgentIntent(prompt: string): AgentIntent {
  const normalized = prompt.toLowerCase();
  if (/risk|health|debt|borrow|liquid|rủi ro|nợ|vay/.test(normalized)) return "risk";
  if (/yield|apy|earn|supply|lãi|lợi nhuận/.test(normalized)) return "yield";
  if (/swap|exchange|convert|đổi|hoán đổi/.test(normalized)) return "swap";
  if (/bridge|cross.?chain|chuyển chain|nạp usdc/.test(normalized)) return "bridge";
  if (/passive|auto|manage|quản lý|thụ động/.test(normalized)) return "passive";
  return "portfolio";
}

function money(value: number) {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function allocation(snapshot: AgentSnapshot) {
  const { totalUsd, usdc, usdcPriceUsd } = snapshot.wallet;
  return totalUsd > 0 ? ((usdc * usdcPriceUsd) / totalUsd) * 100 : 0;
}

function riskLabel(snapshot: AgentSnapshot) {
  if (snapshot.lending.debtValue === 0) return "No active debt";
  const health = snapshot.lending.healthFactorBps / 100;
  if (health >= 160) return `Healthy at ${health.toFixed(1)}%`;
  if (health >= 120) return `Watch closely at ${health.toFixed(1)}%`;
  return `High liquidation risk at ${health.toFixed(1)}%`;
}

export function buildAgentAnswer(snapshot: AgentSnapshot, prompt = ""): AgentAnswer {
  const intent = detectAgentIntent(prompt);
  const usdcAllocation = allocation(snapshot);
  const { wallet, lending } = snapshot;
  const hasFunds = wallet.totalUsd > 0;
  const hasDebt = lending.debtValue > 0;
  const hasSupply = lending.usdcSupplied + lending.eurcSupplied > 0;

  const commonDetails = [
    `${money(wallet.totalUsd)} estimated wallet value across USDC and EURC`,
    `${money(lending.collateralValue)} collateral and ${money(lending.debtValue)} debt`,
    riskLabel(snapshot)
  ];

  const bridgeRecommendation: AgentRecommendation = {
    title: hasFunds ? "Bridge route is optional" : "Prepare USDC for Arc",
    description: hasFunds
      ? "This wallet already has Arc stablecoin liquidity. Bridge only if you need additional USDC."
      : "No Arc stablecoin balance was detected. Prepare an App Kit route from a supported testnet before using markets.",
    actionLabel: "Open bridge",
    destination: "bridge",
    tone: hasFunds ? "neutral" : "warning"
  };

  const lendingRecommendation: AgentRecommendation = {
    title: hasDebt ? "Protect the lending buffer" : hasSupply ? "Review supplied assets" : "Review read-only yield",
    description: hasDebt
      ? `Current debt is ${money(lending.debtValue)}. Review health before withdrawing collateral or adding borrow exposure.`
      : "The market currently displays a 3.20% supply APY. Review contract state and liquidity before depositing.",
    actionLabel: "Open lending",
    destination: "lending",
    tone: hasDebt && lending.healthFactorBps < 12_000 ? "warning" : "positive"
  };

  const swapRecommendation: AgentRecommendation = {
    title: hasFunds ? "Check stablecoin allocation" : "No swap balance yet",
    description: hasFunds
      ? `Wallet allocation is ${usdcAllocation.toFixed(1)}% USDC and ${(100 - usdcAllocation).toFixed(1)}% EURC. Preview price impact before changing that mix.`
      : "Bridge or receive USDC/EURC first, then request a pool quote before signing.",
    actionLabel: "Open swap",
    destination: "swap",
    tone: hasFunds && (usdcAllocation > 90 || usdcAllocation < 10) ? "warning" : "neutral"
  };

  if (intent === "risk") {
    return {
      intent,
      headline: riskLabel(snapshot),
      summary: hasDebt
        ? `The position has ${money(lending.collateralValue)} collateral against ${money(lending.debtValue)} debt.`
        : "No debt is active, so this wallet has no current lending liquidation exposure.",
      details: [
        `Available borrow capacity: ${money(lending.availableBorrows)}`,
        `Supplied: ${money(lending.usdcSupplied)} USDC and ${money(lending.eurcSupplied)} EURC`,
        "Agent execution is disabled; this report cannot repay, borrow, or withdraw"
      ],
      recommendations: [lendingRecommendation]
    };
  }

  if (intent === "yield" || intent === "passive") {
    return {
      intent,
      headline: hasFunds ? "Idle balance can be evaluated for supply" : "Fund the wallet before comparing yield",
      summary: hasFunds
      ? `${money(wallet.totalUsd)} in estimated wallet value is available. LumenFi displays a 3.20% supply APY, but the agent will not deposit automatically.`
        : "No USDC or EURC is available for a lending or liquidity strategy.",
      details: [
        "Compare wallet liquidity needs before supplying assets",
        "Keep a reserve for Arc gas and planned transactions",
        "Displayed APY is a market UI rate, not a guaranteed return"
      ],
      recommendations: hasFunds ? [lendingRecommendation, swapRecommendation] : [bridgeRecommendation]
    };
  }

  if (intent === "swap") {
    return {
      intent,
      headline: hasFunds ? "Preview the USDC/EURC route" : "A token balance is required",
      summary: swapRecommendation.description,
      details: [
        snapshot.pool
          ? `Pool reserves observed: ${money(snapshot.pool.usdcReserve)} USDC and ${money(snapshot.pool.eurcReserve)} EURC`
          : "Pool reserves were unavailable during this analysis",
        "Use the live quote for minimum received and price impact",
        "The agent prepares guidance only and cannot approve or sign"
      ],
      recommendations: [swapRecommendation]
    };
  }

  if (intent === "bridge") {
    return {
      intent,
      headline: bridgeRecommendation.title,
      summary: bridgeRecommendation.description,
      details: [
        "LumenFi supports route preparation into Arc Testnet",
        "Confirm source chain, destination, amount, and wallet before continuing",
        "Bridge execution remains user-controlled through the connected wallet"
      ],
      recommendations: [bridgeRecommendation]
    };
  }

  return {
    intent,
    headline: hasFunds ? "Portfolio is ready for review" : "No active stablecoin balance detected",
    summary: hasFunds
      ? `The wallet holds ${wallet.usdc.toFixed(2)} USDC and ${wallet.eurc.toFixed(2)} EURC, valued from the lending market's USD prices. ${riskLabel(snapshot)}.`
      : "Connect and fund this Arc wallet to unlock balance-aware market guidance.",
    details: commonDetails,
    recommendations: [lendingRecommendation, swapRecommendation, bridgeRecommendation]
  };
}
