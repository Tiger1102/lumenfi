import hre from "hardhat";
import { parseAbi, parseUnits } from "viem";

const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const SEED_LIQUIDITY = parseUnits("5", 6);

const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)"
]);

const swapPoolAbi = parseAbi(["function addLiquidity(uint256 usdcAmount, uint256 eurcAmount, uint256 minShares) external returns (uint256)"]);

async function main() {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const swapPool = await viem.deployContract("PermissionlessStablePool", [USDC, EURC]);

  const usdcBalance = await publicClient.readContract({
    address: USDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletClient.account.address]
  });
  const eurcBalance = await publicClient.readContract({
    address: EURC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletClient.account.address]
  });

  const usdcAmount = usdcBalance >= SEED_LIQUIDITY ? SEED_LIQUIDITY : 0n;
  const eurcAmount = eurcBalance >= SEED_LIQUIDITY ? SEED_LIQUIDITY : 0n;

  if (usdcAmount > 0n) {
    const hash = await walletClient.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "approve",
      args: [swapPool.address, usdcAmount],
      account: walletClient.account
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  if (eurcAmount > 0n) {
    const hash = await walletClient.writeContract({
      address: EURC,
      abi: erc20Abi,
      functionName: "approve",
      args: [swapPool.address, eurcAmount],
      account: walletClient.account
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  if (usdcAmount > 0n && eurcAmount > 0n) {
    const hash = await walletClient.writeContract({
      address: swapPool.address,
      abi: swapPoolAbi,
      functionName: "addLiquidity",
      args: [usdcAmount, eurcAmount, 0n],
      account: walletClient.account
    });
    await publicClient.waitForTransactionReceipt({ hash });
  } else {
    console.log("Seed skipped: deployer needs both USDC and EURC for initial pool liquidity.");
  }

  console.log("Deployer:", walletClient.account.address);
  console.log("PermissionlessStablePool:", swapPool.address);
  console.log("Seeded USDC:", usdcAmount.toString());
  console.log("Seeded EURC:", eurcAmount.toString());
  console.log("Block:", await publicClient.getBlockNumber());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
