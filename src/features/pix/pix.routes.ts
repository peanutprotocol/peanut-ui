/**
 * The neutral Pix entry points. The backend's route picks the provider, and
 * these pages mount the one Pix flow for it (`PixAddMoney`, `PixWithdraw`).
 */
export const PIX_ADD_MONEY_PATH = '/add-money/pix'
export const PIX_WITHDRAW_PATH = '/withdraw/pix'

/** The code screen of one deposit: the deposit read redraws its code from the id. */
export function pixDepositCodeUrl(intentId: string): string {
    return `${PIX_ADD_MONEY_PATH}?${new URLSearchParams({ step: 'showQR', intentId }).toString()}`
}

/** Whether a method path opens a neutral Pix page, which runs its own flow. */
export function isPixPagePath(path: string | undefined): boolean {
    return !!path && (path.startsWith(PIX_ADD_MONEY_PATH) || path.startsWith(PIX_WITHDRAW_PATH))
}

/** /withdraw/pix with a saved Pix key in the key step (`?destination=`). */
export function pixWithdrawUrl(pixKey: string): string {
    return `${PIX_WITHDRAW_PATH}?${new URLSearchParams({ destination: pixKey }).toString()}`
}
