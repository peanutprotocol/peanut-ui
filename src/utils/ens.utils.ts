import { JustaName } from '@justaname.id/sdk'
import { rpcUrls } from '@/constants/general.consts'
import { mainnet } from 'viem/chains'

/**
 * Resolves an Ethereum address to its username using JustaName ENS resolution
 * @param address - The Ethereum address to resolve
 * @param siteUrl - The site URL for origin configuration
 * @returns The username (without domain) or null if resolution fails
 */
export async function resolveAddressToUsername(
    address: string,
    siteUrl: string
): Promise<string | null> {
    try {
        const mainnetRpcUrl = rpcUrls[mainnet.id]?.[0]
        
        const justAName = JustaName.init({
            networks: [
                {
                    chainId: 1, // Ethereum Mainnet
                    providerUrl: mainnetRpcUrl || 'https://eth.llamarpc.com',
                },
            ],
            ensDomains: [
                {
                    chainId: 1,
                    ensDomain: process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || 'testvc.eth',
                    apiKey: process.env.JUSTANAME_API_KEY || '',
                },
            ],
            config: {
                domain: 'peanut.me',
                origin: siteUrl,
            },
        })

        const ensName = await justAName.subnames.getPrimaryNameByAddress({
            address,
        })

        if (ensName?.name) {
            // Strip peanut.me domain to get username
            const peanutEnsDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''
            const username = ensName.name.replace(peanutEnsDomain, '').replace(/\.$/, '')
            return username
        }

        return null
    } catch (error) {
        console.log('ENS resolution error:', error)
        return null
    }
}