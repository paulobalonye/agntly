import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { AgntlyEscrow, MockUSDC } from "../typechain-types";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Parse amount in USDC (6 decimals) */
const usdc = (amount: string) => ethers.parseUnits(amount, 6);

/** Extract escrowId from the EscrowLocked event of a lockEscrow tx */
async function getEscrowId(escrow: AgntlyEscrow, tx: any): Promise<string> {
  const receipt = await tx.wait();
  const event = receipt?.logs.find((log: any) => {
    try { return escrow.interface.parseLog(log)?.name === "EscrowLocked"; }
    catch { return false; }
  });
  const parsed = escrow.interface.parseLog(event as any);
  return parsed?.args[0] as string;
}

// ── Fixture ───────────────────────────────────────────────────────────────────

async function deployFixture() {
  const [owner, orchestrator, agent, feeCollector, stranger] = await ethers.getSigners();

  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const token = (await MockUSDC.deploy()) as unknown as MockUSDC;

  const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
  const escrow = (await AgntlyEscrow.deploy(
    await token.getAddress(),
    feeCollector.address,
  )) as unknown as AgntlyEscrow;

  // Fund orchestrator with 10,000 USDC and approve the escrow contract
  await token.mint(orchestrator.address, usdc("10000"));
  await token.connect(orchestrator).approve(await escrow.getAddress(), usdc("10000"));

  const taskId = ethers.id("task-001");
  const amount = usdc("1"); // $1.00

  return { token, escrow, owner, orchestrator, agent, feeCollector, stranger, taskId, amount };
}

// ─────────────────────────────────────────────────────────────────────────────

