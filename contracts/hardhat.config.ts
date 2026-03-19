import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC ?? "https://sepolia.base.org",
      chainId: 84532,
      accounts: [PRIVATE_KEY],
    },
    baseMainnet: {
      url: process.env.BASE_RPC_URL ?? "https://mainnet.base.org",
      chainId: 8453,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
