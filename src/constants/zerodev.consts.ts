import { getEntryPoint, KERNEL_V3_1 } from '@zerodev/sdk/constants'
import type { Chain, PublicClient } from 'viem'
import { createPublicClient } from 'viem'
import { getTransportWithFallback } from '@/app/actions/clients'
import { arbitrum } from 'viem/chains'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL!
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL!
export const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

// consts needs to define @zerodev/waas
// as per: https://docs.zerodev.app/smart-wallet/quickstart-react
export const ZERO_DEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID

// TODO: this should be taken from a global token dict, not hardcoded here
export const PEANUT_WALLET_CHAIN = arbitrum
export const PEANUT_WALLET_TOKEN_DECIMALS = 6 // USDC decimals
export const PEANUT_WALLET_TOKEN = '0xaf88d065e77c8cc2239327c5edb3a432268e5831' // USDC Arbitrum address
export const PEANUT_WALLET_TOKEN_SYMBOL = 'USDC'
export const PEANUT_WALLET_TOKEN_NAME = 'USD Coin'
export const PEANUT_WALLET_TOKEN_IMG_URL =
    'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'

export const USDT_IN_MAINNET = '0xdac17f958d2ee523a2206206994597c13d831ec7'

export const PEANUT_WALLET_SUPPORTED_TOKENS: Record<string, string[]> = {
    [PEANUT_WALLET_CHAIN.id.toString()]: [PEANUT_WALLET_TOKEN],
}

/**
 * Zerodev needs these to be passed explicitly to avoid breaking changes
 * when upgrading the SDK. At moment of feature development this is
 * kernel v3.1 with entry point 0.7 This will probably not change in the
 * future.
 */
export const USER_OP_ENTRY_POINT = getEntryPoint('0.7')
export const ZERODEV_KERNEL_VERSION = KERNEL_V3_1
export const USER_OPERATION_REVERT_REASON_TOPIC = '0x1c4fada7374c0a9ee8841fc38afe82932dc0f8e69012e927f061a8bae611a201'

/**
 * This is a mapping of chain ID to the public client and chain details
 * This is for the standard chains supported in the app. For now Arbitrum, but
 * for example if we have rewards on other chains, we can add them here.
 */
export const PUBLIC_CLIENTS_BY_CHAIN: Record<
    string,
    {
        client: PublicClient
        chain: Chain
        bundlerUrl: string
        paymasterUrl: string
    }
> = {
    [arbitrum.id]: {
        client: createPublicClient({
            transport: getTransportWithFallback(arbitrum.id),
            chain: arbitrum,
            pollingInterval: 500,
        }),
        chain: PEANUT_WALLET_CHAIN,
        bundlerUrl: BUNDLER_URL,
        paymasterUrl: PAYMASTER_URL,
    },
}

export const peanutPublicClient = PUBLIC_CLIENTS_BY_CHAIN[PEANUT_WALLET_CHAIN.id].client
