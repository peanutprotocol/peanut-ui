import { arbitrum, base, bsc, mainnet, optimism, polygon } from 'viem/chains'
import { TokenInfo } from '../types/token'

export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        addresses: {
            [mainnet.id]: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // mainnet
            [optimism.id]: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', // optimism
            [polygon.id]: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', // polygon
            [arbitrum.id]: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // arbitrum
            [base.id]: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // base
            // todo: add more chain addresses
        },
        minAmount: '0.01',
        maxAmount: '1000000',
    },
    USDT: {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        addresses: {
            [mainnet.id]: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            [polygon.id]: '0x3813e82e6f7098b9583FC0F33a962D02018B6803',
            [arbitrum.id]: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9',
            [bsc.id]: '0x55d398326f99059ff775485246999027b3197955',
        },
        minAmount: '0.01',
        maxAmount: '1000000',
    },
    ETH: {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        addresses: {}, // native token, no address needed
        minAmount: '0.0001',
        maxAmount: '1000',
    },
    EURC: {
        symbol: 'EURC',
        name: 'Euro Coin',
        decimals: 6,
        addresses: {
            [mainnet.id]: '0x1aBaEA1f7C830bD89Acc67eC4af516284b1bC33c',
            [base.id]: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
        },
        minAmount: '0.01',
        maxAmount: '1000000',
    },
}
