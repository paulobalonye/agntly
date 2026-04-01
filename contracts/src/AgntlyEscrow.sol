// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgntlyEscrow
 * @notice Core escrow contract for Agntly. Locks USDC when a task starts,
 *         releases to the agent on completion, refunds on timeout, and
 *         handles disputes. Every state transition emits an event.
 */
contract AgntlyEscrow is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // --- Types ---
    enum State { None, Locked, Released, Refunded, Disputed }

    struct EscrowRecord {
        bytes32 taskId;
        address orchestrator;
        address agent;
        uint256 amount;
        uint256 fee;
        State state;
        uint256 deadline;
        uint256 createdAt;
        uint256 settledAt;
    }

    // --- State ---
    IERC20 public immutable usdc;
    uint256 public feeBps = 300; // 3% = 300 basis points
    address public feeCollector;
    uint256 public totalEscrowed;
    uint256 public totalSettled;
    uint256 public totalFees;
    uint256 private _nonce;

    mapping(bytes32 => EscrowRecord) public escrows;

    // --- Events ---
    event EscrowLocked(bytes32 indexed escrowId, bytes32 indexed taskId, address indexed orchestrator, address agent, uint256 amount, uint256 deadline);
    event EscrowReleased(bytes32 indexed escrowId, bytes32 indexed taskId, address indexed agent, uint256 netAmount, uint256 fee);
    event EscrowRefunded(bytes32 indexed escrowId, bytes32 indexed taskId, address indexed orchestrator, uint256 amount);
    event DisputeOpened(bytes32 indexed escrowId, bytes32 indexed taskId, address indexed opener);
    event DisputeResolved(bytes32 indexed escrowId, bytes32 indexed taskId, address winner, uint256 amount);
    event FeeBpsUpdated(uint256 oldBps, uint256 newBps);
    event FeeCollectorUpdated(address oldCollector, address newCollector);

    // --- Errors ---
    error EscrowNotFound();
    error InvalidState(State current, State expected);
    error InsufficientAllowance();
    error DeadlineNotReached();
    error DeadlineReached();
    error InvalidAmount();
    error InvalidAddress();

    constructor(address _usdc, address _feeCollector) Ownable(msg.sender) {
        if (_usdc == address(0) || _feeCollector == address(0)) revert InvalidAddress();
        usdc = IERC20(_usdc);
        feeCollector = _feeCollector;
    }

    // --- Core Functions ---

    /**
     * @notice Lock USDC in escrow for a task. Orchestrator must have approved this contract.
     * @param taskId Unique task identifier from the task service
     * @param agent Address of the agent's wallet that will receive payment
     * @param amount Total USDC amount (including fee)
     * @param timeoutSeconds How long the agent has to complete the task
     */
    function lockEscrow(
        bytes32 taskId,
        address agent,
        uint256 amount,
        uint256 timeoutSeconds
    ) external nonReentrant whenNotPaused returns (bytes32 escrowId) {
        if (amount == 0) revert InvalidAmount();
        if (agent == address(0)) revert InvalidAddress();

        escrowId = keccak256(abi.encodePacked(taskId, msg.sender, agent, ++_nonce));

        if (escrows[escrowId].state != State.None) revert InvalidState(escrows[escrowId].state, State.None);

        uint256 fee = (amount * feeBps) / 10000;
        uint256 deadline = block.timestamp + timeoutSeconds;

        escrows[escrowId] = EscrowRecord({
            taskId: taskId,
            orchestrator: msg.sender,
            agent: agent,
            amount: amount,
            fee: fee,
            state: State.Locked,
            deadline: deadline,
            createdAt: block.timestamp,
            settledAt: 0
        });

        totalEscrowed += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowLocked(escrowId, taskId, msg.sender, agent, amount, deadline);
    }

    /**
     * @notice Release escrowed funds to agent after task completion.
     *         Only callable by the orchestrator or a trusted relayer (owner).
     * @param escrowId The escrow to release
     * @param resultHash Hash of the task result for on-chain proof
     */
    function releaseEscrow(
        bytes32 escrowId,
        bytes32 resultHash
    ) external nonReentrant {
        EscrowRecord storage escrow = escrows[escrowId];
        if (escrow.state != State.Locked) revert InvalidState(escrow.state, State.Locked);
        if (msg.sender != escrow.orchestrator && msg.sender != owner()) revert InvalidAddress();

        escrow.state = State.Released;
        escrow.settledAt = block.timestamp;

        uint256 netAmount = escrow.amount - escrow.fee;

        totalSettled += netAmount;
        totalFees += escrow.fee;

        usdc.safeTransfer(escrow.agent, netAmount);
        usdc.safeTransfer(feeCollector, escrow.fee);

        emit EscrowReleased(escrowId, escrow.taskId, escrow.agent, netAmount, escrow.fee);
    }

    /**
     * @notice Refund escrowed funds to orchestrator after deadline.
     *         Anyone can call this once the deadline has passed.
     * @param escrowId The escrow to refund
     */
    function refundEscrow(bytes32 escrowId) external nonReentrant {
        EscrowRecord storage escrow = escrows[escrowId];
        if (escrow.state != State.Locked) revert InvalidState(escrow.state, State.Locked);
        if (block.timestamp < escrow.deadline) revert DeadlineNotReached();

        escrow.state = State.Refunded;
        escrow.settledAt = block.timestamp;

        usdc.safeTransfer(escrow.orchestrator, escrow.amount);

        emit EscrowRefunded(escrowId, escrow.taskId, escrow.orchestrator, escrow.amount);
    }

    /**
     * @notice Open a dispute. Freezes the escrow for admin resolution.
     *         Only the orchestrator can dispute before deadline.
     * @param escrowId The escrow to dispute
     */
    function disputeEscrow(bytes32 escrowId) external {
        EscrowRecord storage escrow = escrows[escrowId];
        if (escrow.state != State.Locked) revert InvalidState(escrow.state, State.Locked);
        if (msg.sender != escrow.orchestrator) revert InvalidAddress();
        if (block.timestamp >= escrow.deadline) revert DeadlineReached();

        escrow.state = State.Disputed;

        emit DisputeOpened(escrowId, escrow.taskId, msg.sender);
    }

    /**
     * @notice Resolve a dispute. Admin decides who gets the funds.
     * @param escrowId The disputed escrow
     * @param winner Address to receive the funds (agent or orchestrator)
     */
    function resolveDispute(bytes32 escrowId, address winner) external onlyOwner nonReentrant {
        EscrowRecord storage escrow = escrows[escrowId];
        if (escrow.state != State.Disputed) revert InvalidState(escrow.state, State.Disputed);
        if (winner != escrow.agent && winner != escrow.orchestrator) revert InvalidAddress();

        escrow.settledAt = block.timestamp;

        if (winner == escrow.agent) {
            uint256 netAmount = escrow.amount - escrow.fee;
            escrow.state = State.Released;
            totalSettled += netAmount;
            totalFees += escrow.fee;
            usdc.safeTransfer(escrow.agent, netAmount);
            usdc.safeTransfer(feeCollector, escrow.fee);
        } else {
            escrow.state = State.Refunded;
            usdc.safeTransfer(escrow.orchestrator, escrow.amount);
        }

        emit DisputeResolved(escrowId, escrow.taskId, winner, escrow.amount);
    }

    // --- View Functions ---

    function getEscrow(bytes32 escrowId) external view returns (EscrowRecord memory) {
        return escrows[escrowId];
    }

    function getEscrowState(bytes32 escrowId) external view returns (State) {
        return escrows[escrowId].state;
    }

    // --- Admin Functions ---

    function setFeeBps(uint256 newBps) external onlyOwner {
        require(newBps <= 1000, "Fee cannot exceed 10%");
        emit FeeBpsUpdated(feeBps, newBps);
        feeBps = newBps;
    }

    function setFeeCollector(address newCollector) external onlyOwner {
        if (newCollector == address(0)) revert InvalidAddress();
        emit FeeCollectorUpdated(feeCollector, newCollector);
        feeCollector = newCollector;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
