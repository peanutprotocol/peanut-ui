import { areEvmAddressesEqual } from './general.utils'
import { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS } from '@/constants/tokens.consts'

// Re-export so existing call sites that import these from '@/utils/token.utils'
// keep working. New code should import from '@/constants/tokens.consts' directly.
export { NATIVE_TOKEN_ADDRESS, NATIVE_TOKEN_PROXY_ADDRESS }

export const checkTokenSupportsXChain = (
    tokenAddress: string,
    chainId: string,
    supportedChainsAndTokens: Record<string, any>
): boolean => {
    if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
        return (
            supportedChainsAndTokens[chainId]?.tokens.some((token: any) =>
                areEvmAddressesEqual(token.address, NATIVE_TOKEN_PROXY_ADDRESS)
            ) ?? false
        )
    }

    return (
        supportedChainsAndTokens[chainId]?.tokens.some((token: any) =>
            areEvmAddressesEqual(token.address, tokenAddress)
        ) ?? false
    )
}
