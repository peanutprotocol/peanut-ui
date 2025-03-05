import { getEntryPoint } from '@zerodev/sdk/constants'
import { arbitrum, polygon } from 'viem/chains'
import type { PublicClient, Chain } from 'viem'
import { createPublicClient, http } from 'viem'
import { infuraRpcUrls } from '@/constants/general.consts'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL!
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL!
export const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

// consts needs to define @zerodev/waas
// as per: https://docs.zerodev.app/smart-wallet/quickstart-react
export const ZERO_DEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID

export const PEANUT_WALLET_CHAIN = arbitrum
//USDC Arbitrum address
export const PEANUT_WALLET_TOKEN_DECIMALS = 6 // USDC decimals
export const PEANUT_WALLET_TOKEN = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
export const PEANUT_WALLET_TOKEN_NAME = 'USDC'

export const USER_OP_ENTRY_POINT = getEntryPoint('0.7')

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
            transport: http(infuraRpcUrls[arbitrum.id]),
            chain: arbitrum,
        }),
        chain: PEANUT_WALLET_CHAIN,
        bundlerUrl: BUNDLER_URL,
        paymasterUrl: PAYMASTER_URL,
    },
    [polygon.id]: {
        client: createPublicClient({
            transport: http(infuraRpcUrls[polygon.id]),
            chain: polygon,
        }),
        chain: polygon,
        bundlerUrl: process.env.NEXT_PUBLIC_POLYGON_BUNDLER_URL!,
        paymasterUrl: process.env.NEXT_PUBLIC_POLYGON_PAYMASTER_URL!,
    },
}

export const peanutPublicClient = PUBLIC_CLIENTS_BY_CHAIN[PEANUT_WALLET_CHAIN.id].client
