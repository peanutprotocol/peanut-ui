import { mainnet, optimism, polygon } from 'viem/chains'
import { TokenInfo } from '../types/token'

export const SUPPORTED_TOKENS: Record<string, TokenInfo> = {
    USDC: {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        addresses: {
            [mainnet.id]: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // mainnet
            [optimism.id]: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // optimism
            [polygon.id]: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // polygon
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
            1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            // todo: add more chain addresses
        },
        minAmount: '0.01',
        maxAmount: '1000000',
    },
    ETH: {
        symbol: 'ETH',
        name: 'Ether',
        decimals: 18,
        addresses: {
            1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
            // todo: add more chain addresses
        },
        minAmount: '0.0001',
        maxAmount: '1000',
    },
}
