/**
 * Token-first derivation for the token selector (TASK-23392): which tokens the
 * selector offers, which networks carry each one, their order, the default
 * network and the fee label. Pure functions over the chain/token record the
 * selector already reads, so the rules are tested here and not per screen.
 */

import {
    PEANUT_WALLET_CHAIN,
    PEANUT_WALLET_TOKEN,
    PEANUT_WALLET_TOKEN_DECIMALS,
    PEANUT_WALLET_TOKEN_NAME,
    PEANUT_WALLET_TOKEN_SYMBOL,
} from '@/constants/zerodev.consts'
import type { ChainWithTokens } from '@/interfaces/chain-meta'
import type { IToken } from '@/interfaces/interfaces'
import { areEvmAddressesEqual } from '@/utils/general.utils'

export const WALLET_CHAIN_ID = PEANUT_WALLET_CHAIN.id.toString()
// Arbitrum leads every network list; the wallet chain first (it differs from
// Arbitrum One only on a sandbox wallet, which runs on Arb Sepolia)
const PREFERRED_CHAIN_IDS = [WALLET_CHAIN_ID, '42161']
const preferredRank = (chainId: string) => {
    const i = PREFERRED_CHAIN_IDS.indexOf(chainId)
    return i === -1 ? PREFERRED_CHAIN_IDS.length : i
}

// logo for the synthesized wallet-chain entry (sandbox runs on Arb Sepolia,
// which the mainnet-only chain record does not list)
const USDC_LOGO = 'https://assets.coingecko.com/coins/images/33000/thumb/usdc.png?1700119918'
const ARBITRUM_LOGO = 'https://assets.coingecko.com/asset_platforms/images/33/standard/AO_logomark.png?1706606717'

/**
 * THE rule for "No fee" vs "Network fee", in the selector and on the withdraw
 * amount screen. Only same-chain USDC on the Peanut wallet chain is free
 * today: every other route is a Rhino transfer, and Base, BNB, Polygon,
 * Optimism and Plasma still charge cents until the Rhino config change in
 * TASK-23632. When that ships, widen this one function.
 */
export function isFeeFreeRoute(chainId: string, tokenAddress: string): boolean {
    return chainId === WALLET_CHAIN_ID && tokenAddress.toLowerCase() === PEANUT_WALLET_TOKEN.toLowerCase()
}

export interface NetworkOption {
    chainId: string
    name: string
    iconUrl: string
    /** the token's record on this chain — its address is what gets selected */
    token: IToken
    isFree: boolean
}

export interface TokenOption {
    symbol: string
    name: string
    logoURI: string
    /** sorted: free first, the wallet chain (Arbitrum) next, then input order */
    networks: NetworkOption[]
}

/**
 * The record plus the wallet chain when the record does not list it. The
 * record is mainnet-only, so a sandbox wallet on Arb Sepolia would otherwise
 * have no network to select.
 */
export function withWalletChain(chains: Record<string, ChainWithTokens>): Record<string, ChainWithTokens> {
    if (chains[WALLET_CHAIN_ID]) return chains
    return {
        ...chains,
        [WALLET_CHAIN_ID]: {
            chainId: WALLET_CHAIN_ID,
            networkName: PEANUT_WALLET_CHAIN.name,
            chainIconURI: ARBITRUM_LOGO,
            tokens: [
                {
                    chainId: WALLET_CHAIN_ID,
                    address: PEANUT_WALLET_TOKEN,
                    name: PEANUT_WALLET_TOKEN_NAME,
                    symbol: PEANUT_WALLET_TOKEN_SYMBOL,
                    decimals: PEANUT_WALLET_TOKEN_DECIMALS,
                    logoURI: USDC_LOGO,
                },
            ],
        },
    }
}

// stablecoins lead the token list, the rest follow alphabetically
const TOKEN_RANK = ['USDC', 'USDT']
const tokenRank = (symbol: string) => {
    const i = TOKEN_RANK.indexOf(symbol)
    return i === -1 ? TOKEN_RANK.length : i
}

/**
 * Group the allowed (chain, token) pairs by token symbol.
 *
 * @param chainIds the networks to consider, in display order (registry order for withdraw)
 * @param isAllowed whether this token on this chain may be selected
 */
