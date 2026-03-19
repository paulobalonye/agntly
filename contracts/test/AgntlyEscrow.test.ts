import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("AgntlyEscrow", function () {
  async function deployFixture() {
    const [owner, orchestrator, agent, feeCollector] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
    const escrow = await AgntlyEscrow.deploy(await usdc.getAddress(), feeCollector.address);

    // Mint USDC to orchestrator
    await usdc.mint(orchestrator.address, ethers.parseUnits("1000", 6));
    // Approve escrow
    await usdc.connect(orchestrator).approve(await escrow.getAddress(), ethers.parseUnits("1000", 6));

    const taskId = ethers.id("task-001");
    const amount = ethers.parseUnits("0.002", 6); // 2000 units = $0.002

    return { usdc, escrow, owner, orchestrator, agent, feeCollector, taskId, amount };
  }

  describe("lockEscrow", function () {
    it("should lock USDC in escrow", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 30);
      const receipt = await tx.wait();

      expect(receipt).to.not.be.null;
    });

    it("should emit EscrowLocked event", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      await expect(escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 30))
        .to.emit(escrow, "EscrowLocked");
    });

    it("should transfer USDC from orchestrator to contract", async function () {
      const { usdc, escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const balanceBefore = await usdc.balanceOf(orchestrator.address);
      await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 30);
      const balanceAfter = await usdc.balanceOf(orchestrator.address);

      expect(balanceBefore - balanceAfter).to.equal(amount);
    });

    it("should revert with zero amount", async function () {
      const { escrow, orchestrator, agent, taskId } = await loadFixture(deployFixture);

      await expect(escrow.connect(orchestrator).lockEscrow(taskId, agent.address, 0, 30))
        .to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });
  });

  describe("releaseEscrow", function () {
    it("should release funds to agent minus fee", async function () {
      const { usdc, escrow, orchestrator, agent, feeCollector, taskId, amount } = await loadFixture(deployFixture);

      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 30);
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try { return escrow.interface.parseLog(log)?.name === "EscrowLocked"; } catch { return false; }
      });
      const parsed = escrow.interface.parseLog(event as any);
      const escrowId = parsed?.args[0];

      const resultHash = ethers.id("result-data");
      await escrow.connect(orchestrator).releaseEscrow(escrowId, resultHash);

      // Agent should get 97% (3% fee)
      const fee = (amount * 300n) / 10000n;
      const net = amount - fee;
      expect(await usdc.balanceOf(agent.address)).to.equal(net);
      expect(await usdc.balanceOf(feeCollector.address)).to.equal(fee);
    });
  });

  describe("refundEscrow", function () {
    it("should refund after deadline", async function () {
      const { usdc, escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 1); // 1 second timeout
      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try { return escrow.interface.parseLog(log)?.name === "EscrowLocked"; } catch { return false; }
      });
      const parsed = escrow.interface.parseLog(event as any);
      const escrowId = parsed?.args[0];

      // Wait for deadline
      await ethers.provider.send("evm_increaseTime", [2]);
      await ethers.provider.send("evm_mine", []);

      const balanceBefore = await usdc.balanceOf(orchestrator.address);
      await escrow.refundEscrow(escrowId);
      const balanceAfter = await usdc.balanceOf(orchestrator.address);

      expect(balanceAfter - balanceBefore).to.equal(amount);
    });
  });
});
