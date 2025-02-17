export interface TokenInfo {
    symbol: string
    name: string
    decimals: number
    addresses: Record<number, string> // chainId -> address mapping
    logoURI?: string
    minAmount?: string
    maxAmount?: string
}
