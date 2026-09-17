'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Button } from '@/components/0_Bruddle/Button'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { useShareAction } from '@/components/Global/ShareButton/useShareAction'
import { PasskeyDocsLink } from '@/components/Setup/Views/SignTestTransaction'
import { useModalsContext } from '@/context/ModalsContext'
import { CancelDepositActions } from './provider-actions/CancelDepositActions'
import { ReceiptSupportLink } from './ReceiptSupportLink'
import { DownloadReceiptPdfLink } from './DownloadReceiptPdfLink'
import { ReceiptMoreActionsDrawer, type ReceiptMoreAction } from './ReceiptMoreActionsDrawer'
import { openReceiptPdfUrl, receiptPdfPath } from './receipt-pdf-link.utils'
import { useReceiptPdfFile } from './useReceiptPdfFile'
import { useReceiptReferralAction } from './useReceiptReferralAction'
import { type ReceiptViewModel } from './useReceiptViewModel'
import { useReceiptActions } from './useReceiptActions'
import { type TransactionDetails } from './transactionTransformer'
import { hasReceiptPage, isRequestEntry, isSendLinkEntry, isSplittable } from './transaction-predicates'
import { buildSplitBillRequestUrl } from './splitBill.utils'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { openExternalUrl } from '@/utils/capacitor'
import { getReceiptUrl, isTestTransaction } from '@/utils/history.utils'
import { resolveInAppNavigation } from '@/utils/native-routes'

type CancelLinkState = 'idle' | 'cancelling' | 'cancelled'

const CANCEL_LINK_KEYS = {
    idle: 'actions.cancelLink',
    cancelling: 'actions.cancelling',
    cancelled: 'actions.cancelled',
} as const satisfies Record<CancelLinkState, string>

