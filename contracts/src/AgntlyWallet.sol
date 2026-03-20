// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AgntlyWalletFactory
 * @notice Creates lightweight smart wallets for agents. Each wallet is a minimal
 *         proxy that can hold USDC, approve the escrow contract, and withdraw.
 *         In production, this integrates with ERC-4337 via Coinbase AgentKit.
 */
contract AgntlyWalletFactory is Ownable {

    // --- State ---
    mapping(bytes32 => address) public agentWallets;
    mapping(address => bytes32) public walletToAgent;
    address public escrowContract;
    address public usdc;
    uint256 public walletsCreated;

    // --- Events ---
    event WalletCreated(bytes32 indexed agentId, address indexed wallet, address indexed creator);
    event EscrowContractUpdated(address oldEscrow, address newEscrow);

    // --- Errors ---
    error WalletAlreadyExists();
    error WalletNotFound();
    error InvalidAddress();

    constructor(address _usdc, address _escrowContract) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        usdc = _usdc;
        escrowContract = _escrowContract;
    }

    /**
     * @notice Create a new wallet for an agent. Deploys a minimal AgntlyWallet contract.
     * @param agentId Unique agent identifier
     * @return wallet Address of the created wallet
     */
    function createWallet(bytes32 agentId) external returns (address wallet) {
        if (agentWallets[agentId] != address(0)) revert WalletAlreadyExists();

        AgntlyWallet newWallet = new AgntlyWallet(usdc, escrowContract, msg.sender);
        wallet = address(newWallet);

        agentWallets[agentId] = wallet;
        walletToAgent[wallet] = agentId;
        walletsCreated++;

        emit WalletCreated(agentId, wallet, msg.sender);
    }

    /**
     * @notice Get wallet address for an agent.
     */
    function getWallet(bytes32 agentId) external view returns (address) {
        return agentWallets[agentId];
    }

    function setEscrowContract(address newEscrow) external onlyOwner {
        if (newEscrow == address(0)) revert InvalidAddress();
        emit EscrowContractUpdated(escrowContract, newEscrow);
        escrowContract = newEscrow;
    }
}

/**
 * @title AgntlyWallet
 * @notice Individual agent wallet. Holds USDC, auto-approves the escrow contract,
 *         and allows the owner to withdraw. In production, this would be an
 *         ERC-4337 smart account with gas sponsorship.
 */
contract AgntlyWallet is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable walletOwner;
    IERC20 public immutable usdc;
    address public immutable escrowContract;

    // --- Events ---
    event Deposit(address indexed from, uint256 amount);
    event Withdrawal(address indexed to, uint256 amount);
    event EscrowApproved(uint256 amount);

    // --- Errors ---
    error NotOwner();
    error InsufficientBalance();
    error InvalidAmount();

    modifier onlyWalletOwner() {
        if (msg.sender != walletOwner) revert NotOwner();
        _;
    }

    constructor(address _usdc, address _escrowContract, address _owner) {
        usdc = IERC20(_usdc);
        escrowContract = _escrowContract;
        walletOwner = _owner;

        // TODO: SECURITY — Replace infinite approval with per-escrow approval amounts
        // Current: type(uint256).max approval means escrow contract can drain entire wallet
        // Fix: Approve exact amount per lockEscrow call, or use increaseAllowance pattern
        // Auto-approve escrow contract for max amount
        IERC20(_usdc).approve(_escrowContract, type(uint256).max);
    }

    /**
     * @notice Withdraw USDC to any address. Only wallet owner.
     * @param to Destination address
     * @param amount Amount in USDC smallest units
     */
    function withdraw(address to, uint256 amount) external onlyWalletOwner nonReentrant {
        if (amount == 0) revert InvalidAmount();
        uint256 balance = usdc.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();

        usdc.safeTransfer(to, amount);
        emit Withdrawal(to, amount);
    }

    /**
     * @notice Approve the escrow contract to spend USDC from this wallet.
     *         Called if approval was somehow reset.
     */
    function approveEscrow(uint256 amount) external onlyWalletOwner {
        usdc.approve(escrowContract, amount);
        emit EscrowApproved(amount);
    }

    /**
     * @notice Get USDC balance of this wallet.
     */
    function getBalance() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    /**
     * @notice Allow receiving USDC via direct transfer.
     */
    receive() external payable {}
}
