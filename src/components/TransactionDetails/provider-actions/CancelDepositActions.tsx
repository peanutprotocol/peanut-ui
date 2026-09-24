'use client'

import { useEffect, useRef, useState } from 'react'
import { Callout } from '@/components/0_Bruddle/Callout'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { getCancelDepositKind } from './cancel-deposit.utils'
import { TRANSACTIONS } from '@/constants/query.consts'
import { cancelOnramp } from '@/app/actions/onramp'
import { chargesApi } from '@/services/charges'
import { mantecaApi } from '@/services/manteca'
import { captureException } from '@sentry/nextjs'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

/**
 * Cancel confirm for pending bank-deposit-shaped flows. The trigger is the
 * receipt's More actions row; this renders the confirm drawer and any error.
 *   - Bridge onramp pending → cancelOnramp(transaction.id)
 *   - Manteca onramp pending → mantecaApi.cancelDeposit(transaction.id)
 *   - REQUEST pending + bridge fulfillment + sender role → cancelOnramp(bridgeTransferId) + chargesApi.cancel(transaction.id)
 *
 * The kinds are mutually exclusive by construction (different
 * originalType / direction / role combos).
 */
export function CancelDepositActions({
    transaction,
    isPendingBankRequest,
    setIsLoading,
    onClose,
    setIsModalOpen,
    confirmOpen,
    onConfirmOpenChange: setConfirmOpen,
}: {
    transaction: TransactionDetails
    isPendingBankRequest: boolean
    setIsLoading: ((loading: boolean) => void) | undefined
    onClose: (() => void) | undefined
    /** Present when rendered inside the transaction details drawer — the parent keeps itself open while the confirm drawer is up, and the confirm drawer nests. */
    setIsModalOpen?: (isModalOpen: boolean) => void
    /** The confirm drawer is controlled: the receipt's More actions row opens it. */
    confirmOpen: boolean
    onConfirmOpenChange: (open: boolean) => void
}) {
    const t = useTranslations('transaction')
    const queryClient = useQueryClient()
    const [error, setError] = useState<string | null>(null)
    // Cancels are irreversible — a real user cancelled a funded deposit while
    // trying to report a problem (no way to match the wire once cancelled).
    // Every cancel confirms first.
    // Ref, not state: a double-tap on the confirm CTA during the modal's
    // fade-out lands both clicks before a re-render, so a state guard would
    // let the cancel fire twice. Refs are synchronous.
    const isCancelRunning = useRef(false)
    // Eligibility, derived up front so the effects below can release the
    // parent lock when a status update (websocket history refresh) makes the
    // transaction non-cancellable while the confirm is open — otherwise the
    // cancel branch stops rendering with confirmOpen stuck true and the
    // details drawer refuses every close.
    const cancelKind = getCancelDepositKind(transaction, isPendingBankRequest)
    const isCancellable = cancelKind !== null
    useEffect(() => {
        if (!isCancellable) setConfirmOpen(false)
    }, [isCancellable, setConfirmOpen])
    // sync the confirm drawer to the parent details drawer (same contract as
    // the cancel-link drawer in ReceiptActions) so it stays open underneath.
    // The cleanup releases the lock on unmount for the same reason.
    useEffect(() => {
        setIsModalOpen?.(confirmOpen)
        return () => setIsModalOpen?.(false)
    }, [confirmOpen, setIsModalOpen])
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

    // one cancel per kind; the kinds are mutually exclusive by construction
    const runCancel = async () => {
        // 1. Bridge onramp pending — generic bank deposit cancel.
        if (cancelKind === 'bridge-onramp') {
            const result = await cancelOnramp(transaction.id)
            if (result.error) throw new Error(result.error)
        }
        // 2. Manteca onramp pending.
        if (cancelKind === 'manteca-onramp') {
            const result = await mantecaApi.cancelDeposit(transaction.id)
            if (result.error) throw new Error(result.error)
        }
        // 3. REQUEST pending + bridge fulfillment + sender role — cancels the
        // bridge-side onramp first, then the charge so the recipient stops
        // seeing the request as outstanding.
        if (cancelKind === 'bank-request') {
            const bridgeTransferId = transaction.extraDataForDrawer?.bridgeTransferId
            if (!bridgeTransferId) {
                throw new Error('Cannot cancel REQUEST: missing bridgeTransferId on transaction')
            }
            // Bridge cancel must succeed before we cancel the charge —
            // otherwise the onramp orphans on Bridge's side while the user
            // sees the request as cancelled.
            const bridgeResult = await cancelOnramp(bridgeTransferId)
            if (bridgeResult.error) throw new Error(bridgeResult.error)
            await chargesApi.cancel(transaction.id)
        }
    }
    const noun = cancelKind === 'bank-request' ? 'request' : 'deposit'

    const confirmThenRun = async () => {
        if (!cancelKind || isCancelRunning.current) return
        isCancelRunning.current = true
        setConfirmOpen(false)
        try {
            await wrapAction(runCancel)
        } finally {
            isCancelRunning.current = false
        }
    }

    // The confirm drawer and any failure message. The confirm is a nested
    // drawer when the receipt sits inside the transaction details drawer —
    // an ActionModal there opened behind the drawer overlay (z-20 vs z-50)
    // and needed z-index overrides; a nested vaul drawer stacks natively.
    if (!cancelKind) return null

    // empty:hidden: with no error the drawer portals out and the host is
    // empty, so it must not take a gap slot in the receipt's cta group.
    return (
        <div className="flex w-full flex-col gap-2 empty:hidden">
            {error && <Callout priority="error">{error}</Callout>}
            <Drawer
                nested={!!setIsModalOpen}
                open={confirmOpen}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setConfirmOpen(false)
                }}
            >
                <DrawerContent>
                    <div className="flex flex-col items-center gap-4 pt-1 pb-6 text-center">
                        <IconBubble icon="ban" color="red" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('actions.cancelConfirm.title', { kind: noun })}</DrawerTitle>
                            <DrawerDescription>
                                {t.rich('actions.cancelConfirm.description', {
                                    strong: (chunks) => <strong>{chunks}</strong>,
                                })}
                            </DrawerDescription>
                        </DrawerHeader>
                        <Button shadowSize="4" className="w-full justify-center" onClick={confirmThenRun}>
                            {t('actions.cancelConfirm.confirm', { kind: noun })}
                        </Button>
                    </div>
                </DrawerContent>
            </Drawer>
        </div>
    )
}
