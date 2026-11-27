'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { offerRepeatDraft } from '@/features/payments/shared/repeat-draft'
import { EMPTY_PIX_WITHDRAW_DRAFT, keepPixWithdrawDraft } from '@/features/pix/pixWithdrawDraft'
import { usePixKeySend } from '@/features/pix/usePixKeySend'
import { withdrawAmountStepUrl } from '@/features/withdraw/routes'
import { isOfferedSavedAccount, savedAccountRoute } from '@/features/withdraw/saved-account-route'
import { type Account } from '@/interfaces/interfaces'
import { useNativePlatform } from '@/utils/native-platform'
import { sendUrl } from '@/utils/native-routes'
import { trackReceiptAction } from './receipt-action-analytics'
import { payoutAgainDestination, sendAgainUsername } from './transaction-predicates'
import { type TransactionDetails } from './transactionTransformer'

export interface RepeatPayment {
    labelKey: 'actions.sendAgain' | 'actions.withdrawAgain'
    run: () => void
}

/** Bank identifiers as people and providers write them: spaces and case vary. */
const sameIdentifier = (a: string, b: string) =>
    a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()

/**
 * Repeats a completed payment from its receipt (TASK-25462): the screen that
 * made it opens with the same recipient and amount (and note, for a send to a
 * Peanut user) as an editable suggestion. Nothing moves until the user
 * confirms there, through that screen's own gates. A payout repeats only to a
 * saved account the withdraw screen would offer, by the same route a tap on
 * that account takes (`savedAccountRoute`).
 */
export function useRepeatPayment(transaction: TransactionDetails): RepeatPayment | null {
    const router = useRouter()
    const native = useNativePlatform()
    const { user } = useAuth()
    const pixKeySend = usePixKeySend()
    const amount = String(Math.round(Number(transaction.amount) * 100) / 100)
    const kind = transaction.extraDataForDrawer?.kind

    const username = sendAgainUsername(transaction)
    if (username) {
        return {
            labelKey: 'actions.sendAgain',
            run: () => {
                trackReceiptAction('send_again', 'secondary', kind)
                offerRepeatDraft({ to: 'user', username, amount, message: transaction.memo || undefined })
                router.push(sendUrl(username, native.isCapacitor))
            },
        }
    }

    const payout = payoutAgainDestination(transaction)
    if (!payout) return null
    const ctx = {
        isBankFromSend: payout.isSend,
        pixKeySend,
        sendMethod: payout.isSend ? 'bank' : null,
        amount,
    }
    const account = ((user?.accounts ?? []) as unknown as Account[]).find(
        (acc) => isOfferedSavedAccount(acc, ctx) && sameIdentifier(acc.identifier, payout.identifier)
    )
    if (!account) return null

    return {
        labelKey: payout.isSend ? 'actions.sendAgain' : 'actions.withdrawAgain',
        run: () => {
            trackReceiptAction(payout.isSend ? 'send_again' : 'withdraw_again', 'secondary', kind)
            const { method, next } = savedAccountRoute(account, undefined, ctx)
            if (next.kind === 'pix') {
                keepPixWithdrawDraft(user?.user?.userId, next.flow, {
                    ...EMPTY_PIX_WITHDRAW_DRAFT,
                    destination: account.identifier,
                    amountUsd: amount,
                })
                router.push(next.path)
                return
            }
            if (next.kind === 'manteca') {
                router.push(next.url)
                return
            }
            offerRepeatDraft({ to: 'bank', account, method })
            router.push(withdrawAmountStepUrl({ method: ctx.sendMethod, amount }))
        },
    }
}
