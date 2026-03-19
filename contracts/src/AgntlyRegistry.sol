// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AgntlyRegistry
 * @notice On-chain agent registry. Stores agent ID → wallet address mappings
 *         immutably. Records cumulative earnings, task count, and verification
 *         status. Source of truth for agent identity.
 */
contract AgntlyRegistry is Ownable {

    // --- Types ---
    struct AgentRecord {
        address wallet;
        address owner;
        uint256 pricePerCall;  // in USDC smallest unit (6 decimals)
        string endpoint;
        bool verified;
        bool active;
        uint256 totalEarned;
        uint256 taskCount;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    // --- State ---
    mapping(bytes32 => AgentRecord) public agents;
    mapping(address => bytes32[]) public ownerAgents;
    bytes32[] public allAgentIds;

    uint256 public totalAgents;
    uint256 public verifiedAgents;
    uint256 public listingDeposit = 5 * 1e6; // $5 USDC (6 decimals)

    // --- Events ---
    event AgentRegistered(bytes32 indexed agentId, address indexed wallet, address indexed owner, uint256 pricePerCall);
    event AgentUpdated(bytes32 indexed agentId, uint256 pricePerCall, string endpoint);
    event AgentVerified(bytes32 indexed agentId);
    event AgentUnverified(bytes32 indexed agentId);
    event AgentDelisted(bytes32 indexed agentId);
    event AgentReactivated(bytes32 indexed agentId);
    event TaskSettled(bytes32 indexed agentId, uint256 amount, uint256 newTotal);

    // --- Errors ---
    error AgentAlreadyExists();
    error AgentNotFound();
    error NotAgentOwner();
    error AgentInactive();
    error InvalidPrice();

    constructor() Ownable(msg.sender) {}

    // --- Core Functions ---

    /**
     * @notice Register a new agent on the marketplace.
     * @param agentId Unique agent identifier (hashed from string ID)
     * @param wallet Agent's wallet address for receiving payments
     * @param pricePerCall Price per task in USDC smallest unit
     * @param endpoint Agent's HTTP endpoint URL
     */
    function registerAgent(
        bytes32 agentId,
        address wallet,
        uint256 pricePerCall,
        string calldata endpoint
    ) external {
        if (agents[agentId].registeredAt != 0) revert AgentAlreadyExists();
        if (pricePerCall == 0) revert InvalidPrice();

        agents[agentId] = AgentRecord({
            wallet: wallet,
            owner: msg.sender,
            pricePerCall: pricePerCall,
            endpoint: endpoint,
            verified: false,
            active: true,
            totalEarned: 0,
            taskCount: 0,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });

        ownerAgents[msg.sender].push(agentId);
        allAgentIds.push(agentId);
        totalAgents++;

        emit AgentRegistered(agentId, wallet, msg.sender, pricePerCall);
    }

    /**
     * @notice Update agent price and endpoint. Only the agent owner can call.
     * @param agentId The agent to update
     * @param pricePerCall New price per call
     * @param endpoint New endpoint URL
     */
    function updateAgent(
        bytes32 agentId,
        uint256 pricePerCall,
        string calldata endpoint
    ) external {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();
        if (pricePerCall == 0) revert InvalidPrice();

        agent.pricePerCall = pricePerCall;
        agent.endpoint = endpoint;
        agent.updatedAt = block.timestamp;

        emit AgentUpdated(agentId, pricePerCall, endpoint);
    }

    /**
     * @notice Record a settled task for an agent. Called by escrow contract or admin.
     * @param agentId The agent that completed the task
     * @param amount USDC amount earned (net of fees)
     */
    function recordSettlement(bytes32 agentId, uint256 amount) external onlyOwner {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();

        agent.totalEarned += amount;
        agent.taskCount++;

        emit TaskSettled(agentId, amount, agent.totalEarned);
    }

    /**
     * @notice Verify an agent. Only admin can verify after manual audit.
     */
    function verifyAgent(bytes32 agentId) external onlyOwner {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (!agent.verified) {
            agent.verified = true;
            verifiedAgents++;
            emit AgentVerified(agentId);
        }
    }

    /**
     * @notice Remove verification badge.
     */
    function unverifyAgent(bytes32 agentId) external onlyOwner {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.verified) {
            agent.verified = false;
            verifiedAgents--;
            emit AgentUnverified(agentId);
        }
    }

    /**
     * @notice Delist an agent. Can be called by owner or admin.
     */
    function delistAgent(bytes32 agentId) external {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.owner != msg.sender && msg.sender != owner()) revert NotAgentOwner();

        agent.active = false;
        totalAgents--;

        emit AgentDelisted(agentId);
    }

    /**
     * @notice Reactivate a delisted agent. Only the agent owner.
     */
    function reactivateAgent(bytes32 agentId) external {
        AgentRecord storage agent = agents[agentId];
        if (agent.registeredAt == 0) revert AgentNotFound();
        if (agent.owner != msg.sender) revert NotAgentOwner();

        agent.active = true;
        totalAgents++;

        emit AgentReactivated(agentId);
    }

    // --- View Functions ---

    function getAgent(bytes32 agentId) external view returns (AgentRecord memory) {
        return agents[agentId];
    }

    function isVerified(bytes32 agentId) external view returns (bool) {
        return agents[agentId].verified;
    }

    function isActive(bytes32 agentId) external view returns (bool) {
        return agents[agentId].active;
    }

    function getOwnerAgents(address ownerAddr) external view returns (bytes32[] memory) {
        return ownerAgents[ownerAddr];
    }

    function getAllAgentIds() external view returns (bytes32[] memory) {
        return allAgentIds;
    }
}
