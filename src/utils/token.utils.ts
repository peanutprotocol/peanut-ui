import { areEvmAddressesEqual } from '@/utils/'

export const checkTokenSupportsXChain = (
    tokenAddress: string,
    chainId: string,
    supportedSquidChainsAndTokens: Record<string, any>
): boolean => {
    // For native tokens, check if the chain supports SQUID_ETH_ADDRESS
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

// Constants used across the app
export const SQUID_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

// Helper to get the correct token address for Squid
export const getSquidTokenAddress = (tokenAddress: string): string => {
    return tokenAddress === NATIVE_TOKEN_ADDRESS ? SQUID_ETH_ADDRESS : tokenAddress.toLowerCase()
}