describe("AgntlyEscrow", function () {

  // ── constructor ─────────────────────────────────────────────────────────────

  describe("constructor", function () {
    it("sets the USDC address", async function () {
      const { token, escrow } = await loadFixture(deployFixture);
      expect(await escrow.usdc()).to.equal(await token.getAddress());
    });

    it("sets the feeCollector address", async function () {
      const { escrow, feeCollector } = await loadFixture(deployFixture);
      expect(await escrow.feeCollector()).to.equal(feeCollector.address);
    });

    it("sets feeBps to 300 (3%)", async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.feeBps()).to.equal(300n);
    });

    it("reverts if USDC address is zero", async function () {
      const { feeCollector } = await loadFixture(deployFixture);
      const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
      await expect(
        AgntlyEscrow.deploy(ethers.ZeroAddress, feeCollector.address),
      ).to.be.revertedWithCustomError({ interface: (await AgntlyEscrow.deploy(await (await (await ethers.getContractFactory("MockUSDC")).deploy()).getAddress(), feeCollector.address)).interface } as any, "InvalidAddress");
    });

    it("reverts if feeCollector address is zero", async function () {
      const { token } = await loadFixture(deployFixture);
      const AgntlyEscrow = await ethers.getContractFactory("AgntlyEscrow");
      await expect(
        AgntlyEscrow.deploy(await token.getAddress(), ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(await AgntlyEscrow.deploy(await token.getAddress(), (await ethers.getSigners())[1].address) as any, "InvalidAddress");
    });
  });

  // ── lockEscrow ───────────────────────────────────────────────────────────────

  describe("lockEscrow", function () {
    it("transfers USDC from orchestrator to the contract", async function () {
      const { token, escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const before = await token.balanceOf(orchestrator.address);
      await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const after = await token.balanceOf(orchestrator.address);

      expect(before - after).to.equal(amount);
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);
    });

    it("emits EscrowLocked with correct args", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const tx = escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      await expect(tx)
        .to.emit(escrow, "EscrowLocked")
        .withArgs(
          (_: any) => true, // escrowId — just verify it exists
          taskId,
          orchestrator.address,
          agent.address,
          amount,
          (_: any) => true, // deadline — block.timestamp + 3600
        );
    });

    it("stores correct EscrowRecord fields", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      const record = await escrow.getEscrow(escrowId);

      expect(record.taskId).to.equal(taskId);
      expect(record.orchestrator).to.equal(orchestrator.address);
      expect(record.agent).to.equal(agent.address);
      expect(record.amount).to.equal(amount);
      expect(record.fee).to.equal((amount * 300n) / 10000n);
      expect(record.state).to.equal(1n); // State.Locked = 1
    });

    it("increments totalEscrowed", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      expect(await escrow.totalEscrowed()).to.equal(amount);
    });

    it("reverts with zero amount", async function () {
      const { escrow, orchestrator, agent, taskId } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(orchestrator).lockEscrow(taskId, agent.address, 0, 3600),
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("reverts with zero agent address", async function () {
      const { escrow, orchestrator, taskId, amount } = await loadFixture(deployFixture);
      await expect(
        escrow.connect(orchestrator).lockEscrow(taskId, ethers.ZeroAddress, amount, 3600),
      ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts when paused", async function () {
      const { escrow, owner, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      await escrow.connect(owner).pause();
      await expect(
        escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600),
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("generates unique escrowIds even in the same block for identical inputs", async function () {
      // RED test: proves the block.timestamp collision bug.
      // With the current contract this test will fail because two locks in the same block
      // with the same taskId+orchestrator+agent produce the same escrowId, causing InvalidState.
      // Fix: replace block.timestamp with ++_nonce in the escrowId hash.
      const { escrow, token, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);

      // Mint extra to cover second lock
      await token.mint(orchestrator.address, amount);
      await token.connect(orchestrator).approve(await escrow.getAddress(), amount * 2n);

      // Disable automining so both txs land in the same block
      await ethers.provider.send("evm_setAutomine", [false]);

      const tx1 = escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const tx2 = escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);

      // Mine both in one block
      await ethers.provider.send("evm_mine", []);

      // Re-enable automining
      await ethers.provider.send("evm_setAutomine", [true]);

      // Both should succeed (no revert)
      const [r1, r2] = await Promise.all([(await tx1).wait(), (await tx2).wait()]);
      expect(r1?.status).to.equal(1);
      expect(r2?.status).to.equal(1);
    });
  });

  // ── releaseEscrow ────────────────────────────────────────────────────────────

  describe("releaseEscrow", function () {
    async function lockedFixture() {
      const base = await deployFixture();
      const { escrow, orchestrator, agent, taskId, amount } = base;
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      return { ...base, escrowId };
    }

    it("sends 97% to the agent", async function () {
      const { token, escrow, orchestrator, agent, amount, escrowId } = await loadFixture(lockedFixture);
      const net = amount - (amount * 300n) / 10000n;
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result"));
      expect(await token.balanceOf(agent.address)).to.equal(net);
    });

    it("sends 3% to the feeCollector", async function () {
      const { token, escrow, orchestrator, feeCollector, amount, escrowId } = await loadFixture(lockedFixture);
      const fee = (amount * 300n) / 10000n;
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result"));
      expect(await token.balanceOf(feeCollector.address)).to.equal(fee);
    });

    it("sets state to Released (2)", async function () {
      const { escrow, orchestrator, escrowId } = await loadFixture(lockedFixture);
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result"));
      expect(await escrow.getEscrowState(escrowId)).to.equal(2n); // Released
    });

    it("emits EscrowReleased", async function () {
      const { escrow, orchestrator, agent, amount, escrowId } = await loadFixture(lockedFixture);
      const net = amount - (amount * 300n) / 10000n;
      const fee = (amount * 300n) / 10000n;
      await expect(escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result")))
        .to.emit(escrow, "EscrowReleased")
        .withArgs(escrowId, (_: any) => true, agent.address, net, fee);
    });

    it("increments totalSettled and totalFees", async function () {
      const { escrow, orchestrator, amount, escrowId } = await loadFixture(lockedFixture);
      const net = amount - (amount * 300n) / 10000n;
      const fee = (amount * 300n) / 10000n;
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result"));
      expect(await escrow.totalSettled()).to.equal(net);
      expect(await escrow.totalFees()).to.equal(fee);
    });

    it("owner (relayer) can release without being orchestrator", async function () {
      const { escrow, owner, amount, escrowId, token, agent } = await loadFixture(lockedFixture);
      const net = amount - (amount * 300n) / 10000n;
      await escrow.connect(owner).releaseEscrow(escrowId, ethers.id("result"));
      expect(await token.balanceOf(agent.address)).to.equal(net);
    });

    it("stranger cannot release", async function () {
      const { escrow, stranger, escrowId } = await loadFixture(lockedFixture);
      await expect(
        escrow.connect(stranger).releaseEscrow(escrowId, ethers.id("result")),
      ).to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts on double-release", async function () {
      const { escrow, orchestrator, escrowId } = await loadFixture(lockedFixture);
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result"));
      await expect(
        escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("result")),
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  // ── refundEscrow ─────────────────────────────────────────────────────────────

  describe("refundEscrow", function () {
    async function expiredFixture() {
      const base = await deployFixture();
      const { escrow, orchestrator, agent, taskId, amount } = base;
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 1);
      const escrowId = await getEscrowId(escrow, tx);
      // Advance past the 1-second deadline
      await time.increase(2);
      return { ...base, escrowId };
    }

    it("returns full amount to orchestrator after deadline", async function () {
      const { token, escrow, orchestrator, amount, escrowId } = await loadFixture(expiredFixture);
      const before = await token.balanceOf(orchestrator.address);
      await escrow.refundEscrow(escrowId);
      expect(await token.balanceOf(orchestrator.address) - before).to.equal(amount);
    });

    it("sets state to Refunded (3)", async function () {
      const { escrow, escrowId } = await loadFixture(expiredFixture);
      await escrow.refundEscrow(escrowId);
      expect(await escrow.getEscrowState(escrowId)).to.equal(3n);
    });

    it("emits EscrowRefunded", async function () {
      const { escrow, orchestrator, amount, escrowId } = await loadFixture(expiredFixture);
      await expect(escrow.refundEscrow(escrowId))
        .to.emit(escrow, "EscrowRefunded")
        .withArgs(escrowId, (_: any) => true, orchestrator.address, amount);
    });

    it("reverts if called before deadline", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      await expect(escrow.refundEscrow(escrowId)).to.be.revertedWithCustomError(escrow, "DeadlineNotReached");
    });

    it("anyone can trigger a refund after deadline", async function () {
      const { escrow, stranger, escrowId } = await loadFixture(expiredFixture);
      // Should not revert — permissionless after deadline
      await expect(escrow.connect(stranger).refundEscrow(escrowId)).to.not.be.reverted;
    });
  });

  // ── disputeEscrow ────────────────────────────────────────────────────────────

  describe("disputeEscrow", function () {
    async function lockedFixture() {
      const base = await deployFixture();
      const { escrow, orchestrator, agent, taskId, amount } = base;
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      return { ...base, escrowId };
    }

    it("sets state to Disputed (4)", async function () {
      const { escrow, orchestrator, escrowId } = await loadFixture(lockedFixture);
      await escrow.connect(orchestrator).disputeEscrow(escrowId);
      expect(await escrow.getEscrowState(escrowId)).to.equal(4n);
    });

    it("emits DisputeOpened", async function () {
      const { escrow, orchestrator, escrowId } = await loadFixture(lockedFixture);
      await expect(escrow.connect(orchestrator).disputeEscrow(escrowId))
        .to.emit(escrow, "DisputeOpened")
        .withArgs(escrowId, (_: any) => true, orchestrator.address);
    });

    it("reverts if non-orchestrator calls", async function () {
      const { escrow, stranger, escrowId } = await loadFixture(lockedFixture);
      await expect(escrow.connect(stranger).disputeEscrow(escrowId))
        .to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts if deadline has already passed", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 1);
      const escrowId = await getEscrowId(escrow, tx);
      await time.increase(2);
      await expect(escrow.connect(orchestrator).disputeEscrow(escrowId))
        .to.be.revertedWithCustomError(escrow, "DeadlineReached");
    });

    it("reverts if state is not Locked", async function () {
      const { escrow, orchestrator, escrowId } = await loadFixture(lockedFixture);
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("r"));
      await expect(escrow.connect(orchestrator).disputeEscrow(escrowId))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  // ── resolveDispute ───────────────────────────────────────────────────────────

  describe("resolveDispute", function () {
    async function disputedFixture() {
      const base = await deployFixture();
      const { escrow, orchestrator, agent, taskId, amount } = base;
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      await escrow.connect(orchestrator).disputeEscrow(escrowId);
      return { ...base, escrowId };
    }

    it("resolves in agent's favour: sends net to agent and fee to feeCollector", async function () {
      const { token, escrow, owner, agent, feeCollector, amount, escrowId } = await loadFixture(disputedFixture);
      const net = amount - (amount * 300n) / 10000n;
      const fee = (amount * 300n) / 10000n;
      await escrow.connect(owner).resolveDispute(escrowId, agent.address);
      expect(await token.balanceOf(agent.address)).to.equal(net);
      expect(await token.balanceOf(feeCollector.address)).to.equal(fee);
    });

    it("resolves in orchestrator's favour: full refund, no fee", async function () {
      const { token, escrow, owner, orchestrator, amount, escrowId } = await loadFixture(disputedFixture);
      const before = await token.balanceOf(orchestrator.address);
      await escrow.connect(owner).resolveDispute(escrowId, orchestrator.address);
      expect(await token.balanceOf(orchestrator.address) - before).to.equal(amount);
    });

    it("emits DisputeResolved", async function () {
      const { escrow, owner, agent, amount, escrowId } = await loadFixture(disputedFixture);
      await expect(escrow.connect(owner).resolveDispute(escrowId, agent.address))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(escrowId, (_: any) => true, agent.address, amount);
    });

    it("reverts if called by non-owner", async function () {
      const { escrow, stranger, agent, escrowId } = await loadFixture(disputedFixture);
      await expect(escrow.connect(stranger).resolveDispute(escrowId, agent.address))
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("reverts with an invalid winner address", async function () {
      const { escrow, owner, stranger, escrowId } = await loadFixture(disputedFixture);
      await expect(escrow.connect(owner).resolveDispute(escrowId, stranger.address))
        .to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });

    it("reverts if state is not Disputed", async function () {
      const { escrow, owner, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      // Still Locked, not Disputed
      await expect(escrow.connect(owner).resolveDispute(escrowId, agent.address))
        .to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  // ── setFeeBps ────────────────────────────────────────────────────────────────

  describe("setFeeBps", function () {
    it("updates feeBps", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await escrow.connect(owner).setFeeBps(500);
      expect(await escrow.feeBps()).to.equal(500n);
    });

    it("emits FeeBpsUpdated", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setFeeBps(500))
        .to.emit(escrow, "FeeBpsUpdated")
        .withArgs(300n, 500n);
    });

    it("reverts if fee exceeds 10% (1000 bps)", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setFeeBps(1001))
        .to.be.revertedWith("Fee cannot exceed 10%");
    });

    it("reverts if called by non-owner", async function () {
      const { escrow, stranger } = await loadFixture(deployFixture);
      await expect(escrow.connect(stranger).setFeeBps(500))
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });

    it("new feeBps is applied to subsequent locks", async function () {
      const { token, escrow, owner, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      await escrow.connect(owner).setFeeBps(500); // 5%
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      const record = await escrow.getEscrow(escrowId);
      expect(record.fee).to.equal((amount * 500n) / 10000n);
    });
  });

  // ── setFeeCollector ──────────────────────────────────────────────────────────

  describe("setFeeCollector", function () {
    it("updates feeCollector address", async function () {
      const { escrow, owner, stranger } = await loadFixture(deployFixture);
      await escrow.connect(owner).setFeeCollector(stranger.address);
      expect(await escrow.feeCollector()).to.equal(stranger.address);
    });

    it("emits FeeCollectorUpdated", async function () {
      const { escrow, owner, feeCollector, stranger } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setFeeCollector(stranger.address))
        .to.emit(escrow, "FeeCollectorUpdated")
        .withArgs(feeCollector.address, stranger.address);
    });

    it("reverts with zero address", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setFeeCollector(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(escrow, "InvalidAddress");
    });
  });

  // ── pause / unpause ──────────────────────────────────────────────────────────

  describe("pause / unpause", function () {
    it("owner can pause and unpause", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await escrow.connect(owner).pause();
      expect(await escrow.paused()).to.be.true;
      await escrow.connect(owner).unpause();
      expect(await escrow.paused()).to.be.false;
    });

    it("lockEscrow reverts when paused", async function () {
      const { escrow, owner, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      await escrow.connect(owner).pause();
      await expect(
        escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600),
      ).to.be.revertedWithCustomError(escrow, "EnforcedPause");
    });

    it("releaseEscrow still works when paused (settlements must proceed)", async function () {
      const { escrow, owner, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      await escrow.connect(owner).pause();
      // releaseEscrow does NOT use whenNotPaused — settlements must always proceed
      await expect(escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("r"))).to.not.be.reverted;
    });

    it("stranger cannot pause", async function () {
      const { escrow, stranger } = await loadFixture(deployFixture);
      await expect(escrow.connect(stranger).pause())
        .to.be.revertedWithCustomError(escrow, "OwnableUnauthorizedAccount");
    });
  });

  // ── getEscrowState ───────────────────────────────────────────────────────────

  describe("getEscrowState", function () {
    it("returns None (0) for an unknown escrowId", async function () {
      const { escrow } = await loadFixture(deployFixture);
      expect(await escrow.getEscrowState(ethers.id("nonexistent"))).to.equal(0n);
    });

    it("reflects state through the full lifecycle: Locked → Released", async function () {
      const { escrow, orchestrator, agent, taskId, amount } = await loadFixture(deployFixture);
      const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, amount, 3600);
      const escrowId = await getEscrowId(escrow, tx);
      expect(await escrow.getEscrowState(escrowId)).to.equal(1n); // Locked
      await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("r"));
      expect(await escrow.getEscrowState(escrowId)).to.equal(2n); // Released
    });
  });

  // ── fee math precision ───────────────────────────────────────────────────────

  describe("fee math precision", function () {
    const cases: [string, string][] = [
      ["0.001", "0.000030"],   // $0.001 → fee = 0 (floor) — verify no revert
      ["0.01",  "0.000300"],   // $0.01
      ["1",     "0.030000"],   // $1
      ["100",   "3.000000"],   // $100
      ["9999",  "299.970000"], // $9,999
    ];

    for (const [inputUsd, feeUsd] of cases) {
      it(`$${inputUsd} locks correctly, fee = $${feeUsd}`, async function () {
        const { token, escrow, orchestrator, agent, feeCollector } = await loadFixture(deployFixture);

        // Top up orchestrator for big amounts
        const lockAmount = usdc(inputUsd);
        await token.mint(orchestrator.address, lockAmount);
        await token.connect(orchestrator).approve(await escrow.getAddress(), lockAmount);

        const taskId = ethers.id(`task-${inputUsd}`);
        const tx = await escrow.connect(orchestrator).lockEscrow(taskId, agent.address, lockAmount, 3600);
        const escrowId = await getEscrowId(escrow, tx);

        await escrow.connect(orchestrator).releaseEscrow(escrowId, ethers.id("r"));

        const expectedFee = (lockAmount * 300n) / 10000n;
        const expectedNet = lockAmount - expectedFee;

        expect(await token.balanceOf(agent.address)).to.equal(expectedNet);
        expect(await token.balanceOf(feeCollector.address)).to.equal(expectedFee);

        // No USDC destroyed: net + fee === original amount
        expect(expectedNet + expectedFee).to.equal(lockAmount);
      });
    }
  });
});
