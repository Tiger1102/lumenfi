import { createPublicClient, defineChain, fallback, formatUnits, http, parseUnits, type Address } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_RPCS = [
  ARC_TESTNET_RPC,
  ...(import.meta.env.VITE_ARC_FALLBACK_RPCS || "").split(",").map((url) => url.trim()).filter(Boolean)
];

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
    ARC_TESTNET_RPCS.map((url) => http(url, { timeout: 3_000, retryCount: 1, retryDelay: 250 })),
    { rank: true, retryCount: 2 }
  )
});

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
    address: (import.meta.env.VITE_CIRBTC_ADDRESS || undefined) as Address | undefined,
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
  let lastError: unknown;

  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;

      if (!isArcRateLimitError(error) || attempt === 3) {
        break;
      }

      await wait(350 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed.`);
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
            decimals: 18
          },
          rpcUrls: ARC_TESTNET_RPCS,
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

