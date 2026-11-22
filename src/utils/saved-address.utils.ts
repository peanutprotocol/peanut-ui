import { isAddress } from 'viem'
import { printableAddress } from '@/utils/general.utils'
import { daysDifference } from '@/utils/dateGrouping.utils'

export const SAVED_ADDRESS_NICKNAME_MAX = 15

/** Mirrors the BE storage canon: lowercase hex, verbatim base58 (Tron/Solana). */
export function normalizeSavedAddress(address: string): string {
    const trimmed = address.trim()
    return trimmed.slice(0, 2).toLowerCase() === '0x' ? trimmed.toLowerCase() : trimmed
}

/** Lookup key for (chain, address) — same shape the BE uses to join nicknames. */
export function savedAddressKey(chainId: string | number, address: string): string {
    // chain ids arrive as strings from the BE but as numbers from some chain
    // metadata objects — coerce so a numeric 42161 and '42161' share one key
    return `${String(chainId).trim().toLowerCase()}:${normalizeSavedAddress(address)}`
}

/** "Binance · ...aeC9" — nickname plus the last 4 chars so two entries never look alike. */
export function savedAddressLabel(nickname: string, address: string): string {
    return `${nickname} · ...${address.slice(-4)}`
}

/** "0x1234...abcd" — head 6 for hex, 4 for base58, tail 4: enough that an address-poisoning lookalike stands out. */
export function shortSavedAddress(address: string): string {
    return printableAddress(address, isAddress(address) ? 6 : 4, 4)
}

/** Calendar days since `iso` in the device's time zone, so "yesterday" is the day before today (TASK-23927). */
export function daysSince(iso: string, now: Date = new Date()): number {
    return Math.max(0, daysDifference(now, new Date(iso)))
}
