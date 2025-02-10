type ChainNameMapping = {
    [key: string]: {
        variants: string[]
        supportsNativeEth: boolean
    }
}

// mapping of normalized chain identifiers to their variations
export const CHAIN_NAME_VARIANTS: ChainNameMapping = {
    eth: {
        variants: ['ethereum', 'ethereum mainnet', 'eth', 'eth mainnet'],
        supportsNativeEth: true,
    },
    optimism: {
        variants: ['optimism', 'op', 'op mainnet', 'optimism mainnet'],
        supportsNativeEth: true,
    },
    arbitrum: {
        variants: ['arbitrum', 'arbitrum one', 'arbitrum mainnet'],
        supportsNativeEth: true,
    },
    polygon: {
        variants: ['polygon', 'polygon pos', 'matic', 'polygon mainnet'],
        supportsNativeEth: false,
    },
    base: {
        variants: ['base', 'base mainnet', 'coinbase chain'],
        supportsNativeEth: true,
    },
}

// utility fn to normalize chain names
export function normalizeChainName(chainIdentifier: string): string {
    const normalized = chainIdentifier.toLowerCase().trim()

    // check each chain's variants
    for (const [standardName, config] of Object.entries(CHAIN_NAME_VARIANTS)) {
        if (config.variants.includes(normalized)) {
            return standardName
        }
    }

    // if no match found, return the original normalized string
    return normalized
}

// utility fn to check if a chain supports native ETH
export function supportsNativeEth(chainIdentifier: string): boolean {
    const normalized = normalizeChainName(chainIdentifier)
    return CHAIN_NAME_VARIANTS[normalized]?.supportsNativeEth ?? false
}
