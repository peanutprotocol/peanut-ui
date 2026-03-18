// How to add a new chain:
// 1. If available in wagmi/chains (https://wagmi.sh/core/api/chains), import it directly.
// 2. If NOT in wagmi/chains, create a custom chain object (see `milkomeda` below for reference).
// 3. Add it to the `supportedPeanutChains` array at the bottom of this file.
// Note: Every chain used in the SDK MUST be listed here, or wallet interactions will break.
//       Chains can be listed here even if not yet supported in the SDK.

import type { Chain } from 'viem'
import * as wagmiChains from 'wagmi/chains'

const milkomeda = {
    id: 2001,
    name: 'Milkomeda C1 Mainnet',
    nativeCurrency: {
        name: 'milkAda',
        symbol: 'mADA',
        decimals: 18,
    },
    rpcUrls: {
        public: { http: ['https://rpc-mainnet-cardano-evm.c1.milkomeda.com'] },
        default: { http: ['https://rpc-mainnet-cardano-evm.c1.milkomeda.com'] },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://explorer-mainnet-cardano-evm.c1.milkomeda.com' },
    },
    contracts: {},
} as const satisfies Chain

const milkomedaTestnet = {
    id: 200101,
    name: 'Milkomeda C1 Testnet',
    nativeCurrency: {
        name: 'milkTAda',
        symbol: 'mTAda',
        decimals: 18,
    },
    rpcUrls: {
        public: { http: ['https://rpc-devnet-cardano-evm.c1.milkomeda.com'] },
        default: { http: ['https://rpc-devnet-cardano-evm.c1.milkomeda.com'] },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://explorer-devnet-cardano-evm.c1.milkomeda.com' },
    },
    contracts: {},
} as const satisfies Chain

const baseTestnet = {
    id: 84531,
    name: 'Base Goerli Testnet',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        public: { http: ['https://base-goerli.publicnode.com'] },
        default: { http: ['https://base-goerli.publicnode.com'] },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://goerli.basescan.org/' },
    },
    contracts: {},
} as const satisfies Chain

const taikoGrimsvotn = {
    id: 167005,
    name: 'Taiko Grimsvotn L2',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        public: { http: ['https://rpc.test.taiko.xyz'] },
        default: { http: ['https://rpc.test.taiko.xyz'] },
    },
    blockExplorers: {
        default: { name: 'Blockscout', url: 'https://explorer.test.taiko.xyz/' },
    },
    contracts: {},
} as const satisfies Chain

const ZKSyncSepolia = {
    id: 300,
    name: 'zkSync Sepolia Testnet',
    nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18,
    },
    rpcUrls: {
        public: { http: ['https://sepolia.era.zksync.dev'] },
        default: { http: ['https://sepolia.era.zksync.dev'] },
    },
    blockExplorers: {
        default: { name: 'zkSync Block Explorer', url: ' "https://sepolia.explorer.zksync.io"' },
    },
    contracts: {},
} as const satisfies Chain

//@ts-ignore
export const chains = [
    ...Object.values(wagmiChains),
    milkomeda,
    milkomedaTestnet,
    baseTestnet,
    taikoGrimsvotn,
    ZKSyncSepolia,
] as [Chain, ...Chain[]]
