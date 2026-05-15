/**
 * Environment-aware URLs for docs and code examples.
 * Reads NEXT_PUBLIC_APP_ENV at build time to show the correct URLs.
 */

const isSandbox = process.env.NEXT_PUBLIC_APP_ENV !== 'production';

export const ENV = {
  name: isSandbox ? 'sandbox' : 'production',
  isSandbox,

  /** Frontend URL */
  appUrl: isSandbox ? 'https://sandbox.agntly.io' : 'https://agntly.io',

  /** API base URL */
  apiUrl: isSandbox ? 'https://sandbox.api.agntly.io' : 'https://api.agntly.io',

  /** API key prefix shown in examples */
  keyPrefix: isSandbox ? 'ag_test_sk_' : 'ag_prod_sk_',

  /** Example API key */
  exampleKey: isSandbox ? 'ag_test_sk_7f3k2m9p...' : 'ag_prod_sk_7f3k2m9p...',

  /** Chain name */
  chain: isSandbox ? 'Base Sepolia' : 'Base Mainnet',

  /** Label color class */
  labelClass: isSandbox ? 'text-amber' : 'text-accent',

  /** Label */
  label: isSandbox ? 'Sandbox' : 'Production',
} as const;
