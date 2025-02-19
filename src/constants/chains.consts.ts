// https://wagmi.sh/core/chains

import type { Chain } from 'viem'
import * as wagmiChains from 'wagmi/chains'

const getInfuraApiUrl = (network: string): string => {
    return `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
}

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

// infura supported chains
const mainnet = {
    ...wagmiChains.mainnet,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('mainnet')] },
        public: { http: ['https://ethereum-rpc.publicnode.com'] },
    },
}

const optimism = {
    ...wagmiChains.optimism,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('optimism-mainnet')] },
        public: { http: ['https://mainnet.optimism.io'] },
    },
}

const polygon = {
    ...wagmiChains.polygon,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('polygon-mainnet')] },
        public: { http: ['https://polygon-rpc.com'] },
    },
}

const arbitrum = {
    ...wagmiChains.arbitrum,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('arbitrum-mainnet')] },
        public: { http: ['https://arb1.arbitrum.io/rpc'] },
    },
}

const scroll = {
    ...wagmiChains.scroll,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('scroll-mainnet')] },
        public: { http: ['https://scroll.public-rpc.com'] },
    },
}

const mantle = {
    ...wagmiChains.mantle,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('mantle-mainnet')] },
        public: { http: ['https://mantle-rpc.publicnode.com'] },
    },
}

const bsc = {
    ...wagmiChains.bsc,
    rpcUrls: {
        default: { http: [getInfuraApiUrl('bsc-mainnet')] },
        public: { http: ['https://bsc-dataseed1.binance.org'] },
    },
}

//@ts-ignore
export const chains = [
    mainnet,
    optimism,
    wagmiChains.gnosis,
    wagmiChains.base,
    polygon,
    scroll,
    mantle,
    arbitrum,
    bsc,
    milkomeda,
    milkomedaTestnet,
    baseTestnet,
    taikoGrimsvotn,
    ZKSyncSepolia,
] as [Chain, ...Chain[]]
