import { formatUnits, parseUnits, type Address, type WalletClient } from "viem";
import { arcPublicClient, arcTestnet, ARC_TOKENS, erc20Abi, formatTokenAmount, getTokenAddress, parseTokenAmount, readWithRetry, type TokenSymbol } from "./arc";

export const swapPoolAddress = (import.meta.env.VITE_SWAP_POOL_ADDRESS || "") as Address;

export const swapPoolAbi = [
  {
    type: "function",
    name: "addLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "usdcAmount", type: "uint256" },
      { name: "eurcAmount", type: "uint256" },
      { name: "minShares", type: "uint256" }
    ],
    outputs: [{ name: "shares", type: "uint256" }]
  },
  {
    type: "function",
    name: "removeLiquidity",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "minUsdc", type: "uint256" },
      { name: "minEurc", type: "uint256" },
      { name: "receiver", type: "address" }
    ],
    outputs: [
      { name: "usdcAmount", type: "uint256" },
      { name: "eurcAmount", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" }
    ],
    outputs: [
      { name: "tokenOut", type: "address" },
      { name: "amountOut", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "swap",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "amountIn", type: "uint256" }
    ],
    outputs: [
      { name: "tokenOut", type: "address" },
      { name: "amountOut", type: "uint256" }
    ]
  }
] as const;

export function supportsPoolSwap(from: TokenSymbol, to: TokenSymbol) {
  return (from === "USDC" && to === "EURC") || (from === "EURC" && to === "USDC");
}

export async function poolQuote(from: TokenSymbol, to: TokenSymbol, amountText: string) {
  if (!swapPoolAddress || !supportsPoolSwap(from, to)) {
    return null;
  }

  const amountIn = parseTokenAmount(amountText, ARC_TOKENS[from]);
  return readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: swapPoolAddress,
        abi: swapPoolAbi,
        functionName: "quote",
        args: [getTokenAddress(from), amountIn]
      }),
    "Pool quote"
  );
}

export async function getPoolSwapPreview(owner: Address | undefined, from: TokenSymbol, to: TokenSymbol, amountText: string) {
  if (!swapPoolAddress || !supportsPoolSwap(from, to)) {
    return null;
  }

  const token = ARC_TOKENS[from];
  const amountIn = parseTokenAmount(amountText, token);
  if (amountIn === 0n) {
    return null;
  }

  const quote = await poolQuote(from, to, amountText);
  const balance = owner
    ? await readWithRetry(
        () =>
          arcPublicClient.readContract({
            address: getTokenAddress(from),
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner]
          }),
        `${from} balance`
      )
    : 0n;

  return {
    amountIn,
    amountOut: quote?.[1] ?? 0n,
    balance,
    outputText: quote ? formatTokenAmount(quote[1], ARC_TOKENS[to]) : "--"
  };
}

export async function poolReserves() {
  if (!swapPoolAddress) {
    return null;
  }

  const usdcReserve = await readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: getTokenAddress("USDC"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [swapPoolAddress]
      }),
    "USDC reserve"
  );
  const eurcReserve = await readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: getTokenAddress("EURC"),
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [swapPoolAddress]
      }),
    "EURC reserve"
  );

  return { usdcReserve, eurcReserve };
}

export async function poolPosition(account?: Address) {
  if (!swapPoolAddress) {
    return null;
  }

  const reserves = await poolReserves();
  const totalSupply = await readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: swapPoolAddress,
        abi: swapPoolAbi,
        functionName: "totalSupply"
      }),
    "LP total supply"
  );
  const lpBalance = account
    ? await readWithRetry(
        () =>
          arcPublicClient.readContract({
            address: swapPoolAddress,
            abi: swapPoolAbi,
            functionName: "balanceOf",
            args: [account]
          }),
        "LP balance"
      )
    : 0n;

  return {
    usdcReserve: reserves?.usdcReserve ?? 0n,
    eurcReserve: reserves?.eurcReserve ?? 0n,
    totalSupply,
    lpBalance
  };
}

