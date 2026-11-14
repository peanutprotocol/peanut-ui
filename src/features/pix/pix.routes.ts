/**
 * The neutral Pix entry points. The backend's route picks the provider, and
 * these pages mount the one Pix flow for it (`PixAddMoney`, `PixWithdraw`).
 */
export const PIX_ADD_MONEY_PATH = '/add-money/pix'
export const PIX_WITHDRAW_PATH = '/withdraw/pix'
/** The Pix-key form as a send, where the withdraw route pays another person's key (`pixKeySend`). */
export const PIX_SEND_PATH = `${PIX_WITHDRAW_PATH}?sendMethod=bank`

/** The code screen of one deposit: the deposit read redraws its code from the id. */
export function pixDepositCodeUrl(intentId: string): string {
    return `${PIX_ADD_MONEY_PATH}?${new URLSearchParams({ step: 'showQR', intentId }).toString()}`
}

/** Whether a method path opens a neutral Pix page, which runs its own flow. */
export function isPixPagePath(path: string | undefined): boolean {
    return !!path && (path.startsWith(PIX_ADD_MONEY_PATH) || path.startsWith(PIX_WITHDRAW_PATH))
}
