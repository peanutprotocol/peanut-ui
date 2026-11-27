import { AccountType, type Account } from '@/interfaces/interfaces'
import { sendOffersPix } from '@/features/destinations/country-rails'
import { isPixAccount } from '@/features/destinations/saved-destinations'
import { PIX_SEND_PATH, PIX_WITHDRAW_PATH } from '@/features/pix/pix.routes'
import type { PixDraftFlow } from '@/features/pix/pixWithdrawDraft'
import type { PixKeySend } from '@/features/pix/pixRoute.utils'
import { mantecaWithdrawUrl } from '@/features/withdraw/routes'
import { SAVED_ACCOUNT_PARAM } from '@/features/withdraw/useSavedAccountParam'
import type { WithdrawMethod } from '@/features/withdraw/types'
import { isUsableSavedAccount } from '@/utils/bridge-accounts.utils'

/**
 * Where a saved bank account leads, for its two entries: a tap in the saved
 * accounts list (WithdrawMethodView) and "Withdraw again" or "Send again" on a
 * payout's receipt (TASK-25462). One table, so both entries always agree.
 */

/** Withdraw, or Send → Bank (`useSendFlowOrigin`), and how Send pays a Pix key. */
export interface SavedAccountContext {
    isBankFromSend: boolean
    pixKeySend: PixKeySend
    /** Send's `method` marker, carried into the Manteca route. */
    sendMethod?: string | null
    /** A USD amount to start from ("Withdraw again"); the Manteca flow converts it. */
    amount?: string
}

const BANK_ACCOUNT_TYPES: ReadonlySet<string> = new Set([
    AccountType.IBAN,
    AccountType.US,
    AccountType.CLABE,
    AccountType.GB,
    AccountType.CO_BANK_TRANSFER,
    AccountType.MANTECA,
])

/** A saved bank account this screen offers. Someone else's Pix key is paid from Send, never withdrawn to. */
export function isOfferedSavedAccount(account: Account, ctx: SavedAccountContext): boolean {
    if (!BANK_ACCOUNT_TYPES.has(account.type) || !isUsableSavedAccount(account)) return false
    // Send lists a saved Pix destination only while it offers Pix to this user (sendOffersPix).
    return ctx.isBankFromSend ? sendOffersPix(ctx.pixKeySend.block) || !isPixAccount(account) : !account.isPixRecipient
}

/** The method the withdraw flow context holds, and the screen that comes next. */
export interface SavedAccountRoute {
    method: WithdrawMethod
    next:
        | { kind: 'pix'; flow: PixDraftFlow; path: string } // the key goes in the account's draft, never the URL
        | { kind: 'manteca'; url: string } // the Manteca flow collects the amount in the local currency
        | { kind: 'amount' } // the shared amount step
}

/**
 * The Pix-key form a Brazilian destination opens, or null when Send pays the
 * key elsewhere (the Manteca pay route). The user's own key: the withdrawal
 * page, where the backend's route picks the provider. Someone else's key, on a
 * withdraw route that pays any key (Avenia): the same form, from Send.
 */
export function pixKeyRoute(ctx: Pick<SavedAccountContext, 'isBankFromSend' | 'pixKeySend'>): {
    flow: PixDraftFlow
    path: string
} | null {
    if (!ctx.isBankFromSend) return { flow: 'withdraw', path: PIX_WITHDRAW_PATH }
    if (ctx.pixKeySend.via === 'withdraw') return { flow: 'send', path: PIX_SEND_PATH }
    return null
}

export function savedAccountRoute(
    account: Account,
    path: string | undefined,
    ctx: SavedAccountContext
): SavedAccountRoute {
    const countryPath = account.details?.countryName || path || ''
    if (account.type !== AccountType.MANTECA) {
        return { method: { type: 'bridge', countryPath, title: 'To Bank' }, next: { kind: 'amount' } }
    }
    const method: WithdrawMethod = { type: 'manteca', countryPath, title: 'To Bank' }
    const pix = countryPath === 'brazil' ? pixKeyRoute(ctx) : null
    if (pix) return { method, next: { kind: 'pix', ...pix } }
    return {
        method,
        next: {
            kind: 'manteca',
            url: mantecaWithdrawUrl({
                country: countryPath,
                // the account's id, never its CBU, alias or key (`SAVED_ACCOUNT_PARAM`)
                [SAVED_ACCOUNT_PARAM]: account.id,
                method: ctx.isBankFromSend && countryPath === 'brazil' ? 'pix' : undefined,
                sendMethod: ctx.isBankFromSend ? (ctx.sendMethod ?? undefined) : undefined,
                amount: ctx.amount,
            }),
        },
    }
}
