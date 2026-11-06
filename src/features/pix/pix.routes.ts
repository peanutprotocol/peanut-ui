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
