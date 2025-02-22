import { POPULAR_CHAIN_NAME_VARIANTS } from '@/lib/url-parser/parser.consts'
import { getChainName } from '@/utils/general.utils'

// utility to get human-readable chain name
export function getReadableChainName(chainId: string | number): string {
    // if its a string and not a number (like "base", "eth", etc.)
    if (typeof chainId === 'string' && isNaN(Number(chainId))) {
        // try to normalize the name
        const normalizedName = normalizeChainName(chainId)
        // find the proper name from CHAIN_NAME_VARIANTS
        const properName = Object.keys(POPULAR_CHAIN_NAME_VARIANTS).find(
            (key) => key.toLowerCase() === normalizedName.toLowerCase()
        )
        if (properName) {
            return properName.charAt(0).toUpperCase() + properName.slice(1)
        }
    }

    // handle numeric chain IDs
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId

    // find matching chain in CHAIN_NAME_VARIANTS
    for (const [_chainID, variants] of Object.entries(POPULAR_CHAIN_NAME_VARIANTS)) {
        if (parseInt(_chainID) === numericChainId) {
            return variants[0].charAt(0).toUpperCase() + variants[0].slice(1)
        }
    }

    // fallback to chain name from utils if not found in variants
    const chainName = getChainName(numericChainId.toString())
    if (chainName) return chainName

    throw new Error(`Unknown chain ID: ${chainId}`)
}

// normalize chain names using CHAIN_NAME_VARIANTS mapping
export function normalizeChainName(chainName: string): string {
    const normalized = chainName.toLowerCase().trim()
    // check if the normalized string matches any of the variants
    for (const [_chainID, variants] of Object.entries(POPULAR_CHAIN_NAME_VARIANTS)) {
        if (variants.includes(normalized)) {
            return variants[0]
        }
    }

    // if no match found, return the original normalized string
    return normalized
}
