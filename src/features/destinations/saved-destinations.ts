import { AccountType, type Account, type SavedAddress } from '@/interfaces/interfaces'
import { maskAccountIdentifier } from '@/utils/account-mask.utils'
import { savedAddressLabel } from '@/utils/saved-address.utils'

/**
 * One shape for everything a withdrawal can be sent to — a saved bank account
 * or a crypto address — so the picker rows, the sort and the edit drawer are
 * written once. The rows themselves live in two tables with two names for the
 * user's own name (`label` on accounts, `nickname` on addresses); an adapter
 * per table is where that difference stops.
 */
export interface SavedDestination {
    id: string
    /** The name the user gave it, or null. */
    name: string | null
    /** What it calls itself when the user gave it no name. */
    autoName: string
    /** The masked identifier, shown under the name. */
    identifier: string
    lastUsedAt: string | null
    createdAt: string
}

/** The one name a destination shows: the user's, or the one it makes for itself. */
export function destinationLabel(destination: SavedDestination): string {
    const given = destination.name?.trim()
    return given || destination.autoName
}

/**
 * Newest use first. A destination that has never been used sorts after every
 * one that has — a never-used account is not a recent one — and ties fall back
 * to the newest added.
 */
export function byMostRecentlyUsed(a: SavedDestination, b: SavedDestination): number {
    const used = time(b.lastUsedAt) - time(a.lastUsedAt)
    if (used !== 0) return used
    return time(b.createdAt) - time(a.createdAt)
}

function time(iso: string | null): number {
    if (!iso) return 0
    const value = new Date(iso).getTime()
    return Number.isNaN(value) ? 0 : value
}

const LAST_FOUR = (identifier: string): string => identifier.replace(/\s+/g, '').slice(-4)

/**
 * Argentine virtual wallets (Mercado Pago among them) are issued CVUs, which
 * carry the virtual-entity code `000` where a bank CBU carries the bank's own.
 * It is the only thing on the wire that separates the two.
 */
const isCvu = (identifier: string): boolean => /^000\d{19}$/.test(identifier.replace(/\s+/g, ''))

// Not translatable copy — it is the brand the user chose to send money to.
const MERCADO_PAGO = 'Mercado Pago'
const PIX = 'PIX'

/**
 * A saved bank account as a destination. `countryName` is the display name the
 * caller already resolved for the user's locale; it is the fallback when the
 * account carries no bank name.
 */
export function accountDestination(account: Account, { countryName }: { countryName: string }): SavedDestination {
    return {
        id: account.id,
        name: account.label ?? null,
        autoName: accountAutoName(account, countryName),
        identifier: maskAccountIdentifier(account.identifier, account.type),
        lastUsedAt: account.lastUsedAt ?? null,
        createdAt: account.createdAt,
    }
}

function accountAutoName(account: Account, countryName: string): string {
    const place = account.details?.bankName || countryName
    if (account.type !== AccountType.MANTECA) return `${place} · ${LAST_FOUR(account.identifier)}`

    // Manteca projects AR and BR destinations under one type, so the country
    // and the identifier's shape are what tell them apart.
    const country = (account.details?.countryName ?? '').toLowerCase()
    if (country === 'brazil') return `${PIX} · ${maskAccountIdentifier(account.identifier, 'PIX')}`
    if (isCvu(account.identifier)) return `${MERCADO_PAGO} · ${LAST_FOUR(account.identifier)}`
    // an alias is the name the user picked at their own bank — show it whole
    if (!/^\d+$/.test(account.identifier)) return `${place} · ${account.identifier}`
    return `${place} · ${LAST_FOUR(account.identifier)}`
}

/** A crypto address-book entry as a destination. */
export function savedAddressDestination(saved: SavedAddress): SavedDestination {
    return {
        id: saved.id,
        name: saved.nickname || null,
        autoName: savedAddressLabel(saved.nickname, saved.address),
        identifier: saved.address,
        lastUsedAt: saved.lastUsedAt ?? null,
        createdAt: saved.createdAt,
    }
}
