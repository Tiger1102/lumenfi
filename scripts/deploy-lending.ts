import hre from "hardhat";

const USDC = "0x3600000000000000000000000000000000000000";
const EURC = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";

async function main() {
  const { viem } = await hre.network.connect();
  const publicClient = await viem.getPublicClient();
  const [walletClient] = await viem.getWalletClients();

  const lendingPool = await viem.deployContract("LendingPool", [
    [USDC, EURC],
    [6, 6],
    [1_000_000n, 1_080_000n]
  ]);

  console.log("Deployer:", walletClient.account.address);
  console.log("LendingPool:", lendingPool.address);
  console.log("Block:", await publicClient.getBlockNumber());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
