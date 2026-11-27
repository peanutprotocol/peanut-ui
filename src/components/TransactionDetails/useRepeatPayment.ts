'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/authContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { offerRepeatDraft } from '@/features/payments/shared/repeat-draft'
import { EMPTY_PIX_WITHDRAW_DRAFT, keepPixWithdrawDraft } from '@/features/pix/pixWithdrawDraft'
import { usePixKeySend } from '@/features/pix/usePixKeySend'
import { withdrawAmountStepUrl } from '@/features/withdraw/routes'
import { isOfferedSavedAccount, savedAccountRoute } from '@/features/withdraw/saved-account-route'
import { type Account } from '@/interfaces/interfaces'
import { useNativePlatform } from '@/utils/native-platform'
import { sendUrl } from '@/utils/native-routes'
import { trackReceiptAction } from './receipt-action-analytics'
import { type ReceiptMoreAction } from './ReceiptMoreActionsDrawer'
import { payoutAgainDestination, sendAgainUsername } from './transaction-predicates'
import { type TransactionDetails } from './transactionTransformer'

/** Bank identifiers as people and providers write them: spaces and case vary. */
const sameIdentifier = (a: string, b: string) =>
    a.replace(/\s+/g, '').toLowerCase() === b.replace(/\s+/g, '').toLowerCase()

/**
 * The More actions row that repeats a completed payment (TASK-25462), or
 * null. It is the first row: the receipt keeps one primary and the More
 * actions button (Hugo, 2026-11-27). The tap opens the screen that
 * made it opens with the same recipient and amount (and note, for a send to a
 * Peanut user) as an editable suggestion. Nothing moves until the user
 * confirms there, through that screen's own gates. A payout repeats only to a
 * saved account the withdraw screen would offer, by the same route a tap on
 * that account takes (`savedAccountRoute`).
 */
export function useRepeatPayment(
    transaction: TransactionDetails,
    { isPublic, onSelect }: { isPublic: boolean; onSelect?: () => void }
): ReceiptMoreAction | null {
    const router = useRouter()
    const t = useAppTranslations('transaction')
    const native = useNativePlatform()
    const { user } = useAuth()
    const pixKeySend = usePixKeySend()
    const amount = String(Math.round(Number(transaction.amount) * 100) / 100)
    const kind = transaction.extraDataForDrawer?.kind

    if (isPublic) return null
    const row = { icon: 'retry' as const, 'data-testid': 'more-action-repeat' }

    const username = sendAgainUsername(transaction)
    if (username) {
        return {
            ...row,
            title: t('actions.sendAgain'),
            onSelect: () => {
                onSelect?.()
                trackReceiptAction('send_again', 'more_actions', kind)
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
        ...row,
        title: t(payout.isSend ? 'actions.sendAgain' : 'actions.withdrawAgain'),
        onSelect: () => {
            onSelect?.()
            trackReceiptAction(payout.isSend ? 'send_again' : 'withdraw_again', 'more_actions', kind)
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