/**
 * The receipt's CTA stack (TASK-22452 hierarchy): one state-aware primary —
 * Split when the spend is splittable, Share receipt otherwise, Download on
 * the public page — with the remaining actions demoted into the
 * More-actions drawer. Pending links/requests keep their decision buttons.
 * All api side effects route through useReceiptActions — this view only
 * holds ephemeral UI state.
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
    const locale = useLocale()
    const router = useRouter()
    const { closeRequest, rejectRequest, cancelSendLink } = useReceiptActions(transaction)
    const { setIsSupportModalOpen } = useModalsContext()
    const { isPendingBankRequest, isPendingRequestee, isPendingRequester, isPendingSentLink } = vm

    const [showCancelLinkDrawer, setShowCancelLinkDrawer] = useState(false)
    const [showMoreActions, setShowMoreActions] = useState(false)
    const [cancelLinkState, setCancelLinkState] = useState<CancelLinkState>('idle')

    // Sync child-drawer state to the parent details drawer — it keeps itself
    // open while any of our drawers are up (vaul NestedRoot contract).
    useEffect(() => {
        setIsModalOpen?.(showCancelLinkDrawer || showMoreActions)
    }, [showCancelLinkDrawer, showMoreActions, setIsModalOpen])

    // An action/payment URL is not necessarily a public receipt URL. Only the
    // dedicated receipt-page kinds may share it; every other completed kind
    // shares the authenticated PDF file (#3159 boundary, unchanged here).
    const kind = transaction.extraDataForDrawer?.kind
    const receiptUrl = getReceiptUrl(transaction)
    const hasPublicReceiptPage = hasReceiptPage(transaction)
    const canShareUrl = vm.shouldShowShareReceipt && hasPublicReceiptPage && !!receiptUrl
    const canSharePdf = vm.shouldShowShareReceipt && vm.shouldShowDownloadPdf && !hasPublicReceiptPage && !!kind
    const canShareReceipt = canShareUrl || canSharePdf
    const canDownloadPdf = vm.shouldShowDownloadPdf && !!kind
    const showSplitCta = !isPublic && isSplittable(transaction)
    // one primary per state: split first, else share (never both visible)
    const sharePrimary = !showSplitCta && canShareReceipt
    const isTest = isTestTransaction(transaction.userName)

    // hooks are unconditional; prefetch mirrors the old PrivateReceiptPdfActions
    // scope — private-kind finals fetch eagerly with the stored bearer.
    const pdfFile = useReceiptPdfFile({ entryId: transaction.id, kind: kind ?? '', prefetch: canSharePdf })
    const shareReceiptUrl = useShareAction({ url: receiptUrl ?? '' })
    // invite row (TASK-22452 item 5): pre-#3159 eligibility, impression only
    // while the drawer is open with the row visible
    const referralAction = useReceiptReferralAction(transaction, {
        isPublic,
        drawerOpen: showMoreActions,
        onSelect: () => setShowMoreActions(false),
    })

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

    // the overflow rows, in menu order: share (when split owns the primary),
    // download, support. the referral row joins here (TASK-22452 item 5).
    const moreActions: ReceiptMoreAction[] = []
    if (!isPublic) {
        if (showSplitCta && canShareUrl) {
            moreActions.push({
                icon: 'share',
                title: t('actions.shareReceipt'),
                onSelect: () => {
                    setShowMoreActions(false)
                    void shareReceiptUrl()
                },
                'data-testid': 'more-action-share',
            })
        }
        if (showSplitCta && canSharePdf) {
            moreActions.push({
                icon: 'share',
                title: t('actions.shareReceipt'),
                onSelect: () => {
                    setShowMoreActions(false)
                    void pdfFile.share()
                },
                disabled: pdfFile.unavailable || pdfFile.busy !== null,
                'data-testid': 'more-action-share',
            })
        }
        if (canDownloadPdf) {
            // public-capability kinds keep their pre-existing url download —
            // anchor on web, system browser on native, no bearer, no wait.
            // only private kinds use the authenticated file hook.
            const downloadViaUrl = hasPublicReceiptPage
            moreActions.push({
                icon: 'download',
                title: t('actions.downloadPdf'),
                onSelect: () => {
                    setShowMoreActions(false)
                    if (downloadViaUrl) openReceiptPdfUrl(receiptPdfPath(transaction.id, kind!, locale))
                    else void pdfFile.download()
                },
                disabled: !downloadViaUrl && (pdfFile.unavailable || pdfFile.busy !== null),
                'data-testid': 'more-action-download',
            })
        }
        if (referralAction && (showSplitCta || sharePrimary)) {
            moreActions.push(referralAction)
        }
        if (!isTest && (showSplitCta || sharePrimary)) {
            moreActions.push({
                icon: 'peanut-support',
                title: t('actions.reportIssue'),
                onSelect: () => {
                    setShowMoreActions(false)
                    setIsSupportModalOpen(true)
                },
                'data-testid': 'more-action-support',
            })
        }
    }
    const showMoreActionsButton = moreActions.length > 0
    // the drawer owns support only when the overflow exists; every other
    // state keeps the visible support/passkey footer.
    const supportInDrawer = moreActions.some((action) => action['data-testid'] === 'more-action-support')

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

            {/* the final-state cta group (S/8 inside one action area): the one
                primary, then the overflow trigger */}
            {(showSplitCta || sharePrimary || showMoreActionsButton) && (
                <div className="flex flex-col gap-2 pr-1 print:hidden">
                    {showSplitCta && (
                        <Button
                            onClick={() =>
                                router.push(buildSplitBillRequestUrl(transaction.amount, transaction.userName))
                            }
                            icon="users"
                            shadowSize="4"
                        >
                            {t('actions.splitBill')}
                        </Button>
                    )}

                    {sharePrimary && canShareUrl && (
                        <div data-testid="public-share">
                            <ShareButton url={receiptUrl!} className="w-full">
                                {t('actions.shareReceipt')}
                            </ShareButton>
                        </div>
                    )}

                    {sharePrimary && canSharePdf && (
                        <Button
                            shadowSize="4"
                            className="w-full"
                            loading={pdfFile.busy === 'share'}
                            disabled={pdfFile.unavailable || pdfFile.busy !== null}
                            onClick={() => void pdfFile.share()}
                            icon={<Icon name="share" size={20} />}
                            data-testid="private-pdf-share"
                        >
                            {t('actions.shareReceipt')}
                        </Button>
                    )}

                    {showMoreActionsButton && (
                        <Button
                            variant="stroke"
                            shadowSize="4"
                            className="w-full"
                            onClick={() => setShowMoreActions(true)}
                            data-testid="more-actions-trigger"
                        >
                            {t('actions.moreActions')}
                        </Button>
                    )}
                </div>
            )}

            {/* public page: download is the one primary; no account actions.
                support sits in the same tight group (S/8) — the link wrapper
                reserves its own 44px target so the two cannot overlap */}
            {isPublic && canDownloadPdf && kind && (
                <div className="flex flex-col gap-2 pr-1 print:hidden">
                    <DownloadReceiptPdfLink entryId={transaction.id} kind={kind} />
                    {isTest ? <PasskeyDocsLink className="border-t-0 pt-0" /> : <ReceiptSupportLink />}
                </div>
            )}

            <CancelDepositActions
                transaction={transaction}
                isPendingBankRequest={isPendingBankRequest}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
                onClose={onClose}
                setIsModalOpen={setIsModalOpen}
            />

            {/* support link section or passkey docs for test transactions —
                unless the public action group above already carries it */}
            {!(isPublic && canDownloadPdf && kind) &&
                (isTest ? <PasskeyDocsLink className="border-t-0 pt-0" /> : !supportInDrawer && <ReceiptSupportLink />)}

            <ReceiptMoreActionsDrawer
                // rendered inside the transaction details drawer whenever that
                // drawer owns the close handler — vaul needs a NestedRoot there
                nested={!!setIsModalOpen}
                open={showMoreActions}
                onOpenChange={setShowMoreActions}
                actions={moreActions}
            />

            {/* Cancel Link Drawer */}
            {setIsLoading && onClose && (
                <CancelSendLinkDrawer
                    // same NestedRoot rule as the more-actions drawer above
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
