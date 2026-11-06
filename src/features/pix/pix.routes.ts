/**
 * The neutral Pix entry points. The backend's route names the provider, and
 * these pages mount that provider's screens (`PixAddMoney`, `PixWithdraw`).
 */
export const PIX_ADD_MONEY_PATH = '/add-money/pix'
export const PIX_WITHDRAW_PATH = '/withdraw/pix'

/** The code screen of one deposit: the deposit read redraws its code from the id. */
export function pixDepositCodeUrl(intentId: string): string {
    return `${PIX_ADD_MONEY_PATH}?${new URLSearchParams({ step: 'showQR', intentId }).toString()}`
}

/** Whether a method path opens a neutral Pix page, which runs its own flow (like a Manteca page). */
export function isPixPagePath(path: string | undefined): boolean {
    return !!path && (path.startsWith(PIX_ADD_MONEY_PATH) || path.startsWith(PIX_WITHDRAW_PATH))
}

/** /withdraw/pix with a saved account's query (destination, isSavedAccount, sendMethod). Empty values are left out. */
export function pixWithdrawUrl(params: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
        if (value) search.set(key, value)
    }
    const query = search.toString()
    return query ? `${PIX_WITHDRAW_PATH}?${query}` : PIX_WITHDRAW_PATH
}
