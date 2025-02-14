import { supportedPeanutChains } from '@/constants'
import { getChainName } from '@/utils/general.utils'
import { arbitrum, base, mainnet, optimism, polygon } from 'viem/chains'
import { SUPPORTED_TOKENS } from '../../url-parser/constants/tokens'
import { CHAIN_ID_REGEX, TLD, TLDS } from '../constants'

type ChainNameMapping = {
    [key: string]: {
        variants: string[]
        supportsNativeEth: boolean
        chainId: string
    }
}

// mapping of normalized chain identifiers to their variations
export const CHAIN_NAME_VARIANTS: ChainNameMapping = {
    eth: {
        variants: ['ethereum', 'ethereum mainnet', 'eth', 'eth mainnet'],
        supportsNativeEth: true,
        chainId: mainnet.id.toString(),
    },
    optimism: {
        variants: ['optimism', 'op', 'op mainnet', 'optimism mainnet'],
        supportsNativeEth: true,
        chainId: optimism.id.toString(),
    },
    arbitrum: {
        variants: ['arbitrum', 'arbitrum one', 'arbitrum mainnet'],
        supportsNativeEth: true,
        chainId: arbitrum.id.toString(),
    },
    polygon: {
        variants: ['polygon', 'polygon pos', 'matic', 'polygon mainnet'],
        supportsNativeEth: false,
        chainId: polygon.id.toString(),
    },
    base: {
        variants: ['base', 'base mainnet', 'coinbase chain'],
        supportsNativeEth: true,
        chainId: base.id.toString(),
    },
}

interface ResolvedChain {
    id: string
    name: string
    isTestnet: boolean
}

export function resolveChain(chainIdentifier: string): ResolvedChain {
    // case 1: chain id (0x[a-fA-F0-9]{1,64})
    if (chainIdentifier.startsWith('0x')) {
        const chainId = parseInt(chainIdentifier, 16).toString()
        const chain = supportedPeanutChains.find((c) => c.chainId === chainId)
        if (!chain) {
            throw new Error(`Unsupported chain ID: ${chainIdentifier}`)
        }
        return {
            id: chain.chainId,
            name: chain.name,
            isTestnet: !chain.mainnet,
        }
    }

    // case 2: TLD (eth | arbitrum | ...)
    if (TLDS.includes(chainIdentifier.toLowerCase() as TLD)) {
        const normalizedName = normalizeChainName(chainIdentifier)
        const chain = supportedPeanutChains.find((c) => normalizeChainName(c.name) === normalizedName)
        if (!chain) {
            throw new Error(`Unsupported L1 TLD: ${chainIdentifier}`)
        }
        return {
            id: chain.chainId,
            name: chain.name,
            isTestnet: !chain.mainnet,
        }
    }

    // case 3: ens names with TLD (example.eth)
    if (chainIdentifier.endsWith('.eth')) {
        const networkName = chainIdentifier.replace('.eth', '')
        const normalizedName = normalizeChainName(networkName)
        const chain = supportedPeanutChains.find((c) => normalizeChainName(c.name) === normalizedName)
        if (!chain) {
            throw new Error(`Unsupported chain ENS: ${chainIdentifier}`)
        }
        return {
            id: chain.chainId,
            name: chain.name,
            isTestnet: !chain.mainnet,
        }
    }

    throw new Error(`Invalid chain identifier format: ${chainIdentifier}`)
}

// utility to get human-readable chain name
export function getReadableChainName(chainId: string | number): string {
    // if its a string and not a number (like "base", "eth", etc.)
    if (typeof chainId === 'string' && isNaN(Number(chainId))) {
        // try to normalize the name
        const normalizedName = normalizeChainName(chainId)
        // find the proper name from CHAIN_NAME_VARIANTS
        const properName = Object.keys(CHAIN_NAME_VARIANTS).find(
            (key) => key.toLowerCase() === normalizedName.toLowerCase()
        )
        if (properName) {
            return properName.charAt(0).toUpperCase() + properName.slice(1)
        }
    }

    // handle numeric chain IDs
    const numericChainId = typeof chainId === 'string' ? parseInt(chainId) : chainId

    // find matching chain in CHAIN_NAME_VARIANTS
    for (const [name, config] of Object.entries(CHAIN_NAME_VARIANTS)) {
        if (parseInt(config.chainId) === numericChainId) {
            return name.charAt(0).toUpperCase() + name.slice(1)
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
    for (const [standardName, config] of Object.entries(CHAIN_NAME_VARIANTS)) {
        if (config.variants.includes(normalized)) {
            return standardName
        }
    }

    // if no match found, return the original normalized string
    return normalized
}

// validate if chain supports a specific token
export function validateChainTokenSupport(chainId: string, tokenSymbol: string): boolean {
    const token = SUPPORTED_TOKENS[tokenSymbol.toUpperCase()]
    if (!token) return false

    return !!token.addresses[Number(chainId)]
}

// utility fn to check if a chain supports native ETH
export function supportsNativeEth(chainIdentifier: string): boolean {
    const normalized = normalizeChainName(chainIdentifier)
    return CHAIN_NAME_VARIANTS[normalized]?.supportsNativeEth ?? false
}

export function resolveChainId(chainIdentifier: string): string {
    // case 1: direct chain ID (0x1, 0x89, etc)
    if (CHAIN_ID_REGEX.test(chainIdentifier)) {
        return parseInt(chainIdentifier, 16).toString()
    }

    // case 2: TLD (eth, arbitrum, etc)
    if (TLDS.includes(chainIdentifier.toLowerCase() as TLD)) {
        const chainConfig = CHAIN_NAME_VARIANTS[chainIdentifier.toLowerCase()]
        if (!chainConfig) {
            throw new Error(`Unsupported L1 TLD: ${chainIdentifier}`)
        }
        // return corresponding chain ID
        return chainConfig.chainId
    }

    // case 3: ENS name with TLD (arbitrum.eth, etc)
    if (chainIdentifier.endsWith('.eth')) {
        const networkName = chainIdentifier.replace('.eth', '')
        const normalizedName = normalizeChainName(networkName)
        const chainConfig = CHAIN_NAME_VARIANTS[normalizedName]
        if (!chainConfig) {
            throw new Error(`Unsupported chain ENS: ${chainIdentifier}`)
        }
        return chainConfig.chainId
    }

    throw new Error(`Invalid chain identifier format: ${chainIdentifier}`)
}
