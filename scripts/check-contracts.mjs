import { createPublicClient, defineChain, encodeFunctionData, http, parseAbi, parseGwei, formatUnits } from "viem";

const rpcUrls = [
  "https://rpc.testnet.arc.network",
  "https://rpc.blockdaemon.testnet.arc.network",
  "https://rpc.drpc.testnet.arc.network",
  "https://rpc.quicknode.testnet.arc.network"
];
const arcTestnet = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { decimals: 18, name: "USDC", symbol: "USDC" }, rpcUrls: { default: { http: rpcUrls } }, testnet: true });
const rpcClients = rpcUrls.map((url) => createPublicClient({ chain: arcTestnet, transport: http(url, { timeout: 5_000, retryCount: 0 }) }));
let nextRpc = 0;

async function runRpc(method, args) {
  const start = nextRpc;
  nextRpc = (nextRpc + 1) % rpcClients.length;
  let lastError;

  for (let attempt = 0; attempt < rpcClients.length; attempt += 1) {
    const rpcClient = rpcClients[(start + attempt) % rpcClients.length];
    try {
      return await rpcClient[method](args);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

const client = {
  getBytecode: (args) => runRpc("getBytecode", args),
  readContract: (args) => runRpc("readContract", args),
  estimateGas: (args) => runRpc("estimateGas", args),
  estimateFeesPerGas: (args) => runRpc("estimateFeesPerGas", args),
  getBalance: (args) => runRpc("getBalance", args),
  simulateContract: (args) => runRpc("simulateContract", args)
};
const lending = "0x474552ce815a68443bdfcafd089cdb345791d204";
const swap = "0x212622812664e37abbb99774ee7488bc721b38b3";
const usdc = "0x3600000000000000000000000000000000000000";
const eurc = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
const readinessAccount = "0x5bc6225a3D4150d49BD6A199C9235d72eCaEb691";

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)"
]);
const stable = parseAbi([
  "function usdc() view returns (address)",
  "function eurc() view returns (address)",
  "function FEE_BPS() view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function quote(address,uint256) view returns (address,uint256)",
  "function swap(address,uint256,uint256,uint256) returns (address,uint256)"
]);
const lend = parseAbi([
  "function owner() view returns (address)",
  "function LTV_BPS() view returns (uint256)",
  "function LIQUIDATION_THRESHOLD_BPS() view returns (uint256)",
  "function LIQUIDATION_BONUS_BPS() view returns (uint256)",
  "function isAsset(address) view returns (bool)",
  "function assetDecimals(address) view returns (uint8)",
  "function priceUsd(address) view returns (uint256)",
  "function totalSupplied(address) view returns (uint256)",
  "function totalBorrowed(address) view returns (uint256)"
]);

