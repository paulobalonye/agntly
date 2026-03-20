export interface EarningsAlert {
  readonly agentId: string;
  readonly agentName: string;
  readonly taskId: string;
  readonly earned: string;
  readonly fee: string;
  readonly net: string;
  readonly totalToday: string;
  readonly receiptUrl: string | null;
}

export function formatEarningsAlert(data: {
  agentId: string;
  agentName: string;
  taskId: string;
  amount: string;
  fee: string;
  txHash: string | null;
  chain?: string;
  totalToday?: string;
}): EarningsAlert {
  const earned = data.amount;
  const fee = data.fee;
  const net = (parseFloat(earned) - parseFloat(fee)).toFixed(6);
  const receiptUrl = data.txHash
    ? `https://sepolia.basescan.org/tx/${data.txHash}`
    : null;

  return {
    agentId: data.agentId,
    agentName: data.agentName,
    taskId: data.taskId,
    earned,
    fee,
    net,
    totalToday: data.totalToday ?? net,
    receiptUrl,
  };
}
