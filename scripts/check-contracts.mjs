import { createPublicClient, defineChain, http, parseAbi, formatUnits } from "viem";

const arcTestnet = defineChain({ id: 5042002, name: "Arc Testnet", nativeCurrency: { decimals: 18, name: "USDC", symbol: "USDC" }, rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } }, testnet: true });
const client = createPublicClient({ chain: arcTestnet, transport: http("https://rpc.testnet.arc.network") });
const lending = "0x474552ce815a68443bdfcafd089cdb345791d204";
const swap = "0xfd34e43021f20f585db8f078471c7107d8d1da30";
const usdc = "0x3600000000000000000000000000000000000000";
const eurc = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

const erc20 = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)"
]);
const stable = parseAbi([
  "function usdc() view returns (address)",
  "function eurc() view returns (address)",
  "function FEE_BPS() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function quote(address,uint256) view returns (address,uint256)"
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

  const [swapUsdc, swapEurc, feeBps, lpTotalSupply, swapUsdcBalance, swapEurcBalance] = await Promise.all([
    client.readContract({ address: swap, abi: stable, functionName: "usdc" }),
    client.readContract({ address: swap, abi: stable, functionName: "eurc" }),
    client.readContract({ address: swap, abi: stable, functionName: "FEE_BPS" }),
    client.readContract({ address: swap, abi: stable, functionName: "totalSupply" }),
    client.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [swap] }),
    client.readContract({ address: eurc, abi: erc20, functionName: "balanceOf", args: [swap] })
  ]);

  console.log("swap", {
    usdc: swapUsdc,
    eurc: swapEurc,
    feeBps: feeBps.toString(),
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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});


