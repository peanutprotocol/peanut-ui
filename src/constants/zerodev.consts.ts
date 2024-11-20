import { arbitrum } from 'viem/chains'
import { ENTRYPOINT_ADDRESS_V07 } from 'permissionless'

// consts needed to define low level SDK kernel
// as per: https://docs.zerodev.app/sdk/getting-started/tutorial-passkeys
export const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
export const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
export const PASSKEY_SERVER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_SERVER_URL

// consts needs to define @zerodev/waas
// as per: https://docs.zerodev.app/smart-wallet/quickstart-react
export const ZERO_DEV_PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID

export const PEANUT_WALLET_CHAIN = arbitrum
export const USER_OP_ENTRY_POINT = ENTRYPOINT_ADDRESS_V07
