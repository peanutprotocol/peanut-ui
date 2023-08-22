import {
    gnosis,
    mainnet,
    arbitrum,
    polygon,
    bsc,
    goerli,
    scrollTestnet,
    optimism,
    bscTestnet,
    optimismGoerli,
    polygonZkEvmTestnet,
    mantleTestnet,
    gnosisChiado,
    avalancheFuji,
    avalanche,
    celoAlfajores,
    polygonMumbai,
    filecoinCalibration,
    neonDevnet,
} from '@wagmi/chains'
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
    contracts: {
        multicall3: {
            address: '0xca11bde05977b3631167028862be2a173976ca11',
            blockCreated: 11_907_934,
        },
    },
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
    contracts: {
        multicall3: {
            address: '0xca11bde05977b3631167028862be2a173976ca11',
            blockCreated: 11_907_934,
        },
    },
} as const satisfies Chain

export const chains = [
    mainnet,
    arbitrum,
    polygon,
    bsc,
    goerli,
    gnosis,
    scrollTestnet,
    optimism,
    bscTestnet,
    optimismGoerli,
    polygonZkEvmTestnet,
    mantleTestnet,
    gnosisChiado,
    avalancheFuji,
    avalanche,
    celoAlfajores,
    polygonMumbai,
    filecoinCalibration,
    neonDevnet,
    milkomeda,
    milkomedaTestnet,
]

//have a look to make this more modular
