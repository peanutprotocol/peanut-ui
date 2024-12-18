import { arbitrum } from 'viem/chains'
import { getEntryPoint } from '@zerodev/sdk/constants'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
export const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

// consts needs to define @zerodev/waas
// as per: https://docs.zerodev.app/smart-wallet/quickstart-react
export const ZERO_DEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID

export const PEANUT_WALLET_CHAIN = arbitrum
//USDC Arbitrum address
export const PEANUT_WALLET_TOKEN = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
export const PEANUT_WALLET_TOKEN_DECIMALS = 6 //USDC decimals

export const USER_OP_ENTRY_POINT = getEntryPoint('0.7')
