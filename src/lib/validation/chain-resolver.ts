type ChainNameMapping = {
    [key: string]: string[]
}

// mapping of normalized chain identifiers to their variations
export const CHAIN_NAME_VARIANTS: ChainNameMapping = {
    optimism: ['optimism', 'op', 'op mainnet', 'optimism mainnet'],
    arbitrum: ['arbitrum', 'arbitrum one', 'arbitrum mainnet'],
    polygon: ['polygon', 'polygon pos', 'matic', 'polygon mainnet'],
    base: ['base', 'base mainnet', 'coinbase chain'],
}

// utility fn to normalize chain names
export function normalizeChainName(chainIdentifier: string): string {
    const normalized = chainIdentifier.toLowerCase().trim()

    // check each chain's variants
    for (const [standardName, variants] of Object.entries(CHAIN_NAME_VARIANTS)) {
        if (variants.includes(normalized)) {
            return standardName
        }
    }

    // if no match found, return the original normalized string
    return normalized
}
