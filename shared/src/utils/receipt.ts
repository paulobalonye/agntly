const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';
const BASE_MAINNET_EXPLORER = 'https://basescan.org';

export function getReceiptUrl(txHash: string | null, chain: string = 'base-sepolia'): string | null {
  if (!txHash) return null;
  const explorer = chain === 'base' ? BASE_MAINNET_EXPLORER : BASE_SEPOLIA_EXPLORER;
  return `${explorer}/tx/${txHash}`;
}
