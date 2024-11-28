import { areAddressesEqual } from '@/utils/'

export const checkTokenSupportsXChain = (
    tokenAddress: string,
    chainId: string,
    supportedSquidChainsAndTokens: Record<string, any>
): boolean => {
    // For native tokens, check if the chain supports SQUID_ETH_ADDRESS
    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
        return (
            supportedSquidChainsAndTokens[chainId]?.tokens.some((token: any) =>
                areAddressesEqual(token.address, SQUID_ETH_ADDRESS)
            ) ?? false
        )
    }

    return (
        supportedSquidChainsAndTokens[chainId]?.tokens.some((token: any) =>
            areAddressesEqual(token.address, tokenAddress)
        ) ?? false
    )
}

// Constants used across the app
export const SQUID_ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

// Helper to get the correct token address for Squid
export const getSquidTokenAddress = (tokenAddress: string): string => {
    return tokenAddress === '0x0000000000000000000000000000000000000000'
        ? SQUID_ETH_ADDRESS
        : tokenAddress.toLowerCase()
}