export function buildTokenOptions(
    chains: Record<string, ChainWithTokens>,
    chainIds: readonly string[],
    isAllowed: (chainId: string, token: IToken) => boolean
): TokenOption[] {
    const bySymbol = new Map<string, NetworkOption[]>()
    for (const chainId of chainIds) {
        const chain = chains[chainId]
        if (!chain) continue
        const seen = new Set<string>()
        for (const token of chain.tokens) {
            const symbol = token.symbol.toUpperCase()
            // one row per symbol per chain: the record lists the canonical
            // token before bridged variants (USDC before USDC.e), keep that one
            if (seen.has(symbol) || !isAllowed(chainId, token)) continue
            seen.add(symbol)
            const networks = bySymbol.get(symbol) ?? []
            networks.push({
                chainId,
                name: chain.networkName || `Chain ${chainId}`,
                iconUrl: chain.chainIconURI,
                token,
                isFree: isFeeFreeRoute(chainId, token.address),
            })
            bySymbol.set(symbol, networks)
        }
    }

    return Array.from(bySymbol, ([symbol, networks]) => {
        const sorted = sortNetworks(networks)
        return { symbol, name: sorted[0].token.name, logoURI: sorted[0].token.logoURI, networks: sorted }
    }).sort((a, b) => tokenRank(a.symbol) - tokenRank(b.symbol) || a.symbol.localeCompare(b.symbol))
}

/** free first, then Arbitrum, then the order given (Array.sort is stable) */
export function sortNetworks(networks: NetworkOption[]): NetworkOption[] {
    return [...networks].sort(
        (a, b) => Number(b.isFree) - Number(a.isFree) || preferredRank(a.chainId) - preferredRank(b.chainId)
    )
}

/**
 * A row in the network drawer. `network` is what a tap selects: the selected
 * token on this chain, or, when the chain does not carry it, the first
 * offered token that it does (`otherToken`).
 */
export interface NetworkRow {
    network: NetworkOption
    otherToken: boolean
}

/**
 * Every network the selector offers, for the network drawer: the token's own
 * networks first (in their order), then the networks that do not carry it.
 * Those stay tappable and switch the token too (TASK-24035): a disabled Tron
 * row under USDC was a dead end, with nothing saying USDT is the way there.
 * Support comes from the token/chain list alone, never from price data.
 */
export function networkRowsForToken(options: TokenOption[], option: TokenOption | undefined): NetworkRow[] {
    const rows: NetworkRow[] = (option?.networks ?? []).map((network) => ({ network, otherToken: false }))
    const seen = new Set(rows.map((r) => r.network.chainId))
    // options are in token order, so a chain gets the first token it carries (USDC, USDT, then A-Z)
    for (const other of options) {
        for (const network of other.networks) {
            if (seen.has(network.chainId)) continue
            seen.add(network.chainId)
            rows.push({ network, otherToken: true })
        }
    }
    return rows
}

/** the network pills under a token row: the first two, then a count of the rest */
export function splitNetworkBadges(networks: NetworkOption[]): { shown: NetworkOption[]; rest: number } {
    return { shown: networks.slice(0, 2), rest: Math.max(0, networks.length - 2) }
}

/**
 * The network to use after picking a token: the current one when it carries
 * the token, else the wallet chain (Arbitrum) when it does, else the first in order.
 */
export function pickDefaultNetwork(option: TokenOption, currentChainId?: string): NetworkOption {
    return (
        option.networks.find((n) => n.chainId === currentChainId) ??
        option.networks.find((n) => PREFERRED_CHAIN_IDS.includes(n.chainId)) ??
        option.networks[0]
    )
}

// EVM addresses compare case-insensitively (and native-proxy aliased);
// base58 (Solana/Tron) is case-significant, so it needs exact equality
const sameAddress = (a: string, b: string) => a === b || areEvmAddressesEqual(a, b)

/** the option + network for the selected pair, or undefined when the pair is not offered */
export function findSelection(
    options: TokenOption[],
    chainId: string,
    tokenAddress: string
): { option: TokenOption; network: NetworkOption } | undefined {
    if (!chainId || !tokenAddress) return undefined
    for (const option of options) {
        const network = option.networks.find((n) => n.chainId === chainId && sameAddress(n.token.address, tokenAddress))
        if (network) return { option, network }
    }
    return undefined
}

/**
 * A valid pair to fall back to when the selected one is not offered: the
 * same token on its default network if that token is offered, else the
 * first token. Undefined only when nothing is offered at all.
 */
export function fallbackSelection(
    options: TokenOption[],
    chains: Record<string, ChainWithTokens>,
    chainId: string,
    tokenAddress: string
): { option: TokenOption; network: NetworkOption } | undefined {
    if (options.length === 0) return undefined
    const symbol = chains[chainId]?.tokens
        .find((t) => tokenAddress && sameAddress(t.address, tokenAddress))
        ?.symbol.toUpperCase()
    const option = options.find((o) => o.symbol === symbol) ?? options[0]
    return { option, network: pickDefaultNetwork(option, chainId) }
}

export function filterTokenOptions(options: TokenOption[], query: string): TokenOption[] {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((o) => o.symbol.toLowerCase().includes(q) || o.name.toLowerCase().includes(q))
}

export function filterNetworks(rows: NetworkRow[], query: string): NetworkRow[] {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.network.name.toLowerCase().includes(q))
}
