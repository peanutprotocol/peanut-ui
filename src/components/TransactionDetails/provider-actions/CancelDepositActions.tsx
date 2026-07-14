'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import ActionModal from '@/components/Global/ActionModal'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { Icon } from '@/components/Global/Icons/Icon'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { isMantecaOnrampEntry, isRequestEntry } from '@/components/TransactionDetails/transaction-predicates'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
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
    const [error, setError] = useState<string | null>(null)
    // Cancels are irreversible and the button sits next to the support link —
    // a real user cancelled a funded deposit while trying to report a problem
    // (no way to match the wire once cancelled). Every cancel confirms first.
    const [pendingCancel, setPendingCancel] = useState<{ noun: string; run: () => Promise<void> } | null>(null)
    if (!setIsLoading || !onClose) return null

    const refetchAndClose = () =>
        queryClient.invalidateQueries({ queryKey: [TRANSACTIONS] }).then(() => {
            setIsLoading(false)
            onClose()
        })

    const wrapAction = async (run: () => Promise<void>) => {
        setIsLoading(true)
        setError(null)
        try {
            await run()
            await refetchAndClose()
        } catch (err) {
            captureException(err)
            // A cancel that fails silently makes the user believe the deposit is
            // cancelled when it isn't — surface it instead of only logging.
            setError("We couldn't cancel this deposit. Please try again or contact support.")
            setIsLoading(false)
        }
    }

    const confirmThenRun = async () => {
        if (!pendingCancel) return
        setPendingCancel(null)
        await wrapAction(pendingCancel.run)
    }

    // Render the active cancel button (if any) alongside the shared
    // confirmation modal and any failure message.
    const withError = (button: ReactNode) => (
        <div className="flex w-full flex-col gap-2">
            {button}
            {error && <ErrorAlert description={error} />}
            <ActionModal
                visible={pendingCancel !== null}
                onClose={() => setPendingCancel(null)}
                icon="ban"
                iconContainerClassName="bg-purple-1"
                iconProps={{ className: 'text-black' }}
                title={`Cancel this ${pendingCancel?.noun ?? 'deposit'}?`}
                modalClassName="!z-[9999] pointer-events-auto"
                description={
                    <>
                        This can't be undone. If you already sent the bank transfer, <strong>don't cancel</strong> — a
                        cancelled deposit can no longer be matched to your account, and the money will be returned to
                        your bank instead.
                    </>
                }
                modalPanelClassName="max-w-sm mx-8 !z-[9999] pointer-events-auto"
                contentContainerClassName="relative pointer-events-auto"
                classOverlay="!bg-black/40 !z-[9998]"
                ctas={[
                    {
                        text: `Yes, cancel ${pendingCancel?.noun ?? 'deposit'}`,
                        shadowSize: '4',
                        className: 'md:py-2',
                        onClick: confirmThenRun,
                    },
                ]}
            />
        </div>
    )

    // 1. Bridge onramp pending — generic bank deposit cancel. Excludes REQUEST
    // rows (those take the dedicated request-cancel branch below).
    const showBridgeOnrampCancel =
        transaction.direction === 'bank_deposit' &&
        !isRequestEntry(transaction) &&
        transaction.status === 'pending' &&
        !!transaction.extraDataForDrawer?.depositInstructions

    if (showBridgeOnrampCancel) {
        return withError(
            <CancelButton
                disabled={!!isLoading}
                onClick={() =>
                    setPendingCancel({
                        noun: 'deposit',
                        run: async () => {
                            const result = await cancelOnramp(transaction.id)
                            if (result.error) throw new Error(result.error)
                        },
                    })
                }
            />
        )
    }

    // 2. Manteca onramp pending.
    const showMantecaCancel = isMantecaOnrampEntry(transaction) && transaction.status === 'pending'

    if (showMantecaCancel) {
        return withError(
            <CancelButton
                disabled={!!isLoading}
                onClick={() =>
                    setPendingCancel({
                        noun: 'deposit',
                        run: async () => {
                            const result = await mantecaApi.cancelDeposit(transaction.id)
                            if (result.error) throw new Error(result.error)
                        },
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
        return withError(
            <div className="pr-1">
                <CancelButton
                    label="Cancel Request"
                    disabled={!!isLoading}
                    onClick={() =>
                        setPendingCancel({
                            noun: 'request',
                            run: async () => {
                                const bridgeTransferId = transaction.extraDataForDrawer?.bridgeTransferId
                                if (!bridgeTransferId) {
                                    throw new Error('Cannot cancel REQUEST: missing bridgeTransferId on transaction')
                                }
                                // Bridge cancel must succeed before we cancel the
                                // charge — otherwise the onramp orphans on Bridge's
                                // side while the user sees the request as cancelled.
                                const bridgeResult = await cancelOnramp(bridgeTransferId)
                                if (bridgeResult.error) throw new Error(bridgeResult.error)
                                await chargesApi.cancel(transaction.id)
                            },
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
                <Icon name="ban" size={18} />
            </div>
            <span>{label}</span>
        </Button>
    )
}
