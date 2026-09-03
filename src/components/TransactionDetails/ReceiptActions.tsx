'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Button } from '@/components/0_Bruddle/Button'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { PasskeyDocsLink } from '@/components/Setup/Views/SignTestTransaction'
import { CancelDepositActions } from './provider-actions/CancelDepositActions'
import { ReceiptReferralNudge } from './ReceiptReferralNudge'
import { ReceiptSupportLink } from './ReceiptSupportLink'
import { DownloadReceiptPdfLink } from './DownloadReceiptPdfLink'
import { type ReceiptViewModel } from './useReceiptViewModel'
import { useReceiptActions } from './useReceiptActions'
import { type TransactionDetails } from './transactionTransformer'
import { hasReferralNudge, isRequestEntry, isSendLinkEntry, isSplittable } from './transaction-predicates'
import { buildSplitBillRequestUrl } from './splitBill.utils'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useActivationStatus } from '@/hooks/useActivationStatus'
import { useUserStore } from '@/redux/hooks'
import { openExternalUrl } from '@/utils/capacitor'
import { generateInviteCodeLink } from '@/utils/general.utils'
import { getReceiptUrl, isTestTransaction } from '@/utils/history.utils'
import { resolveInAppNavigation } from '@/utils/native-routes'

type CancelLinkState = 'idle' | 'cancelling' | 'cancelled'

const CANCEL_LINK_KEYS = {
    idle: 'actions.cancelLink',
    cancelling: 'actions.cancelling',
    cancelled: 'actions.cancelled',
} as const satisfies Record<CancelLinkState, string>

/**
 * The receipt's CTA stack (DS 09): share/cancel for pending links, pay/reject
 * for requests, split bill, share receipt, deposit cancels, referral nudge and
 * the support footer. All api side effects route through useReceiptActions —
 * this view only holds ephemeral UI state.
 */
