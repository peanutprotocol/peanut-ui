import type { AvailabilityItemKey } from '@/utils/residence-availability'

/** One line of a compare column, as a `setupRedesign.residence.*` key; the bank account names its ISO codes. */
export type CompareItem =
    | { key: 'itemPix' | 'itemArQr' | 'itemBank' | 'itemCard' | 'itemP2p' }
    | { key: 'itemBankAccount'; currencies: string[] }

/** The per-currency bank rails, shown together as one "Bank account" item (as dev's ResidenceCompare). */
const BANK_ACCOUNT_CURRENCY: Partial<Record<AvailabilityItemKey, string>> = {
    usdAch: 'USD',
    eurSepa: 'EUR',
    gbpFps: 'GBP',
    spei: 'MXN',
}
const ITEM_KEY: Partial<Record<AvailabilityItemKey, Exclude<CompareItem['key'], 'itemBankAccount'>>> = {
    pix: 'itemPix',
    arQr: 'itemArQr',
    bank: 'itemBank',
    card: 'itemCard',
}

/**
 * What a compare column lists, from `residenceAvailability(...).available`: the local rail first, then one bank
 * account item at the first bank rail's place with every served currency in the served order, then the card;
 * Peanut to Peanut last. What the residence rules out is absent.
 */
export function compareItemsOf(available: readonly AvailabilityItemKey[]): CompareItem[] {
    const currencies = available.flatMap((item) => BANK_ACCOUNT_CURRENCY[item] ?? [])
    const items: CompareItem[] = []
    for (const item of available) {
        if (item === 'p2p') continue
        if (BANK_ACCOUNT_CURRENCY[item]) {
            if (!items.some((listed) => listed.key === 'itemBankAccount'))
                items.push({ key: 'itemBankAccount', currencies })
            continue
        }
        const key = ITEM_KEY[item]
        if (key) items.push({ key })
    }
    return [...items, { key: 'itemP2p' }]
}

/**
 * "USD or EUR", "MXN, USD, EUR or GBP": the locale's disjunction list, English without the serial comma (dev's
 * formatOrList). The last code keeps its conjunction on its line ("EUR or GBP" never breaks).
 */
export function formatCurrencyList(locale: string, codes: readonly string[]): string {
    const listLocale = locale.toLowerCase().startsWith('en') ? 'en-GB' : locale
    const list = new Intl.ListFormat(listLocale, { type: 'disjunction' }).format(codes)
    return list.replace(/ (\S+) (\S+)$/, ' $1 $2')
}

/** The visible lines of a column; `t` is scoped to `setupRedesign.residence`. */
export function compareItemLabels(
    items: readonly CompareItem[],
    t: (key: CompareItem['key'], values?: { currencies: string }) => string,
    locale: string
): string[] {
    return items.map((item) =>
        item.key === 'itemBankAccount'
            ? t(item.key, { currencies: formatCurrencyList(locale, item.currencies) })
            : t(item.key)
    )
}

/** Equal columns say nothing about which country to pick, so the view hides both lists. */
export const sameLabels = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((label, index) => label === b[index])
