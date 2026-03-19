import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  // 1. Deploy MockUSDC (testnet only — use real USDC on mainnet)
  console.log("\n--- Deploying MockUSDC ---");
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("MockUSDC:", usdcAddr);

  // Mint 1M USDC to deployer for testing
  await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
  console.log("Minted 1,000,000 USDC to deployer");

  // 2. Deploy AgntlyEscrow
  console.log("\n--- Deploying AgntlyEscrow ---");
  const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
  const escrow = await AgntlyEscrow.deploy(usdcAddr, deployer.address);
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("AgntlyEscrow:", escrowAddr);

  // 3. Deploy AgntlyWalletFactory
  console.log("\n--- Deploying AgntlyWalletFactory ---");
  const AgntlyWalletFactory = await ethers.getContractFactory("AgntlyWalletFactory");
  const walletFactory = await AgntlyWalletFactory.deploy(usdcAddr, escrowAddr);
  await walletFactory.waitForDeployment();
  const walletFactoryAddr = await walletFactory.getAddress();
  console.log("AgntlyWalletFactory:", walletFactoryAddr);

  // 4. Deploy AgntlyRegistry
  console.log("\n--- Deploying AgntlyRegistry ---");
  const AgntlyRegistry = await ethers.getContractFactory("AgntlyRegistry");
  const registry = await AgntlyRegistry.deploy();
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("AgntlyRegistry:", registryAddr);

  // Summary
  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("MockUSDC:           ", usdcAddr);
  console.log("AgntlyEscrow:       ", escrowAddr);
  console.log("AgntlyWalletFactory:", walletFactoryAddr);
  console.log("AgntlyRegistry:     ", registryAddr);
  console.log("\nAdd to .env:");
  console.log(`USDC_ADDRESS=${usdcAddr}`);
  console.log(`ESCROW_CONTRACT_ADDRESS=${escrowAddr}`);
  console.log(`WALLET_FACTORY_ADDRESS=${walletFactoryAddr}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
