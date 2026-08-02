import { formatUnits, parseUnits, type Address, type WalletClient } from "viem";
import { encodeFunctionData } from "viem";
import { arcPublicClient, arcTestnet, ARC_TOKENS, erc20Abi, formatTokenAmount, getTokenAddress, parseTokenAmount, prepareArcTransaction, readWithRetry, type TokenSymbol } from "./arc";

export const swapPoolAddress = (import.meta.env?.VITE_SWAP_POOL_ADDRESS || "") as Address;
const LP_DECIMALS = 6;
const LIQUIDITY_SLIPPAGE_BPS = 50n;
const BPS = 10_000n;
const SWAP_FEE_BPS = 30n;

export const swapPoolAbi = [
  {
    type: "function",
    name: "reserves",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "usdcReserve", type: "uint256" },
      { name: "eurcReserve", type: "uint256" }
    ]
  },
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
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "deadline", type: "uint256" }
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

export function calculatePriceImpactBps(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, amountOut: bigint) {
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) return 0n;
  const feeAdjustedAmountIn = (amountIn * (BPS - SWAP_FEE_BPS)) / BPS;
  const spotAmountOut = (feeAdjustedAmountIn * reserveOut) / reserveIn;
  return spotAmountOut > amountOut && spotAmountOut > 0n
    ? ((spotAmountOut - amountOut) * BPS) / spotAmountOut
    : 0n;
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

  const [quote, balance, reserves] = await Promise.all([
    poolQuote(from, to, amountText),
    owner
      ? readWithRetry(
          () =>
            arcPublicClient.readContract({
              address: getTokenAddress(from),
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [owner]
            }),
          `${from} balance`
        )
      : Promise.resolve(0n),
    poolReserves()
  ]);
  const reserveIn = from === "USDC" ? reserves?.usdcReserve ?? 0n : reserves?.eurcReserve ?? 0n;
  const reserveOut = from === "USDC" ? reserves?.eurcReserve ?? 0n : reserves?.usdcReserve ?? 0n;
  const quotedAmountOut = quote?.[1] ?? 0n;
  const priceImpactBps = calculatePriceImpactBps(amountIn, reserveIn, reserveOut, quotedAmountOut);

  return {
    amountIn,
    amountOut: quotedAmountOut,
    balance,
    priceImpactBps,
    outputText: quote ? formatTokenAmount(quote[1], ARC_TOKENS[to]) : "--"
  };
}

export async function poolReserves() {
  if (!swapPoolAddress) {
    return null;
  }

  const [usdcReserve, eurcReserve] = await readWithRetry(
    () =>
      arcPublicClient.readContract({
        address: swapPoolAddress,
        abi: swapPoolAbi,
        functionName: "reserves"
      }),
    "Pool reserves"
  );

  return { usdcReserve, eurcReserve };
}

export async function poolPosition(account?: Address) {
  if (!swapPoolAddress) {
    return null;
  }

  const [reserves, totalSupply, lpBalance] = await Promise.all([
    poolReserves(),
    readWithRetry(
      () =>
        arcPublicClient.readContract({
          address: swapPoolAddress,
          abi: swapPoolAbi,
          functionName: "totalSupply"
        }),
      "LP total supply"
    ),
    account
      ? readWithRetry(
        () =>
          arcPublicClient.readContract({
            address: swapPoolAddress,
            abi: swapPoolAbi,
            functionName: "balanceOf",
            args: [account]
          }),
        "LP balance"
      )
      : Promise.resolve(0n)
  ]);

  return {
    usdcReserve: reserves?.usdcReserve ?? 0n,
    eurcReserve: reserves?.eurcReserve ?? 0n,
    totalSupply,
    lpBalance
  };
}