export function formatLpAmount(value: bigint) {
  const formatted = formatUnits(value, 18);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseLpAmount(value: string) {
  return parseUnits(value || "0", 18);
}

export function quoteRemoveLiquidity(position: {
  usdcReserve: bigint;
  eurcReserve: bigint;
  totalSupply: bigint;
  lpBalance: bigint;
}, shares: bigint) {
  if (position.totalSupply === 0n || shares === 0n) {
    return { usdcAmount: 0n, eurcAmount: 0n };
  }

  return {
    usdcAmount: (shares * position.usdcReserve) / position.totalSupply,
    eurcAmount: (shares * position.eurcReserve) / position.totalSupply
  };
}

export async function removePoolLiquidity(walletClient: WalletClient, account: Address, shares: bigint) {
  if (!swapPoolAddress) {
    throw new Error("Swap pool is not configured for this deployment");
  }

  if (shares === 0n) {
    throw new Error("Choose how much liquidity to remove.");
  }

  const position = await poolPosition(account);
  if (!position || position.lpBalance === 0n) {
    throw new Error("This wallet has no LP position to remove.");
  }

  if (shares > position.lpBalance) {
    throw new Error("Remove amount exceeds your LP balance.");
  }

  const removeHash = await walletClient.writeContract({
    address: swapPoolAddress,
    abi: swapPoolAbi,
    functionName: "removeLiquidity",
    args: [shares, 0n, 0n, account],
    account,
    chain: arcTestnet
  });
  return arcPublicClient.waitForTransactionReceipt({ hash: removeHash });
}

export async function managePoolLiquidity(
  walletClient: WalletClient,
  account: Address,
  action: "add" | "remove",
  usdcAmountText: string,
  eurcAmountText: string,
  sharesText = "0"
) {
  if (!swapPoolAddress) {
    throw new Error("Swap pool is not configured for this deployment");
  }

  if (action === "add") {
    const usdcAmount = parseTokenAmount(usdcAmountText, ARC_TOKENS.USDC);
    const eurcAmount = parseTokenAmount(eurcAmountText, ARC_TOKENS.EURC);

    if (usdcAmount === 0n || eurcAmount === 0n) {
      throw new Error("Enter both USDC and EURC amounts to add liquidity.");
    }

    const approvals = [
      { symbol: "USDC" as const, amount: usdcAmount },
      { symbol: "EURC" as const, amount: eurcAmount }
    ];

    for (const item of approvals) {
      const tokenAddress = getTokenAddress(item.symbol);
      const allowance = await readWithRetry(
        () =>
          arcPublicClient.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [account, swapPoolAddress]
          }),
        `${item.symbol} allowance`
      );

      if (allowance < item.amount) {
        const approveHash = await walletClient.writeContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [swapPoolAddress, item.amount],
          account,
          chain: arcTestnet
        });
        await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
      }
    }

    const addHash = await walletClient.writeContract({
      address: swapPoolAddress,
      abi: swapPoolAbi,
      functionName: "addLiquidity",
      args: [usdcAmount, eurcAmount, 0n],
      account,
      chain: arcTestnet
    });
    return arcPublicClient.waitForTransactionReceipt({ hash: addHash });
  }

  return removePoolLiquidity(walletClient, account, parseLpAmount(sharesText));
}

export async function poolSwap(walletClient: WalletClient, owner: Address, from: TokenSymbol, to: TokenSymbol, amountText: string) {
  if (!swapPoolAddress) {
    throw new Error("Swap pool is not configured for this deployment");
  }

  if (!supportsPoolSwap(from, to)) {
    throw new Error("LumenFi pool supports only USDC <-> EURC.");
  }

  const token = ARC_TOKENS[from];
  const tokenAddress = getTokenAddress(from);
  const amountIn = parseTokenAmount(amountText, token);
  const preview = await getPoolSwapPreview(owner, from, to, amountText);

  if (!preview || preview.amountOut === 0n) {
    throw new Error("This route has no output. Try a smaller amount or add pool liquidity first.");
  }

  if (preview.balance < amountIn) {
    throw new Error(`Insufficient ${from} balance for this swap.`);
  }

  const allowance = await readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, swapPoolAddress]
      }),
    `${from} allowance`
  );

  if (allowance < amountIn) {
    const approveHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [swapPoolAddress, amountIn],
      account: owner,
      chain: arcTestnet
    });
    await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const swapHash = await walletClient.writeContract({
    address: swapPoolAddress,
    abi: swapPoolAbi,
    functionName: "swap",
    args: [tokenAddress, amountIn],
    account: owner,
    chain: arcTestnet
  });

  return arcPublicClient.waitForTransactionReceipt({ hash: swapHash });
}

export async function getSwapAllowance(owner: Address, token: TokenSymbol) {
  if (!swapPoolAddress || !ARC_TOKENS[token].address) return 0n;
  return readWithRetry(() => arcPublicClient.readContract({ address: getTokenAddress(token), abi: erc20Abi, functionName: "allowance", args: [owner, swapPoolAddress] }), `${token} swap allowance`);
}

export async function approveSwap(walletClient: WalletClient, owner: Address, token: TokenSymbol, amountText: string) {
  const amount = parseTokenAmount(amountText, ARC_TOKENS[token]);
  if (!swapPoolAddress || amount === 0n) throw new Error("Enter an amount before approving.");
  const hash = await walletClient.writeContract({ address: getTokenAddress(token), abi: erc20Abi, functionName: "approve", args: [swapPoolAddress, amount], account: owner, chain: arcTestnet });
  return arcPublicClient.waitForTransactionReceipt({ hash });
}
