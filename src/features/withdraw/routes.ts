/** Route builders for the withdraw flow's cross-route navigations. */

/**
 * Where Back from a withdraw destination lands with no in-app history: the
 * withdraw entry. It shows the saved destinations when the user has any, and
 * the full method list otherwise. `?showAll=true` skipped the saved addresses.
 */
export const WITHDRAW_BACK_FALLBACK_URL = '/withdraw'

import { withdrawCountryUrl } from '@/utils/native-routes'

/**
 * /withdraw/manteca with its query contract (method, country, amount,
 * destination, isSavedAccount). Undefined/empty values are omitted.
 */
export function mantecaWithdrawUrl(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value)
    }
    const qs = search.toString()
    return qs ? `/withdraw/manteca?${qs}` : '/withdraw/manteca'
}

/**
 * The root /withdraw amount step — the last thing the user fills in. The send
 * marker rides along so the step keeps its send copy, and an amount already in
 * the URL (an old link, or a back-navigation) is preserved.
 */
export function withdrawAmountStepUrl({ method, amount }: { method?: string | null; amount?: string | null }): string {
    const search = new URLSearchParams({ step: 'amount' })
    if (method) search.set('method', method)
    if (amount) search.set('amount', amount)
    return `/withdraw?${search.toString()}`
}

/**
 * The bank-account form for a country, named in the URL rather than implied.
 * A USD amount picked upstream (Rates & fees) rides along; the form hands it
 * to the amount step once the account is saved.
 */
export function withdrawCountryFormUrl(countryPath: string, method?: string | null, amount?: string | null): string {
    const search = new URLSearchParams({ step: 'form' })
    if (method) search.set('method', method)
    if (amount) search.set('amount', amount)
    return withdrawCountryUrl(countryPath, `?${search.toString()}`)
}
