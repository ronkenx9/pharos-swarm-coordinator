import { defineChain } from 'viem';

export const pharosTestnet = defineChain({
  id: 688689,
  name: 'Pharos Atlantic Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://atlantic.dplabs-internal.com'] },
    public: { http: ['https://atlantic.dplabs-internal.com'] },
  },
  blockExplorers: {
    default: {
      name: 'Pharos Scan',
      url: 'https://atlantic.pharosscan.xyz',
    },
  },
  testnet: true,
});
