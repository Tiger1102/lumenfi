import hardhatToolboxViem from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable } from "hardhat/config";
import type { HardhatUserConfig } from "hardhat/config";
import { loadEnvFile } from "node:process";

loadEnvFile(".env");

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxViem],
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    arcTestnet: {
      type: "http",
      chainType: "l1",
      url: "https://rpc.testnet.arc.network",
      accounts: [configVariable("ARC_TESTNET_PRIVATE_KEY")]
    }
  }
};

export default config;
