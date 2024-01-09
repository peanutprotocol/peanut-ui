// https://wagmi.sh/core/chains

import * as wagmiChains from 'wagmi/chains'
import { Chain } from 'wagmi'

const milkomeda = {
    id: 2001,
    name: 'Milkomeda C1 Mainnet',
    network: 'milkAda',
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
    network: '"milkTAda"',
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

// TODO: replace with baseGoerli (wagmi export)
const baseTestnet = {
    id: 84531,
    name: 'Base Goerli Testnet',
    network: 'baseGoerli',
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
    network: 'taikogrimsvotn',
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
    network: 'zksyncsepolia',
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
}

export const chains = [
    ...Object.values(wagmiChains),
    milkomeda,
    milkomedaTestnet,
    baseTestnet,
    taikoGrimsvotn,
    ZKSyncSepolia,
]