async function main() {
  const [lendingCode, swapCode, usdcCode, eurcCode] = await Promise.all([
    client.getBytecode({ address: lending }),
    client.getBytecode({ address: swap }),
    client.getBytecode({ address: usdc }),
    client.getBytecode({ address: eurc })
  ]);

  console.log("bytecode", {
    lending: Boolean(lendingCode),
    swap: Boolean(swapCode),
    usdc: Boolean(usdcCode),
    eurc: Boolean(eurcCode)
  });

  const [usdcSymbol, eurcSymbol, usdcDecimals, eurcDecimals] = await Promise.all([
    client.readContract({ address: usdc, abi: erc20, functionName: "symbol" }),
    client.readContract({ address: eurc, abi: erc20, functionName: "symbol" }),
    client.readContract({ address: usdc, abi: erc20, functionName: "decimals" }),
    client.readContract({ address: eurc, abi: erc20, functionName: "decimals" })
  ]);

  console.log("tokens", { usdcSymbol, eurcSymbol, usdcDecimals, eurcDecimals });

  const [swapUsdc, swapEurc, feeBps, lpDecimals, lpTotalSupply, swapUsdcBalance, swapEurcBalance] = await Promise.all([
    client.readContract({ address: swap, abi: stable, functionName: "usdc" }),
    client.readContract({ address: swap, abi: stable, functionName: "eurc" }),
    client.readContract({ address: swap, abi: stable, functionName: "FEE_BPS" }),
    client.readContract({ address: swap, abi: stable, functionName: "decimals" }),
    client.readContract({ address: swap, abi: stable, functionName: "totalSupply" }),
    client.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [swap] }),
    client.readContract({ address: eurc, abi: erc20, functionName: "balanceOf", args: [swap] })
  ]);

  console.log("swap", {
    usdc: swapUsdc,
    eurc: swapEurc,
    feeBps: feeBps.toString(),
    lpDecimals,
    lpTotalSupply: lpTotalSupply.toString(),
    usdcBalance: formatUnits(swapUsdcBalance, 6),
    eurcBalance: formatUnits(swapEurcBalance, 6)
  });

  if (swapUsdcBalance > 0n && swapEurcBalance > 0n) {
    const [quoteOut, quoteAmount] = await client.readContract({ address: swap, abi: stable, functionName: "quote", args: [usdc, 1_000_000n] });
    console.log("quote 1 USDC", { tokenOut: quoteOut, amountOut: formatUnits(quoteAmount, 6) });
  } else {
    console.log("quote 1 USDC", "skipped: pool needs initial USDC and EURC liquidity");
  }

  let expiryProtection = false;
  try {
    await client.simulateContract({ address: swap, abi: stable, functionName: "swap", args: [usdc, 1_000_000n, 0n, 1n], account: readinessAccount });
  } catch (error) {
    expiryProtection = String(error).includes("EXPIRED");
  }
  if (!expiryProtection) throw new Error("Deployed pool expiry protection was not detected.");
  console.log("swap protections", { expiryProtection });

  const [owner, ltv, liqThreshold, liqBonus, usdcListed, eurcListed, usdcAssetDecimals, eurcAssetDecimals, usdcPrice, eurcPrice, usdcSupply, eurcSupply, usdcBorrowed, eurcBorrowed, lendingUsdcBalance, lendingEurcBalance] = await Promise.all([
    client.readContract({ address: lending, abi: lend, functionName: "owner" }),
    client.readContract({ address: lending, abi: lend, functionName: "LTV_BPS" }),
    client.readContract({ address: lending, abi: lend, functionName: "LIQUIDATION_THRESHOLD_BPS" }),
    client.readContract({ address: lending, abi: lend, functionName: "LIQUIDATION_BONUS_BPS" }),
    client.readContract({ address: lending, abi: lend, functionName: "isAsset", args: [usdc] }),
    client.readContract({ address: lending, abi: lend, functionName: "isAsset", args: [eurc] }),
    client.readContract({ address: lending, abi: lend, functionName: "assetDecimals", args: [usdc] }),
    client.readContract({ address: lending, abi: lend, functionName: "assetDecimals", args: [eurc] }),
    client.readContract({ address: lending, abi: lend, functionName: "priceUsd", args: [usdc] }),
    client.readContract({ address: lending, abi: lend, functionName: "priceUsd", args: [eurc] }),
    client.readContract({ address: lending, abi: lend, functionName: "totalSupplied", args: [usdc] }),
    client.readContract({ address: lending, abi: lend, functionName: "totalSupplied", args: [eurc] }),
    client.readContract({ address: lending, abi: lend, functionName: "totalBorrowed", args: [usdc] }),
    client.readContract({ address: lending, abi: lend, functionName: "totalBorrowed", args: [eurc] }),
    client.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [lending] }),
    client.readContract({ address: eurc, abi: erc20, functionName: "balanceOf", args: [lending] })
  ]);

  console.log("lending", {
    owner,
    ltv: ltv.toString(),
    liqThreshold: liqThreshold.toString(),
    liqBonus: liqBonus.toString(),
    usdcListed,
    eurcListed,
    usdcAssetDecimals,
    eurcAssetDecimals,
    usdcPrice: usdcPrice.toString(),
    eurcPrice: eurcPrice.toString(),
    usdcSupply: formatUnits(usdcSupply, 6),
    eurcSupply: formatUnits(eurcSupply, 6),
    usdcBorrowed: formatUnits(usdcBorrowed, 6),
    eurcBorrowed: formatUnits(eurcBorrowed, 6),
    lendingUsdcBalance: formatUnits(lendingUsdcBalance, 6),
    lendingEurcBalance: formatUnits(lendingEurcBalance, 6)
  });

  const approveData = encodeFunctionData({
    abi: erc20,
    functionName: "approve",
    args: [lending, 1_000_000n]
  });
  const [gasEstimate, feeEstimate, nativeGasBalance] = await Promise.all([
    client.estimateGas({ account: owner, to: usdc, data: approveData }),
    client.estimateFeesPerGas({ type: "eip1559" }),
    client.getBalance({ address: owner })
  ]);
  const bufferedGas = (gasEstimate * 125n + 99n) / 100n;
  const maxFeePerGas = feeEstimate.maxFeePerGas > parseGwei("30") ? feeEstimate.maxFeePerGas : parseGwei("30");

  console.log("transaction preflight", {
    gasEstimate: gasEstimate.toString(),
    bufferedGas: bufferedGas.toString(),
    maxFeeGwei: formatUnits(maxFeePerGas, 9),
    priorityFeeGwei: formatUnits(feeEstimate.maxPriorityFeePerGas, 9),
    maximumFeeUsdc: formatUnits(bufferedGas * maxFeePerGas, 18),
    nativeGasBalanceUsdc: formatUnits(nativeGasBalance, 18)
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


