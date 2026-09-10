/** Route builders for the withdraw flow's cross-route navigations. */

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
