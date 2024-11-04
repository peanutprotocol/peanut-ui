import { createPublicClient, http } from 'viem'
import { infuraRpcUrls } from './general.consts'
import { PEANUT_WALLET_CHAIN } from './zerodev.consts'

export const peanutPublicClient = createPublicClient({
    transport: http(infuraRpcUrls[PEANUT_WALLET_CHAIN.id]),
    chain: PEANUT_WALLET_CHAIN,
})
