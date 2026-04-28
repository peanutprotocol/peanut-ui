import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import { extractChain } from 'viem'
import * as chains from 'viem/chains'
import { arbitrum, arbitrumSepolia } from 'viem/chains'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL!
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL!
export const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

// Default to Arb One + Circle USDC (prod). Overridable via env so the mono
// QA harness can point the UI at Arb Sepolia + testnet USDC without forking.
// When NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID is '421614', we also default the
// token address to Circle's Arb-Sepolia testnet USDC (lowercase checksum).
const SANDBOX_CHAIN_ID = process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID
const USE_SEPOLIA = SANDBOX_CHAIN_ID === '421614'

// Wallet chain & token — configurable via env for sandbox/testnet testing.
// Defaults: Arbitrum mainnet + USDC. When NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID
// is '421614' (Arb Sepolia), default token falls back to Circle's testnet USDC.
const walletChainId = Number(process.env.NEXT_PUBLIC_PEANUT_WALLET_CHAIN_ID || arbitrum.id)
export const PEANUT_WALLET_CHAIN =
    walletChainId === arbitrum.id
        ? arbitrum
        : USE_SEPOLIA
          ? arbitrumSepolia
          : extractChain({ chains: Object.values(chains), id: walletChainId as any })
export const PEANUT_WALLET_TOKEN =
    process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN ??
    (USE_SEPOLIA
        ? '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d' // Circle USDC on Arb Sepolia
        : '0xaf88d065e77c8cc2239327c5edb3a432268e5831') // Circle USDC on Arb One
export const PEANUT_WALLET_TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_DECIMALS || 6)
export const PEANUT_WALLET_TOKEN_SYMBOL = process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_SYMBOL || 'USDC'
export const PEANUT_WALLET_TOKEN_NAME = process.env.NEXT_PUBLIC_PEANUT_WALLET_TOKEN_NAME || 'USD Coin'
export const PEANUT_WALLET_TOKEN_IMG_URL =
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'

export const USDT_IN_MAINNET = '0xdac17f958d2ee523a2206206994597c13d831ec7'

/**
 * Zerodev needs these to be passed explicitly to avoid breaking changes
 * when upgrading the SDK. At moment of feature development this is
 * kernel v3.1 with entry point 0.7 This will probably not change in the
 * future.
 */
export const USER_OP_ENTRY_POINT = getEntryPoint('0.7')
export const ZERODEV_KERNEL_VERSION = KERNEL_V3_1
export const USER_OPERATION_REVERT_REASON_TOPIC = '0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201'
