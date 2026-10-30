import type { Address } from 'viem'
import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import { areEvmAddressesEqual, getTokenDetails } from '@/utils/general.utils'

/**
 * Symbol and decimals of the token a request is paid in, read synchronously:
 * the wallet token, else the static token list. Paying a USDC or USDT request
 * needs nothing else, so it never waits for the chain list to load or for a
 * price lookup (TASK-23850). Undefined for a token neither knows.
 */
export function requestPayTokenMeta(
    tokenAddress: string,
    chainId: string
): { symbol: string; decimals: number } | undefined {
    if (chainId === PEANUT_WALLET_CHAIN.id.toString() && areEvmAddressesEqual(tokenAddress, PEANUT_WALLET_TOKEN)) {
        return { symbol: PEANUT_WALLET_TOKEN_SYMBOL, decimals: PEANUT_WALLET_TOKEN_DECIMALS }
    }
    return getTokenDetails({ tokenAddress: tokenAddress as Address, chainId })
}
