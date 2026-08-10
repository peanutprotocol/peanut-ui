'use client'

import { useRef, useState, type ReactNode } from 'react'
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
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('transaction')
    const queryClient = useQueryClient()
    const [error, setError] = useState<string | null>(null)
    // Cancels are irreversible and the button sits next to the support link —
    // a real user cancelled a funded deposit while trying to report a problem
    // (no way to match the wire once cancelled). Every cancel confirms first.
    // `kind` rather than a noun to interpolate: "Cancel this {noun}?" can't be
    // translated — es/pt need gender agreement (este depósito / esta solicitud),
    // so each kind carries its own full sentence.
    const [pendingCancel, setPendingCancel] = useState<{
        kind: 'deposit' | 'request'
        run: () => Promise<void>
    } | null>(null)
    // Visibility is separate from pendingCancel so the copy stays rendered
    // during the modal's fade-out (nulling it mid-fade flashed 'deposit'
    // over 'request' titles).
    const [confirmOpen, setConfirmOpen] = useState(false)
    // Ref, not state: a double-tap on the confirm CTA during the modal's
    // fade-out lands both clicks before a re-render, so a state guard would
    // let the cancel fire twice. Refs are synchronous.
    const isCancelRunning = useRef(false)
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
            setError(t('actions.cancelDepositFailed'))
            setIsLoading(false)
        }
    }

    const armCancel = (kind: 'deposit' | 'request', run: () => Promise<void>) => {
        setPendingCancel({ kind, run })
        setConfirmOpen(true)
    }

    const confirmThenRun = async () => {
        if (!pendingCancel || isCancelRunning.current) return
        isCancelRunning.current = true
        setConfirmOpen(false)
        try {
            await wrapAction(pendingCancel.run)
        } finally {
            isCancelRunning.current = false
        }
    }

    // Render the active cancel button (if any) alongside the shared
    // confirmation modal and any failure message.
    const withError = (button: ReactNode) => (
        <div className="flex w-full flex-col gap-2">
            {button}
            {error && <ErrorAlert description={error} />}
            <ActionModal
                visible={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                icon="ban"
                title={
                    pendingCancel?.kind === 'request'
                        ? t('actions.cancelRequestTitle')
                        : t('actions.cancelDepositTitle')
                }
                modalClassName="!z-[9999] pointer-events-auto"
                description={t.rich('actions.cancelWarning', {
                    strong: (chunks) => <strong>{chunks}</strong>,
                })}
                modalPanelClassName="max-w-sm mx-8 !z-[9999] pointer-events-auto"
                contentContainerClassName="relative pointer-events-auto"
                classOverlay="!bg-black/40 !z-[9998]"
                ctas={[
                    {
                        text:
                            pendingCancel?.kind === 'request'
                                ? t('actions.confirmCancelRequest')
                                : t('actions.confirmCancelDeposit'),
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
                    armCancel('deposit', async () => {
                        const result = await cancelOnramp(transaction.id)
                        if (result.error) throw new Error(result.error)
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
                    armCancel('deposit', async () => {
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
        return withError(
            <div className="pr-1">
                <CancelButton
                    label={t('actions.cancelDepositRequest')}
                    disabled={!!isLoading}
                    onClick={() =>
                        armCancel('request', async () => {
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
                        })
                    }
                />
            </div>
        )
    }

    return null
}

function CancelButton({ label, disabled, onClick }: { label?: string; disabled: boolean; onClick: () => void }) {
    const t = useTranslations('transaction')
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
            <span>{label ?? t('actions.cancelDeposit')}</span>
        </Button>
    )
}
