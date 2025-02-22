import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'

export const POPULAR_CHAIN_NAME_VARIANTS: {
    [key: string]: string[]
} = {
    [mainnet.id]: ['ethereum', 'ethereum mainnet', 'eth', 'eth mainnet'],
    [optimism.id]: ['optimism', 'op', 'op mainnet', 'optimism mainnet', 'optimism-mainnet'],
    [arbitrum.id]: ['arbitrum', 'arbitrum one', 'arbitrum mainnet', 'arb', 'arbitrum-one'],
    [polygon.id]: ['polygon', 'polygon pos', 'matic', 'polygon mainnet'],
    [base.id]: ['base', 'base mainnet', 'coinbase chain'],
}
