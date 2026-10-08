// Circle native EURC on Base; kept aligned with peanut-api-ts's catalog.
export const EURC_ASSET = {
    asset: 'EURC',
    currency: 'EUR',
    chainId: '8453',
    tokenAddress: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    decimals: 6,
} as const

export const EURC_WALLET_CONFIGURED = Boolean(
    process.env.NEXT_PUBLIC_EURC_BASE_BUNDLER_URL && process.env.NEXT_PUBLIC_EURC_BASE_PAYMASTER_URL
)
