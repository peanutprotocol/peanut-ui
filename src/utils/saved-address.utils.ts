import { isAddress } from 'viem'

export const SAVED_ADDRESS_NICKNAME_MAX = 15

/** Mirrors the BE storage canon: lowercase hex, verbatim base58 (Tron/Solana). */
export function normalizeSavedAddress(address: string): string {
    const trimmed = address.trim()
    return trimmed.slice(0, 2).toLowerCase() === '0x' ? trimmed.toLowerCase() : trimmed
}

/** Lookup key for (chain, address) — same shape the BE uses to join nicknames. */
export function savedAddressKey(chainId: string, address: string): string {
    return `${chainId.trim().toLowerCase()}:${normalizeSavedAddress(address)}`
}

/** "Binance · …aeC9" — nickname plus the last 4 chars so two entries never look alike. */
export function savedAddressLabel(nickname: string, address: string): string {
    return `${nickname} · …${address.slice(-4)}`
}

/** "0x1234…abcd" — 4+4 so an address-poisoning lookalike is harder to pass off. */
export function shortSavedAddress(address: string): string {
    if (address.length <= 12) return address
    return `${address.slice(0, isAddress(address) ? 6 : 4)}…${address.slice(-4)}`
}

export type LastUsedTone = 'recent' | 'aging' | 'stale'

export function daysSince(iso: string, now: Date = new Date()): number {
    const ms = now.getTime() - new Date(iso).getTime()
    return Math.max(0, Math.floor(ms / 86_400_000))
}

/** <7d green, 7–30d orange, 30+ red — exchanges rotate deposit addresses. */
export function lastUsedTone(days: number): LastUsedTone {
    if (days < 7) return 'recent'
    if (days <= 30) return 'aging'
    return 'stale'
}
