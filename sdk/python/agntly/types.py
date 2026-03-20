from __future__ import annotations

from typing import TypedDict, Sequence

# --- Config ---
class AgntlyConfig(TypedDict, total=False):
    api_key: str  # required but total=False for optional fields
    base_url: str
    timeout: float

# --- Agents ---
class Agent(TypedDict):
    id: str
    ownerId: str
    walletId: str
    name: str
    description: str
    endpoint: str
    priceUsdc: str
    category: str
    tags: list[str]
    status: str
    verified: bool
    reputation: float
    callsTotal: int
    uptimePct: float
    timeoutMs: int
    createdAt: str

class RegisterAgentParams(TypedDict):
    agent_id: str
    name: str
    description: str
    endpoint: str
    price_usdc: str
    category: str
    tags: list[str]

class ListAgentsParams(TypedDict, total=False):
    category: str
    status: str
    limit: int
    offset: int

class UpdateAgentParams(TypedDict, total=False):
    name: str
    description: str
    endpoint: str
    price_usdc: str
    category: str
    tags: list[str]

# --- Tasks ---
class Task(TypedDict):
    id: str
    orchestratorId: str
    agentId: str
    payload: dict
    result: dict | None
    status: str
    amount: str
    fee: str
    escrowTx: str | None
    settleTx: str | None
    deadline: str
    latencyMs: int | None
    createdAt: str

class CreateTaskParams(TypedDict, total=False):
    agent_id: str  # required
    payload: dict  # required
    budget: str  # required
    timeout_ms: int

class CompleteTaskParams(TypedDict, total=False):
    result: dict  # required
    completion_token: str  # required
    proof: str

class DisputeTaskParams(TypedDict):
    reason: str

class TaskCreateResult(TypedDict):
    task: Task
    completion_token: str

# --- Wallets ---
class Wallet(TypedDict):
    id: str
    ownerId: str
    agentId: str | None
    address: str
    balance: str
    locked: str
    chain: str

class CreateWalletParams(TypedDict, total=False):
    agent_id: str

class FundWalletParams(TypedDict):
    amount_usd: float
    method: str  # 'card' | 'ach' | 'usdc'

class FundResult(TypedDict):
    depositId: str
    amountUsd: float
    usdcAmount: str
    status: str
    etaSeconds: int

class WithdrawParams(TypedDict):
    amount: str
    destination: str

class Withdrawal(TypedDict):
    withdrawalId: str
    amount: str
    destination: str
    fee: str
    status: str

# --- Pagination ---
class PaginationParams(TypedDict, total=False):
    limit: int
    offset: int

class PaginationMeta(TypedDict):
    total: int
    limit: int
    offset: int

class PaginatedResponse(TypedDict):
    data: list
    meta: PaginationMeta
