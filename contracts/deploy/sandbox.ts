/**
 * Sandbox deploy — Base Sepolia testnet
 *
 * Usage:
 *   PRIVATE_KEY=0x... npx hardhat run deploy/sandbox.ts --network baseSepolia
 *
 * USDC on Base Sepolia (Circle's official testnet USDC):
 *   0x036CbD53842c5426634e7929541eC2318f3dCF7e
 */
import { ethers } from "hardhat";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=== Agntly Sandbox Deploy (Base Sepolia) ===");
  console.log("Network:  ", network.name, `(chainId ${network.chainId})`);
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  if (network.chainId !== 84532n) {
    throw new Error(`Wrong network — expected Base Sepolia (84532), got ${network.chainId}`);
  }

  // 1. AgntlyEscrow — feeCollector set to deployer; change to a multisig before mainnet
  console.log("\n[1/3] Deploying AgntlyEscrow ...");
  const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
  const escrow = await AgntlyEscrow.deploy(USDC_BASE_SEPOLIA, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("AgntlyEscrow:", escrowAddr);

  // 2. AgntlyWalletFactory
  console.log("\n[2/3] Deploying AgntlyWalletFactory ...");
  const AgntlyWalletFactory = await ethers.getContractFactory("AgntlyWalletFactory");
  const walletFactory = await AgntlyWalletFactory.deploy(USDC_BASE_SEPOLIA, escrowAddr);
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
  console.log("\n=== SANDBOX DEPLOYMENT COMPLETE ===");
  console.log("USDC (testnet):      ", USDC_BASE_SEPOLIA);
  console.log("AgntlyEscrow:        ", escrowAddr);
  console.log("AgntlyWalletFactory: ", walletFactoryAddr);
  console.log("AgntlyRegistry:      ", registryAddr);
  console.log("\nAdd to .env (sandbox VM):");
  console.log(`USDC_CONTRACT_ADDRESS=${USDC_BASE_SEPOLIA}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddr}`);
  console.log(`WALLET_FACTORY_ADDRESS=${walletFactoryAddr}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddr}`);
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
