import { createPublicClient, defineChain, fallback, formatUnits, http, parseUnits, type Address } from "viem";

import { parseGwei, type Hex } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
export const ARC_GAS_RESERVE_USDC = 20_000n;
const configuredFallbackRpcs = (import.meta.env?.VITE_ARC_FALLBACK_RPCS || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);
export const ARC_TESTNET_RPCS = [
  ARC_TESTNET_RPC,
  ...configuredFallbackRpcs,
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network",
].filter((url, index, urls) => urls.indexOf(url) === index);
const ARC_BROWSER_READ_RPCS = ARC_TESTNET_RPCS;

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "USDC",
    symbol: "USDC"
  },
  rpcUrls: {
    default: {
      http: ARC_TESTNET_RPCS
    }
  },
  blockExplorers: {
    default: {
      name: "Arc Explorer",
      url: "https://testnet.arcscan.app"
    }
  },
  testnet: true
});

export const arcPublicClient = createPublicClient({
  chain: arcTestnet,
  transport: fallback(
    ARC_BROWSER_READ_RPCS.map((url) => http(url, { timeout: 2_000, retryCount: 0 })),
    { rank: false, retryCount: 0 }
  )
});

const ARC_MIN_MAX_FEE_PER_GAS = parseGwei("30");
const ARC_MIN_PRIORITY_FEE_PER_GAS = parseGwei("1");

export type ArcTransactionGas = {
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

function larger(value: bigint | undefined, minimum: bigint) {
  return value !== undefined && value > minimum ? value : minimum;
}

function transactionPreparationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/request limit|rate limit|too many requests|429|timeout/i.test(message)) {
    return new Error("Arc RPC is busy while estimating the network fee. Wait a moment and retry; your wallet balance has not changed.");
  }
  if (/insufficient funds|insufficient.*gas/i.test(message)) {
    return new Error("Insufficient USDC for Arc network fees. Add Arc Testnet USDC from the Circle Faucet and try again.");
  }
  if (/revert|execution reverted/i.test(message)) {
    return new Error(`Contract simulation rejected this action. ${message}`);
  }
  return new Error(`Arc could not prepare the network fee. Retry or set the wallet RPC to ${ARC_TESTNET_RPC}.`);
}

export async function prepareArcTransaction(input: {
  account: Address;
  to: Address;
  data: Hex;
}): Promise<ArcTransactionGas> {
  const [gasResult, feesResult, balanceResult] = await Promise.allSettled([
    readWithRetry(() => arcPublicClient.estimateGas({ account: input.account, to: input.to, data: input.data }), "Arc gas estimate"),
    readWithRetry(() => arcPublicClient.estimateFeesPerGas({ type: "eip1559" }), "Arc fee estimate"),
    readWithRetry(() => arcPublicClient.getBalance({ address: input.account }), "Arc gas balance")
  ]);

  if (gasResult.status === "rejected") {
    throw transactionPreparationError(gasResult.reason);
  }

  const gas = (gasResult.value * 125n + 99n) / 100n;
  const estimatedFees = feesResult.status === "fulfilled" ? feesResult.value : undefined;
  const maxPriorityFeePerGas = larger(estimatedFees?.maxPriorityFeePerGas, ARC_MIN_PRIORITY_FEE_PER_GAS);
  const estimatedMaxFeePerGas = larger(estimatedFees?.maxFeePerGas, ARC_MIN_MAX_FEE_PER_GAS);
  const maxFeePerGas = estimatedMaxFeePerGas > maxPriorityFeePerGas
    ? estimatedMaxFeePerGas
    : maxPriorityFeePerGas + ARC_MIN_MAX_FEE_PER_GAS;
  const maximumFee = gas * maxFeePerGas;

  if (balanceResult.status === "fulfilled" && balanceResult.value < maximumFee) {
    throw new Error("Insufficient USDC for Arc network fees. Add Arc Testnet USDC from the Circle Faucet and try again.");
  }

  return { gas, maxFeePerGas, maxPriorityFeePerGas };
}

export type TokenSymbol = "USDC" | "EURC" | "cirBTC";

export type ArcToken = {
  symbol: TokenSymbol;
  name: string;
  address?: Address;
  decimals: number;
  accent: string;
};

export const ARC_TOKENS: Record<TokenSymbol, ArcToken> = {
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    decimals: 6,
    accent: "#2775ca"
  },
  EURC: {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
    decimals: 6,
    accent: "#0a8f68"
  },
  cirBTC: {
    symbol: "cirBTC",
    name: "Circle Bitcoin",
    address: (import.meta.env?.VITE_CIRBTC_ADDRESS || undefined) as Address | undefined,
    decimals: 8,
    accent: "#f7931a"
  }
};

export const BALANCE_TOKEN_SYMBOLS: TokenSymbol[] = ["USDC", "EURC", "cirBTC"];

export function getTokenAddress(symbol: TokenSymbol): Address {
  const address = ARC_TOKENS[symbol].address;

  if (!address) {
    throw new Error(`${symbol} does not have a public ERC-20 balance address in Arc docs.`);
  }

  return address;
}

export const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" }
    ],
    outputs: [{ name: "", type: "bool" }]
  }
] as const;

function wait(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

export function isArcRateLimitError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /request limit|rate limit|too many requests|429/i.test(message);
}

export async function readWithRetry<T>(read: () => Promise<T>, label = "RPC read"): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isArcRateLimitError(error)) await wait(250);
    try {
      return await read();
    } catch (retryError) {
      throw retryError instanceof Error ? retryError : new Error(`${label} failed.`);
    }
  }
}

export function formatTokenAmount(value: bigint, token: ArcToken) {
  const formatted = formatUnits(value, token.decimals);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseTokenAmount(value: string, token: ArcToken) {
  return parseUnits(value || "0", token.decimals);
}

export async function switchToArc(provider: EIP1193Provider) {
  const chainHex = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainHex }]
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as { code: number }).code : 0;

    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainHex,
          chainName: "Arc Testnet",
          nativeCurrency: {
            name: "USDC",
            symbol: "USDC",
            decimals: 6
          },
          rpcUrls: [ARC_TESTNET_RPC, ...ARC_TESTNET_RPCS.filter((url) => url !== ARC_TESTNET_RPC)],
          blockExplorerUrls: ["https://testnet.arcscan.app"]
        }
      ]
    });
  }
}

export type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EIP1193Provider & {
      providers?: EIP1193Provider[];
      isMetaMask?: boolean;
    };
  }
}

