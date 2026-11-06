/**
 * Peanut wallet token config.
 *
 * Env-only values with no chain dependency, split out of zerodev.consts so
 * consumers that just need the token address, decimals or symbol do not pull
 * in the ZeroDev SDK constants. zerodev.consts re-exports them, so existing
 * importers are unaffected.
 */
const SANDBOX_CHAIN_ID = process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID
export const USE_SEPOLIA = SANDBOX_CHAIN_ID === '421614'

export const PEANUT_WALLET_TOKEN =
    process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN ??
    (USE_SEPOLIA
        ? '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d' // Circle USDC on Arb Sepolia
        : '0xaf88d065e77c8cc2239327c5edb3a432268e5831') // Circle USDC on Arb One
export const PEANUT_WALLET_TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_DECIMALS || 6)
export const PEANUT_WALLET_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_SYMBOL || 'USDC'
