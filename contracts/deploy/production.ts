/**
 * Production deploy — Base mainnet
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run deploy/production.ts --network baseMainnet
 *
 * USDC on Base mainnet (Circle's official mainnet USDC):
 *   0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
 *
 * IMPORTANT: Before running —
 *   1. Set FEE_COLLECTOR_ADDRESS to a hardware-wallet or multisig address
 *   2. Verify PRIVATE_KEY has sufficient ETH for gas
 *   3. Double-check the USDC address against https://developers.circle.com/stablecoins/docs/usdc-on-main-networks
 */
import { ethers } from "hardhat";

const USDC_BASE_MAINNET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== Agntly Production Deploy (Base Mainnet) ===");
  console.log("Network:  ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  if (network.chainId !== 8453n) {
    throw new Error(`Wrong network — expected Base mainnet (8453), got ${network.chainId}`);
  }

  const feeCollector = process.env.FEE_COLLECTOR_ADDRESS ?? deployer.address;
  if (feeCollector === deployer.address) {
    console.warn("\n⚠  WARNING: FEE_COLLECTOR_ADDRESS not set — fees will go to deployer address.");
    console.warn("   Set FEE_COLLECTOR_ADDRESS to a multisig before production launch.\n");
  }

  // 1. AgntlyEscrow
  console.log("[1/3] Deploying AgntlyEscrow ...");
  const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
  const escrow = await AgntlyEscrow.deploy(USDC_BASE_MAINNET, feeCollector);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("AgntlyEscrow:", escrowAddr);

  // 2. AgntlyWalletFactory
  console.log("\n[2/3] Deploying AgntlyWalletFactory ...");
  const AgntlyWalletFactory = await ethers.getContractFactory("AgntlyWalletFactory");
  const walletFactory = await AgntlyWalletFactory.deploy(USDC_BASE_MAINNET, escrowAddr);
  await walletFactory.waitForDeployment();
  const walletFactoryAddr = await walletFactory.getAddress();
  console.log("AgntlyWalletFactory:", walletFactoryAddr);

  // 3. AgntlyRegistry
  console.log("\n[3/3] Deploying AgntlyRegistry ...");
  const AgntlyRegistry = await ethers.getContractFactory("AgntlyRegistry");
  const registry = await AgntlyRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgntlyRegistry:", registryAddr);

  // Summary
  console.log("\n=== PRODUCTION DEPLOYMENT COMPLETE ===");
  console.log("USDC (mainnet):      ", USDC_BASE_MAINNET);
  console.log("AgntlyEscrow:        ", escrowAddr);
  console.log("AgntlyWalletFactory: ", walletFactoryAddr);
  console.log("AgntlyRegistry:      ", registryAddr);
  console.log("FeeCollector:        ", feeCollector);
  console.log("\nAdd to production VM .env:");
  console.log(`USDC_CONTRACT_ADDRESS=${USDC_BASE_MAINNET}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddr}`);
  console.log(`WALLET_FACTORY_ADDRESS=${walletFactoryAddr}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddr}`);
  console.log(`FEE_COLLECTOR_ADDRESS=${feeCollector}`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
