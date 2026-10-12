// Circle native EURC on Base; kept aligned with peanut-api-ts's catalog.
import { USE_SEPOLIA } from './wallet-token.consts'

export const EURE_ASSET = {
    asset: 'EURE',
    currency: 'EUR',
    chainId: USE_SEPOLIA ? '421614' : '42161',
    tokenAddress: USE_SEPOLIA
        ? '0xfdeed5ce7e281b4e0f163b70ebe2cf0b10803b7b'
        : '0x0c06ccf38114ddfc35e07427b9424adcca9f44f8',
    decimals: 18,
} as const

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
