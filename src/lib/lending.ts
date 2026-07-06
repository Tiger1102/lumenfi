import type { Address, WalletClient } from "viem";
import { arcPublicClient, arcTestnet, ARC_TOKENS, erc20Abi, getTokenAddress, parseTokenAmount, type TokenSymbol } from "./arc";

export const lendingPoolAddress = (import.meta.env.VITE_LENDING_POOL_ADDRESS || "") as Address;

export const lendingPoolAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "borrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "getAccountData",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "collateralValue", type: "uint256" },
      { name: "debtValue", type: "uint256" },
      { name: "availableBorrows", type: "uint256" },
      { name: "healthFactorBps", type: "uint256" }
    ]
  },
  {
    type: "function",
    name: "collateralOf",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "asset", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "debtOf",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "asset", type: "address" }
    ],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "totalSupplied",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    name: "totalBorrowed",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  }
] as const;

export type LendingTokenPosition = {
  collateral: bigint;
  debt: bigint;
  totalSupplied: bigint;
  totalBorrowed: bigint;
  walletBalance: bigint;
};

export async function approveIfNeeded(walletClient: WalletClient, owner: Address, tokenSymbol: TokenSymbol, amountText: string) {
  if (!lendingPoolAddress) {
    throw new Error("Lending market is not configured for this deployment.");
  }

  const token = ARC_TOKENS[tokenSymbol];
  const tokenAddress = getTokenAddress(tokenSymbol);
  const amount = parseTokenAmount(amountText, token);
  const allowance = await arcPublicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, lendingPoolAddress]
  });

  if (allowance >= amount) {
    return undefined;
  }

  return walletClient.writeContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [lendingPoolAddress, amount],
    account: owner,
    chain: arcTestnet
  });
}

export async function lendingAction(
  walletClient: WalletClient,
  owner: Address,
  action: "deposit" | "withdraw" | "borrow" | "repay",
  tokenSymbol: TokenSymbol,
  amountText: string
) {
  if (!lendingPoolAddress) {
    throw new Error("Lending market is not configured for this deployment.");
  }

  const token = ARC_TOKENS[tokenSymbol];
  const tokenAddress = getTokenAddress(tokenSymbol);
  const amount = parseTokenAmount(amountText, token);
  const [position, accountData] = await Promise.all([getLendingTokenPosition(owner, tokenSymbol), getAccountData(owner)]);

  if (amount === 0n) {
    throw new Error("Enter an amount greater than zero.");
  }

  if ((action === "deposit" || action === "repay") && position.walletBalance < amount) {
    throw new Error(`Insufficient ${tokenSymbol} wallet balance.`);
  }

  if (action === "withdraw") {
    if (amount > position.collateral) {
      throw new Error(`Withdraw amount exceeds your supplied ${tokenSymbol}.`);
    }

    if (accountData && accountData[1] > 0n) {
      const minimumCollateral = (accountData[1] * 10_000n + 8_499n) / 8_500n;
      const maxWithdrawValue = accountData[0] > minimumCollateral ? accountData[0] - minimumCollateral : 0n;

      if (amount > maxWithdrawValue) {
        throw new Error("Withdraw amount would make the lending position unhealthy. Use a smaller amount or repay debt first.");
      }
    }
  }

  if (action === "borrow" && accountData && amount > accountData[2]) {
    throw new Error("Borrow amount exceeds your available borrowing power.");
  }

  if (action === "repay" && amount > position.debt) {
    throw new Error(`Repay amount exceeds your ${tokenSymbol} debt. Use Max to repay the exact open debt.`);
  }

  if (action === "deposit" || action === "repay") {
    const approveHash = await approveIfNeeded(walletClient, owner, tokenSymbol, amountText);

    if (approveHash) {
      await arcPublicClient.waitForTransactionReceipt({ hash: approveHash });
    }
  }

  const hash = await walletClient.writeContract({
    address: lendingPoolAddress,
    abi: lendingPoolAbi,
    functionName: action,
    args: [tokenAddress, amount],
    account: owner,
    chain: arcTestnet
  });

  return arcPublicClient.waitForTransactionReceipt({ hash });
}

export async function getAccountData(address: Address) {
  if (!lendingPoolAddress) {
    return null;
  }

  return arcPublicClient.readContract({
    address: lendingPoolAddress,
    abi: lendingPoolAbi,
    functionName: "getAccountData",
    args: [address]
  });
}

export async function getLendingTokenPosition(address: Address, tokenSymbol: TokenSymbol): Promise<LendingTokenPosition> {
  if (!lendingPoolAddress) {
    return {
      collateral: 0n,
      debt: 0n,
      totalSupplied: 0n,
      totalBorrowed: 0n,
      walletBalance: 0n
    };
  }

  const tokenAddress = getTokenAddress(tokenSymbol);
  const [collateral, debt, totalSupplied, totalBorrowed, walletBalance] = await Promise.all([
    arcPublicClient.readContract({
      address: lendingPoolAddress,
      abi: lendingPoolAbi,
      functionName: "collateralOf",
      args: [address, tokenAddress]
    }),
    arcPublicClient.readContract({
      address: lendingPoolAddress,
      abi: lendingPoolAbi,
      functionName: "debtOf",
      args: [address, tokenAddress]
    }),
    arcPublicClient.readContract({
      address: lendingPoolAddress,
      abi: lendingPoolAbi,
      functionName: "totalSupplied",
      args: [tokenAddress]
    }),
    arcPublicClient.readContract({
      address: lendingPoolAddress,
      abi: lendingPoolAbi,
      functionName: "totalBorrowed",
      args: [tokenAddress]
    }),
    arcPublicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address]
    })
  ]);

  return { collateral, debt, totalSupplied, totalBorrowed, walletBalance };
}
