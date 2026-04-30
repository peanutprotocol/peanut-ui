/**
 * Chain + token metadata shapes used by the token selector, validation,
 * and url-parser surfaces. Sourced locally from `app/actions/supported-chains.ts`
 * (no live third-party API call) since cross-chain settlement moved to Rhino SDA.
 */

export interface ChainMeta {
    chainId: string
    chainIconURI: string
}

export interface TokenMeta {
    chainId: string
    address: string
    decimals: number
    name: string
    symbol: string
    logoURI: string
    usdPrice: number
}

/** Canonical chain record as returned by `getSupportedChainsAndTokens` —
 *  every consumer that reads chains-with-tokens expects this shape. */
export type ChainWithTokens = ChainMeta & { networkName: string; tokens: TokenMeta[] }