export function ReceiptActions({
    transaction,
    vm,
    isPublic,
    amountDisplay,
    shouldShowQrShare,
    isLoading,
    setIsLoading,
    onClose,
    setIsModalOpen,
}: {
    transaction: TransactionDetails
    vm: ReceiptViewModel
    isPublic: boolean
    amountDisplay: string
    shouldShowQrShare: boolean
    isLoading?: boolean
    setIsLoading?: (isLoading: boolean) => void
    onClose?: () => void
    setIsModalOpen?: (isModalOpen: boolean) => void
}) {
    const t = useAppTranslations('transaction')
    const router = useRouter()
    const { user } = useUserStore()
    const { isActivated } = useActivationStatus()
    const { closeRequest, rejectRequest, cancelSendLink } = useReceiptActions(transaction)
    const { isPendingBankRequest, isPendingRequestee, isPendingRequester, isPendingSentLink } = vm

    const [showCancelLinkDrawer, setShowCancelLinkDrawer] = useState(false)
    const [cancelLinkState, setCancelLinkState] = useState<CancelLinkState>('idle')

    // Sync drawer state to parent if callback is provided — the details drawer
    // keeps itself open while the confirm drawer is up.
    useEffect(() => {
        setIsModalOpen?.(showCancelLinkDrawer)
    }, [showCancelLinkDrawer, setIsModalOpen])

    // `shouldShowShareReceipt` alone is TRUE for card spends (the txHash
    // short-circuit in useReceiptViewModel); `getReceiptUrl` returning undefined
    // is the real suppressor, so the CTA arithmetic must read the composite.
    const receiptUrl = getReceiptUrl(transaction)
    const showShareReceipt = vm.shouldShowShareReceipt && !!receiptUrl
    const showSplitCta = !isPublic && isSplittable(transaction)

    // `!isPublic`: on a public receipt the *viewer's* username would credit a
    // bystander for someone else's payment.
    const inviteUsername = user?.user.username
    const showReferralNudge =
        !isPublic &&
        isActivated &&
        transaction.status === 'completed' &&
        hasReferralNudge(transaction) &&
        !!inviteUsername
    const inviteLink = inviteUsername ? generateInviteCodeLink(inviteUsername).inviteLink : ''

    const referralCtaVariant = showSplitCta && showShareReceipt ? 'text_link' : 'button'

    const handleCloseRequest = async () => {
        if (!setIsLoading || !onClose) return
        setIsLoading(true)
        const ok = await closeRequest()
        setIsLoading(false)
        if (ok) onClose()
    }

    const handleRejectRequest = async () => {
        if (!setIsLoading || !onClose) return
        setIsLoading(true)
        const ok = await rejectRequest()
        setIsLoading(false)
        if (ok) onClose()
    }

    // The request link is an absolute peanut.me URL; assigning it to
    // window.location is an off-origin navigation the native WebView hands to
    // the OS, so it is resolved to an in-app route first.
    const handlePay = () => {
        const target = resolveInAppNavigation(transaction.extraDataForDrawer?.link ?? '')
        if (!target) return
        if (target.kind === 'push') router.push(target.path)
        else openExternalUrl(target.url).catch((err) => console.warn('failed to open request link:', err))
    }

    const handleCancelSendLink = async () => {
        if (!setIsLoading || !onClose) return
        setIsLoading(true)
        setCancelLinkState('cancelling')
        const result = await cancelSendLink()
        setIsLoading(false)
        if (result === 'failed') {
            setCancelLinkState('idle')
            return
        }
        setShowCancelLinkDrawer(false)
        if (result === 'already-claimed') {
            // nothing was cancelled — the refetched entry renders as claimed
            setCancelLinkState('idle')
            onClose()
            return
        }
        setCancelLinkState('cancelled')
        // Brief delay for toast visibility before the drawer closes.
        await new Promise((resolve) => setTimeout(resolve, 1500))
        onClose()
    }

    return (
        <>
            {/* share and cancel buttons section (only if qr is shown) */}
            {shouldShowQrShare && transaction.extraDataForDrawer?.link && (
                <div className="flex flex-col gap-2 pr-1 print:hidden">
                    <ShareButton url={transaction.extraDataForDrawer.link} title={t('actions.shareLinkTitle')}>
                        {t('actions.shareLink')}
                    </ShareButton>
                    {/* show cancel button only if the current user sent the link/request */}
                    {(isSendLinkEntry(transaction) || isRequestEntry(transaction)) &&
                        transaction.extraDataForDrawer.originalUserRole === EHistoryUserRole.SENDER &&
                        setIsLoading &&
                        onClose && (
                            <Button
                                disabled={isLoading || cancelLinkState === 'cancelled'}
                                onClick={() => setShowCancelLinkDrawer(true)}
                                loading={isLoading}
                                variant="stroke"
                                className="flex w-full items-center gap-1"
                                shadowSize="4"
                            >
                                <div className="flex items-center">{!isLoading && <Icon name="ban" size={20} />}</div>
                                <span>{t(CANCEL_LINK_KEYS[cancelLinkState])}</span>
                            </Button>
                        )}
                </div>
            )}

            {isPendingSentLink && !shouldShowQrShare && (
                <div className="flex items-center justify-center gap-1 text-center text-label-m text-foreground-secondary">
                    <Icon name="info" size={20} />
                    {t('pendingLinkDeviceNote')}
                </div>
            )}

            {isPendingRequester && setIsLoading && onClose && (
                <div className="pr-1">
                    <Button
                        icon="ban"
                        iconSize={18}
                        loading={isLoading}
                        disabled={isLoading}
                        onClick={handleCloseRequest}
                        variant="stroke"
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        {transaction.totalAmountCollected > 0 ? t('actions.closeRequest') : t('actions.cancelRequest')}
                    </Button>
                </div>
            )}

            {isPendingRequestee && setIsLoading && onClose && (
                <div className="flex flex-col gap-2 pr-1">
                    <Button onClick={handlePay} shadowSize="4" className="flex w-full items-center gap-1">
                        <Icon name="currency" size={20} />
                        {t('actions.pay')}
                    </Button>
                    <Button
                        icon="ban"
                        iconSize={18}
                        disabled={isLoading}
                        onClick={handleRejectRequest}
                        variant="stroke"
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        {t('actions.rejectRequest')}
                    </Button>
                </div>
            )}

            {showSplitCta && (
                <Button
                    onClick={() => router.push(buildSplitBillRequestUrl(transaction.amount, transaction.userName))}
                    icon="users"
                    shadowSize="4"
                >
                    {t('actions.splitBill')}
                </Button>
            )}

            {showShareReceipt && (
                <div className="pr-1">
                    <ShareButton variant={showSplitCta ? 'stroke' : 'purple'} url={receiptUrl!}>
                        {t('actions.shareReceipt')}
                    </ShareButton>
                </div>
            )}

            <CancelDepositActions
                transaction={transaction}
                isPendingBankRequest={isPendingBankRequest}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onClose={onClose}
            />

            {showReferralNudge && (
                <ReceiptReferralNudge
                    transactionId={transaction.id}
                    inviteLink={inviteLink}
                    variant={referralCtaVariant}
                    label={t('actions.inviteFriends')}
                />
            )}

            {vm.shouldShowDownloadPdf && transaction.extraDataForDrawer?.kind && (
                <DownloadReceiptPdfLink entryId={transaction.id} kind={transaction.extraDataForDrawer.kind} />
            )}

            {/* support link section or passkey docs for test transactions */}
            {isTestTransaction(transaction.userName) ? (
                <PasskeyDocsLink className="border-t-0 pt-0" />
            ) : (
                <ReceiptSupportLink />
            )}

            {/* Cancel Link Drawer */}
            {setIsLoading && onClose && (
                <CancelSendLinkDrawer
                    // Rendered inside the transaction details drawer whenever that
                    // drawer owns the close handler — vaul needs a NestedRoot there.
                    nested={!!setIsModalOpen}
                    showCancelLinkDrawer={showCancelLinkDrawer}
                    setShowCancelLinkDrawer={setShowCancelLinkDrawer}
                    amount={amountDisplay}
                    isLoading={isLoading}
                    onClick={handleCancelSendLink}
                />
            )}
        </>
    )
}
