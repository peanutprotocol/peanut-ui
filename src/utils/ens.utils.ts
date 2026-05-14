import { JustaName } from '@justaname.id/sdk'
import { rpcUrls } from '@/constants/general.consts'
import { mainnet } from 'viem/chains'

const PEANUT_ENS_DOMAIN = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''

/**
 * Strip the Peanut JustaName subdomain suffix and trailing dot from an
 * ENS primary name so it renders as a plain handle (e.g. `hugo0.peanut.me.`
 * → `hugo0`). Non-Peanut ENS names pass through with the trailing dot
 * removed.
 */
export function normalizeEnsName(ensName: string | null | undefined): string | null {
    if (!ensName) return null
    const stripped =
        PEANUT_ENS_DOMAIN && ensName.endsWith(PEANUT_ENS_DOMAIN) ? ensName.slice(0, -PEANUT_ENS_DOMAIN.length) : ensName
    return stripped.replace(/\.$/, '')
}

/**
 * Resolves an Ethereum address to its username using JustaName ENS resolution
 * @param address - The Ethereum address to resolve
 * @param siteUrl - The site URL for origin configuration
 * @returns The username (without domain) or null if resolution fails
 */
export async function resolveAddressToUsername(address: string, siteUrl: string): Promise<string | null> {
    try {
        const mainnetRpcUrl = rpcUrls[mainnet.id]?.[0]
        if (!mainnetRpcUrl) {
            console.error('ENS resolution: No mainnet RPC URL configured')
            return null
        }

        const ensDomain = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN

        if (!ensDomain || ensDomain.trim() === '') {
            console.error('ENS resolution: NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN environment variable is not set')
            return null
        }

        const justAName = JustaName.init({
            networks: [
                {
                    chainId: 1, // Ethereum Mainnet
                    providerUrl: mainnetRpcUrl,
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
