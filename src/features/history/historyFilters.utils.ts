import { type TransactionType } from '@/components/TransactionDetails/transaction-types'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

/**
 * The Activity filter pills. One pill per question a person asks of their
 * feed ("what did I send?", "what came in from my bank?"), not one per row
 * type: the row types are an implementation vocabulary (bank_claim,
 * claim_external, …) nobody filters by.
 */
export const HISTORY_FILTERS = ['all', 'sent', 'received', 'payments', 'added', 'withdrawn', 'requests'] as const
export type HistoryFilter = (typeof HISTORY_FILTERS)[number]

const FILTER_BY_TYPE = {
    send: 'sent',
    receive: 'received',
    refund: 'received',
    pay: 'payments',
    card_pay: 'payments',
    add: 'added',
    bank_deposit: 'added',
    withdraw: 'withdrawn',
    cashout: 'withdrawn',
    bank_withdraw: 'withdrawn',
    bank_claim: 'withdrawn',
    claim_external: 'withdrawn',
    request: 'requests',
    bank_request_fulfillment: 'requests',
} as const satisfies Record<TransactionType, Exclude<HistoryFilter, 'all'>>

export function isHistoryFilter(value: string | null | undefined): value is HistoryFilter {
    return !!value && (HISTORY_FILTERS as readonly string[]).includes(value)
}

export function matchesHistoryFilter(type: TransactionType, filter: HistoryFilter): boolean {
    return filter === 'all' || FILTER_BY_TYPE[type] === filter
}

/** Lowercased and accent-free, so "envio" finds "Envío" and "joao" finds "João". */
export function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase()
        .trim()
}

export type SearchableDetails = Pick<
    TransactionDetails,
    'userName' | 'fullName' | 'showFullName' | 'nameDetail' | 'memo' | 'amount' | 'currency'
>

export interface HistorySearchOptions {
    /** what the row shows as its name: the localized label, or the ENS name for an address */
    displayName?: string
    /** off while balances are hidden: matching on a masked amount would reveal it */
    matchAmounts?: boolean
}

/**
 * Whether a row matches the search box. Matches what the row SHOWS (its
 * display name, passed in, since the list owns the translator and the ENS
 * cache) plus what a person remembers about a payment: the memo, the local
 * currency and the amount. A full name only counts when its owner shows it —
 * otherwise a search would confirm a name the row hides.
 *
 * Amounts match on their digits, so "45" finds $45.00 and "1200" finds
 * "1,200.00" in any locale's grouping.
 */
export function matchesHistorySearch(
    details: SearchableDetails,
    query: string,
    { displayName, matchAmounts = true }: HistorySearchOptions = {}
): boolean {
    const words = normalizeSearchText(query).split(/\s+/).filter(Boolean)
    if (!words.length) return true

    const haystack = [
        displayName,
        details.userName,
        details.showFullName ? details.fullName : undefined,
        details.nameDetail,
        details.memo,
        details.currency?.code,
    ]
        .filter((part): part is string => !!part)
        .map(normalizeSearchText)
    // both sides as cents digits: "45", "45.00" and "45,0" all find 45
    const amounts = matchAmounts
        ? [Number(details.amount), Number(details.currency?.amount)]
              .filter((amount) => Number.isFinite(amount) && amount !== 0)
              .map((amount) => Math.abs(amount).toFixed(2).replace('.', ''))
        : []

    // every word has to match somewhere: "joao envio" finds "Envío a João"
    return words.every((word) => {
        if (haystack.some((part) => part.includes(word))) return true
        const digits = word.replace(/[$.,]/g, '')
        return /^\d+$/.test(digits) && amounts.some((amount) => amount.startsWith(digits))
    })
}

/** A feed row as the filters see it; null for a timeline marker (badge, identity check). */
export type SearchableRow = { type: TransactionType; details: SearchableDetails; displayName?: string } | null

/**
 * Applies the pill and the search to the feed. Markers never pass a filter.
 * `hasMatchesInAll` says whether the search alone (pill lifted) would find
 * rows, so an empty pill can offer "search all activity" instead of a reset.
 */
export function filterHistoryRows<T>(
    rows: T[],
    toSearchable: (row: T) => SearchableRow,
    filter: HistoryFilter,
    query: string,
    { matchAmounts = true }: Pick<HistorySearchOptions, 'matchAmounts'> = {}
): { visible: T[]; hasMatchesInAll: boolean } {
    const matches = (row: T, pill: HistoryFilter) => {
        const searchable = toSearchable(row)
        if (!searchable || !matchesHistoryFilter(searchable.type, pill)) return false
        return matchesHistorySearch(searchable.details, query, {
            displayName: searchable.displayName,
            matchAmounts,
        })
    }
    const visible = rows.filter((row) => matches(row, filter))
    return {
        visible,
        hasMatchesInAll: visible.length > 0 || (filter !== 'all' && rows.some((row) => matches(row, 'all'))),
    }
}
