import { areEvmAddressesEqual } from './general.utils'
import { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS } from '@/constants/tokens.consts'

// Re-export so existing call sites that import these from '@/utils/token.utils'
// keep working. New code should import from '@/constants/tokens.consts' directly.
export { NATIVE_TOKEN_ADDRESS, SQUID_ETH_ADDRESS }

export const checkTokenSupportsXChain = (
    tokenAddress: string,
    chainId: string,
    supportedSquidChainsAndTokens: Record<string, any>
): boolean => {
    if (tokenAddress === NATIVE_TOKEN_ADDRESS) {
        return (
            supportedSquidChainsAndTokens[chainId]?.tokens.some((token: any) =>
                areEvmAddressesEqual(token.address, SQUID_ETH_ADDRESS)
            ) ?? false
        )
    }

    return (
        supportedSquidChainsAndTokens[chainId]?.tokens.some((token: any) =>
            areEvmAddressesEqual(token.address, tokenAddress)
        ) ?? false
    )
}