export function formatLpAmount(value: bigint) {
  const formatted = formatUnits(value, LP_DECIMALS);
  const [whole, fraction = ""] = formatted.split(".");
  const trimmed = fraction.slice(0, 4).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function parseLpAmount(value: string) {
  return parseUnits(value || "0", LP_DECIMALS);
}

function minBigInt(a: bigint, b: bigint) {
  return a < b ? a : b;
}

function sqrtBigInt(value: bigint) {
  if (value < 2n) return value;
  let current = value;
  let next = (current + value / current) / 2n;
  while (next < current) {
    current = next;
    next = (current + value / current) / 2n;
  }
  return current;
}

function withLiquiditySlippage(value: bigint) {
  return (value * (BPS - LIQUIDITY_SLIPPAGE_BPS)) / BPS;
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

  const quote = quoteRemoveLiquidity(position, shares);
  const request = {
    address: swapPoolAddress,
    abi: swapPoolAbi,
    functionName: "removeLiquidity",
    args: [shares, withLiquiditySlippage(quote.usdcAmount), withLiquiditySlippage(quote.eurcAmount), account],
    account,
    chain: arcTestnet
  } as const;
  const gas = await prepareArcTransaction({ account, to: request.address, data: encodeFunctionData(request) });
  const removeHash = await walletClient.writeContract({ ...request, ...gas });
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
        const request = {
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "approve",
          args: [swapPoolAddress, item.amount],
          account,
          chain: arcTestnet
        } as const;
        const gas = await prepareArcTransaction({ account, to: request.address, data: encodeFunctionData(request) });
        const approveHash = await walletClient.writeContract({ ...request, ...gas });
        await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
      }
    }

    const position = await poolPosition(account);
    if (!position) {
      throw new Error("Pool state is unavailable. Refresh and try again.");
    }
    const expectedShares = position.totalSupply === 0n
      ? sqrtBigInt(usdcAmount * eurcAmount)
      : position.usdcReserve > 0n && position.eurcReserve > 0n
        ? minBigInt(
            (usdcAmount * position.totalSupply) / position.usdcReserve,
            (eurcAmount * position.totalSupply) / position.eurcReserve
          )
        : 0n;
    if (expectedShares === 0n) {
      throw new Error("These amounts would mint no LP shares.");
    }

    const request = {
      address: swapPoolAddress,
      abi: swapPoolAbi,
      functionName: "addLiquidity",
      args: [usdcAmount, eurcAmount, withLiquiditySlippage(expectedShares)],
      account,
      chain: arcTestnet
    } as const;
    const gas = await prepareArcTransaction({ account, to: request.address, data: encodeFunctionData(request) });
    const addHash = await walletClient.writeContract({ ...request, ...gas });
    return arcPublicClient.waitForTransactionReceipt({ hash: addHash });
  }

  return removePoolLiquidity(walletClient, account, parseLpAmount(sharesText));
}

export async function poolSwap(walletClient: WalletClient, owner: Address, from: TokenSymbol, to: TokenSymbol, amountText: string, slippageBps = 50) {
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
    const request = {
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "approve",
      args: [swapPoolAddress, amountIn],
      account: owner,
      chain: arcTestnet
    } as const;
    const gas = await prepareArcTransaction({ account: owner, to: request.address, data: encodeFunctionData(request) });
    const approveHash = await walletClient.writeContract({ ...request, ...gas });
    await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const boundedSlippageBps = BigInt(Math.max(0, Math.min(5_000, Math.round(slippageBps))));
  const minimumAmountOut = (preview.amountOut * (BPS - boundedSlippageBps)) / BPS;
  const deadline = BigInt(Math.floor(Date.now() / 1_000) + 20 * 60);

  const request = {
    address: swapPoolAddress,
    abi: swapPoolAbi,
    functionName: "swap",
    args: [tokenAddress, amountIn, minimumAmountOut, deadline],
    account: owner,
    chain: arcTestnet
  } as const;
  const gas = await prepareArcTransaction({ account: owner, to: request.address, data: encodeFunctionData(request) });
  const swapHash = await walletClient.writeContract({ ...request, ...gas });

  return arcPublicClient.waitForTransactionReceipt({ hash: swapHash });
}

export async function getSwapAllowance(owner: Address, token: TokenSymbol) {
  if (!swapPoolAddress || !ARC_TOKENS[token].address) return 0n;
  return readWithRetry(() => arcPublicClient.readContract({ address: getTokenAddress(token), abi: erc20Abi, functionName: "allowance", args: [owner, swapPoolAddress] }), `${token} swap allowance`);
}

export async function approveSwap(walletClient: WalletClient, owner: Address, token: TokenSymbol, amountText: string) {
  const amount = parseTokenAmount(amountText, ARC_TOKENS[token]);
  if (!swapPoolAddress || amount === 0n) throw new Error("Enter an amount before approving.");
  const request = { address: getTokenAddress(token), abi: erc20Abi, functionName: "approve", args: [swapPoolAddress, amount], account: owner, chain: arcTestnet } as const;
  const gas = await prepareArcTransaction({ account: owner, to: request.address, data: encodeFunctionData(request) });
  const hash = await walletClient.writeContract({ ...request, ...gas });
  return arcPublicClient.waitForTransactionReceipt({ hash });
}
