'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { EHistoryEntryType, EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { TRANSACTIONS } from '@/constants/query.consts'
import { cancelOnramp } from '@/app/actions/onramp'
import { chargesApi } from '@/services/charges'
import { mantecaApi } from '@/services/manteca'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Cancel-deposit buttons for pending bank-deposit-shaped flows.
 *
 * Replaces three near-identical inline buttons in the receipt:
 *   - Bridge onramp pending → cancelOnramp(transaction.id)
 *   - Manteca onramp pending → mantecaApi.cancelDeposit(transaction.id)
 *   - REQUEST pending + bridge fulfillment + sender role → cancelOnramp(bridgeTransferId) + chargesApi.cancel(transaction.id)
 *
 * Renders at most one button — conditions are mutually exclusive by
 * construction (different originalType / direction / role combos).
 */
export function CancelDepositActions({
    transaction,
    isPendingBankRequest,
    isLoading,
    setIsLoading,
    onClose,
}: {
    transaction: TransactionDetails
    isPendingBankRequest: boolean
    isLoading: boolean | undefined
    setIsLoading: ((loading: boolean) => void) | undefined
    onClose: (() => void) | undefined
}) {
    const queryClient = useQueryClient()
    if (!setIsLoading || !onClose) return null

    const refetchAndClose = () =>
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] }).then(() => {
            setIsLoading(false)
            onClose()
        })

    const wrapAction = async (run: () => Promise<void>) => {
        setIsLoading(true)
        try {
            await run()
            await refetchAndClose()
        } catch (error) {
            captureException(error)
            console.error('Error canceling deposit:', error)
            setIsLoading(false)
        }
    }

    // 1. Bridge onramp pending — generic bank deposit cancel.
    const showBridgeOnrampCancel =
        transaction.direction === 'bank_deposit' &&
        transaction.extraDataForDrawer?.originalType !== EHistoryEntryType.REQUEST &&
        transaction.status === 'pending' &&
        !!transaction.extraDataForDrawer?.depositInstructions

    if (showBridgeOnrampCancel) {
        return (
            <CancelButton
                disabled={!!isLoading}
                onClick={() =>
                    wrapAction(async () => {
                        const result = await cancelOnramp(transaction.id)
                        if (result.error) throw new Error(result.error)
                    })
                }
            />
        )
    }

    // 2. Manteca onramp pending.
    const showMantecaCancel =
        transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_ONRAMP &&
        transaction.status === 'pending'

    if (showMantecaCancel) {
        return (
            <CancelButton
                disabled={!!isLoading}
                onClick={() =>
                    wrapAction(async () => {
                        const result = await mantecaApi.cancelDeposit(transaction.id)
                        if (result.error) throw new Error(result.error)
                    })
                }
            />
        )
    }

    // 3. REQUEST pending + bridge fulfillment + sender role — cancels the
    // bridge-side onramp first, then the charge so the recipient stops seeing
    // the request as outstanding.
    const showPendingBankRequestCancel =
        isPendingBankRequest && transaction.extraDataForDrawer?.originalUserRole === EHistoryUserRole.SENDER

    if (showPendingBankRequestCancel) {
        return (
            <div className="pr-1">
                <CancelButton
                    label="Cancel Request"
                    disabled={!!isLoading}
                    onClick={() =>
                        wrapAction(async () => {
                            const bridgeTransferId = transaction.extraDataForDrawer?.bridgeTransferId
                            if (!bridgeTransferId) {
                                throw new Error(
                                    'Cannot cancel REQUEST: missing bridgeTransferId on transaction'
                                )
                            }
                            // Bridge cancel must succeed before we cancel the
                            // charge — otherwise the onramp orphans on Bridge's
                            // side while the user sees the request as cancelled.
                            const bridgeResult = await cancelOnramp(bridgeTransferId)
                            if (bridgeResult.error) throw new Error(bridgeResult.error)
                            await chargesApi.cancel(transaction.id)
                        })
                    }
                />
            </div>
        )
    }

    return null
}

function CancelButton({
    label = 'Cancel deposit',
    disabled,
    onClick,
}: {
    label?: string
    disabled: boolean
    onClick: () => void
}) {
    return (
        <Button
            disabled={disabled}
            onClick={onClick}
            variant={'primary-soft'}
            className="flex w-full items-center gap-1"
            shadowSize="4"
        >
            <div className="flex items-center">
                <Icon name="cancel" className="mr-0.5 min-w-3 rounded-full border border-black p-0.5" />
            </div>
            <span>{label}</span>
        </Button>
    )
}
