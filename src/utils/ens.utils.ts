import { JustaName } from '@justaname.id/sdk'
import { rpcUrls } from '@/constants/general.consts'
import { mainnet } from 'viem/chains'
import { ethers } from 'ethers'

/**
 * Resolves an Ethereum address to its username using JustaName ENS resolution
 * @param address - The Ethereum address to resolve
 * @param siteUrl - The site URL for origin configuration
 * @returns The username (without domain) or null if resolution fails
 */
export async function resolveAddressToUsername(address: string, siteUrl: string): Promise<string | null> {
    try {
        const mainnetRpcUrl = rpcUrls[mainnet.id]?.[0] ?? ethers.getDefaultProvider('mainnet')

        const ensDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN

        if (!ensDomain || ensDomain.trim() === '') {
            throw new Error('NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN environment variable is required and cannot be empty')
        }

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
                    ensDomain,
                    apiKey: process.env.JUSTANAME_API_KEY || '', // i dont even have an API key but it works haha @facu
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
            // Strip domain to get username
            const username = ensName.name.endsWith(ensDomain)
                ? ensName.name.slice(0, -ensDomain.length).replace(/\.$/, '')
                : ensName.name.replace(/\.$/, '')
            return username
        }

        return null
    } catch (error) {
        console.error('ENS resolution error:', error)
        return null
    }
}
