import type { ChainWithTokens } from '@/interfaces/chain-meta'
import { CHAIN_LOGOS, TOKEN_LOGOS } from '@/constants/rhino.consts'

/**
 * Non-EVM withdraw destinations (Rhino delivers; verified 2026-07-11 with
 * live quotes + outflow-SDA creates: SOLANA USDC+USDT, TRON USDT-only).
 *
 * These chains have no EVM chainId and no chain-details.json entry, so the
 * withdraw selector merges these synthetic entries in withdraw mode ONLY
 * (`restrictToRhino`) — they must not leak into send/pay/claim surfaces or
 * URL parsing, which assume EVM addresses and wagmi networks.
 *
 * The selector `chainId` is the slug ('solana' | 'tron') — the same
 * identifier the old coming-soon entries used; `chainIdToRhinoName` maps it
 * to Rhino's API chain name. Token addresses are the canonical SPL mints /
 * TRC20 contract (mirrors peanut-api-ts `src/rhino/consts.ts`); Rhino
 * resolves tokens by SYMBOL, the address here is for selector display and
 * identity only.
 */
export const NON_EVM_WITHDRAW_CHAINS: Record<string, ChainWithTokens> = {
    solana: {
        chainId: 'solana',
        networkName: 'Solana',
        chainIconURI: CHAIN_LOGOS.SOLANA,
        tokens: [
            {
                chainId: 'solana',
                address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                decimals: 6,
                name: 'USD Coin',
                symbol: 'USDC',
                logoURI: TOKEN_LOGOS.USDC,
                usdPrice: 0,
            },
            {
                chainId: 'solana',
                address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
                decimals: 6,
                name: 'Tether USD',
                symbol: 'USDT',
                logoURI: TOKEN_LOGOS.USDT,
                usdPrice: 0,
            },
        ],
    },
    tron: {
        chainId: 'tron',
        networkName: 'Tron',
        chainIconURI: CHAIN_LOGOS.TRON,
        tokens: [
            {
                chainId: 'tron',
                address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
                decimals: 6,
                name: 'Tether USD',
                symbol: 'USDT',
                logoURI: TOKEN_LOGOS.USDT,
                usdPrice: 0,
            },
        ],
    },
}

export function isNonEvmWithdrawChainId(chainId: string | number): boolean {
    return String(chainId).toLowerCase() in NON_EVM_WITHDRAW_CHAINS
}
