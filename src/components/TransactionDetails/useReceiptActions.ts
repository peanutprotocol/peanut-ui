'use client'

import { useQueryClient } from '@tanstack/react-query'
import { captureException } from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import useClaimLink from '@/components/Claim/useClaimLink'
import { useToast } from '@/components/0_Bruddle/Toast'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { TRANSACTIONS } from '@/constants/query.consts'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useUserStore } from '@/redux/hooks'
import { chargesApi } from '@/services/charges'
import { requestsApi } from '@/services/requests'

/**
 * Receipt CTA side effects (DS 09). Views never import api modules — every
 * charges/requests/claim-link call the receipt's action buttons need lives
 * here. No state: loading/UI state stays in the view (ephemeral), server
 * state invalidates through the query client.
 */
export function useReceiptActions(transaction: TransactionDetails | null) {
    const queryClient = useQueryClient()
    const { fetchBalance } = useWallet()
    const { cancelLinkAndClaim, pollForClaimConfirmation } = useClaimLink()
    const { user } = useUserStore()
    const toast = useToast()
    const t = useTranslations('transaction')

    const invalidateTransactions = () => queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] })

    /** Requester closes their own request (pot → close, charge → cancel). */
    const closeRequest = async (): Promise<boolean> => {
        if (!transaction) return false
        try {
            if (transaction.isRequestPotLink) {
                await requestsApi.close(transaction.id)
            } else {
                await chargesApi.cancel(transaction.id)
            }
            await invalidateTransactions()
            return true
        } catch (error) {
            captureException(error)
            console.error('Error canceling charge:', error)
            return false
        }
    }

    /** Requestee rejects a request sent to them. */
    const rejectRequest = async (): Promise<boolean> => {
        if (!transaction) return false
        try {
            await chargesApi.cancel(transaction.id)
            await invalidateTransactions()
            return true
        } catch (error) {
            captureException(error)
            console.error('Error canceling charge:', error)
            return false
        }
    }

    /**
     * Sender cancels a pending send link by claiming it back. Resolves true on
     * success (toast shown), false on failure (error toast shown). Refresh
     * failures after a successful claim still count as success — the money is
     * back either way.
     */
    const cancelSendLink = async (): Promise<boolean> => {
        if (!transaction) return false
        try {
            if (!user?.accounts) {
                throw new Error('User not found for cancellation')
            }
            const walletAddress = user.accounts.find((acc) => acc.type === 'peanut-wallet')?.identifier
            if (!walletAddress) {
                throw new Error('No wallet address found for cancellation')
            }
            if (!transaction.extraDataForDrawer?.link) {
                throw new Error('No link found for cancellation')
            }

            await cancelLinkAndClaim({
                link: transaction.extraDataForDrawer.link,
                walletAddress,
                userId: user?.user?.userId,
            })

            try {
                const isConfirmed = await pollForClaimConfirmation(transaction.extraDataForDrawer.link)
                if (!isConfirmed) {
                    console.warn('Transaction confirmation timeout - proceeding with refresh')
                }
                fetchBalance()
                await invalidateTransactions()
                toast.success(t('toast.linkCancelled'))
            } catch (invalidateError) {
                console.error('Failed to update after claim:', invalidateError)
                captureException(invalidateError, {
                    tags: { feature: 'cancel-link' },
                    extra: { userId: user?.user?.userId },
                })
                toast.success(t('toast.linkCancelledRefresh'))
            }
            return true
        } catch (error) {
            captureException(error)
            console.error('Error claiming link:', error)
            toast.error(t('toast.cancelLinkFailed'))
            return false
        }
    }

    return { closeRequest, rejectRequest, cancelSendLink }
}
