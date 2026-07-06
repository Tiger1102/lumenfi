import { type EIP1193Provider, type TokenSymbol } from "./arc";

type AppKitInstance = {
  swap?: (params: Record<string, unknown>) => Promise<unknown>;
  estimateBridge?: (params: Record<string, unknown>) => Promise<unknown>;
  bridge?: (params: Record<string, unknown>) => Promise<unknown>;
  unifiedBalance?: {
    getBalances?: (params: Record<string, unknown>) => Promise<unknown>;
  };
};

export type SwapQuoteInput = {
  provider: EIP1193Provider;
  from: TokenSymbol;
  to: TokenSymbol;
  amount: string;
};

export type BridgeInput = {
  provider: EIP1193Provider;
  sourceChain: "Arc_Testnet" | "Base_Sepolia" | "Ethereum_Sepolia" | "Arbitrum_Sepolia";
  destinationChain: "Arc_Testnet" | "Base_Sepolia" | "Ethereum_Sepolia" | "Arbitrum_Sepolia";
  amount: string;
  recipientAddress?: string;
};

export function isCircleAppKitEnabled() {
  return Boolean(import.meta.env.VITE_CIRCLE_APP_KIT_KEY);
}

export async function createCircleAppKit(provider: EIP1193Provider): Promise<{ kit: AppKitInstance; adapter: unknown; kitKey?: string }> {
  const kitKey = import.meta.env.VITE_CIRCLE_APP_KIT_KEY as string | undefined;

  const [{ AppKit }, { createViemAdapterFromProvider }] = await Promise.all([
    import("@circle-fin/app-kit"),
    import("@circle-fin/adapter-viem-v2")
  ]);

  const createAdapter = createViemAdapterFromProvider as unknown as (params: { provider: EIP1193Provider }) => Promise<unknown>;
  const AppKitCtor = AppKit as unknown as new () => AppKitInstance;
  const adapter = await createAdapter({ provider });

  return {
    kit: new AppKitCtor(),
    adapter,
    kitKey
  };
}

export async function requestSwap(input: SwapQuoteInput) {
  const { kit, adapter, kitKey } = await createCircleAppKit(input.provider);

  if (!kitKey) {
    throw new Error("Circle swap routing requires a Kit Key. Use the LumenFi USDC/EURC pool for this deployment.");
  }

  if (!kit.swap) {
    throw new Error("Swap routing is not available in this deployment.");
  }

  return kit.swap({
    from: { adapter, chain: "Arc_Testnet" },
    tokenIn: input.from,
    tokenOut: input.to,
    amountIn: input.amount,
    config: {
      kitKey
    }
  });
}

export async function estimateBridge(input: BridgeInput) {
  const { kit, adapter } = await createCircleAppKit(input.provider);

  if (!kit.estimateBridge) {
    throw new Error("Bridge estimate is not available in this deployment.");
  }

  return kit.estimateBridge({
    from: { adapter, chain: input.sourceChain },
    to: { adapter, chain: input.destinationChain },
    amount: input.amount,
    token: "USDC",
    ...(input.recipientAddress ? { recipientAddress: input.recipientAddress } : {})
  });
}

export async function requestBridge(input: BridgeInput) {
  const { kit, adapter } = await createCircleAppKit(input.provider);

  if (!kit.bridge) {
    throw new Error("Bridge routing is not available in this deployment.");
  }

  return kit.bridge({
    from: { adapter, chain: input.sourceChain },
    to: { adapter, chain: input.destinationChain },
    amount: input.amount,
    token: "USDC",
    ...(input.recipientAddress ? { recipientAddress: input.recipientAddress } : {})
  });
}

export async function requestUnifiedBalances(provider: EIP1193Provider, owner: string) {
  const { kit, adapter } = await createCircleAppKit(provider);

  if (!kit.unifiedBalance?.getBalances) {
    throw new Error("Unified balance is not available in this deployment.");
  }

  return kit.unifiedBalance.getBalances({
    token: "USDC",
    sources: { adapter },
    includePending: true,
    networkType: "testnet"
  });
}



