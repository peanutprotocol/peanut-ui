'use client'
import { useNativePlatform } from '@/utils/native-platform'
import { useAppOrigin } from '@/hooks/useAppOrigin'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import CancelSendLinkDrawer from '@/components/Global/CancelSendLinkDrawer'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import ShareButton from '@/components/Global/ShareButton'
import { PasskeyDocsLink } from '@/components/Setup/Views/SignTestTransaction'
import { useModalsContext } from '@/context/ModalsContext'
import { CancelDepositActions } from './provider-actions/CancelDepositActions'
import { getCancelDepositKind } from './provider-actions/cancel-deposit.utils'
import { ReceiptSupportLink } from './ReceiptSupportLink'
import { DownloadReceiptPdfLink } from './DownloadReceiptPdfLink'
import { ReceiptMoreActionsDrawer, type ReceiptMoreAction } from './ReceiptMoreActionsDrawer'
import { openReceiptPdfUrl, receiptPdfPath, receiptPdfVersion } from './receipt-pdf-link.utils'
import { useReceiptPdfFile } from './useReceiptPdfFile'
import { trackReceiptAction, type ReceiptActionPlacement } from './receipt-action-analytics'
import { useReceiptReferralAction } from './useReceiptReferralAction'
import { type ReceiptViewModel } from './useReceiptViewModel'
import { useReceiptActions } from './useReceiptActions'
import { type TransactionDetails } from './transactionTransformer'
import { hasPublicReceipt, isRequestEntry, isSendLinkEntry, isSplittable } from './transaction-predicates'
import { buildSplitBillRequestUrl } from './splitBill.utils'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { openExternalUrl } from '@/utils/capacitor'
import { getReceiptUrl, isTestTransaction } from '@/utils/history.utils'
import { resolveInAppNavigation } from '@/utils/native-routes'
import { formatBankAmount } from '@/utils/currency'

type CancelLinkState = 'idle' | 'cancelling' | 'cancelled'

const CANCEL_LINK_KEYS = {
    idle: 'actions.cancelLink',
    cancelling: 'actions.cancelling',
    cancelled: 'actions.cancelled',
} as const satisfies Record<CancelLinkState, string>

/** The one primary button of a final-state receipt in the app. */
type ReceiptPrimaryAction = 'share-link' | 'split' | 'share-pdf'

/**
 * The receipt's CTA stack: one state-aware primary, then More actions for
 * the rest (TASK-22452 hierarchy, TASK-24141 link sharing).
 *  - An entry with a public receipt: Share receipt sends its link. Split this
 *    bill (where the spend is splittable) and the PDF move to More actions.
 *  - No public receipt: Split this bill where splittable, else Share receipt
 *    sends the PDF file.
 *  - The public page: Download is the one primary.
 * Pending links/requests keep their decision buttons. All api side effects
 * route through useReceiptActions — this view only holds ephemeral UI state.
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
    const native = useNativePlatform()
    const origin = useAppOrigin()
    const t = useAppTranslations('transaction')
    const locale = useLocale()
    const router = useRouter()
    const { closeRequest, rejectRequest, cancelSendLink } = useReceiptActions(transaction)
    const { setIsSupportModalOpen } = useModalsContext()
    const { isPendingBankRequest, isPendingRequestee, isPendingRequester, isPendingSentLink } = vm
    // Only a request link (pot) can be closed by its requester. A charge
    // addressed to someone can be cancelled only by its payer: the API answers
    // 403 to the requester, because a cancel could land after the payer's
    // broadcast and before the payment is recorded (TASK-24006).
    const canCloseRequest = isPendingRequester && !!transaction.isRequestPotLink

    const [showCancelLinkDrawer, setShowCancelLinkDrawer] = useState(false)
    const [showMoreActions, setShowMoreActions] = useState(false)
    const [cancelLinkState, setCancelLinkState] = useState<CancelLinkState>('idle')
    const [showCancelConfirm, setShowCancelConfirm] = useState(false)
    const [showCloseRequestConfirm, setShowCloseRequestConfirm] = useState(false)
    // Closing a request that already took money ends it short of its goal, so
    // it asks first and names what is unpaid. It used to close in one tap,
    // beside contributor rows that summed to the full goal (TASK-23856).
    const closeNeedsConfirm = transaction.totalAmountCollected > 0
    // gated like the cancel confirm: a request that stops being open while the
    // confirm is up must not leave the parent drawer locked
    const closeRequestConfirmOpen = canCloseRequest && closeNeedsConfirm && showCloseRequestConfirm

    // The API decides per entry whether anyone with the link may read the
    // receipt. When it may, Share receipt sends that link; otherwise the
    // authenticated PDF file is what gets shared.
    const kind = transaction.extraDataForDrawer?.kind
    const publicReceipt = hasPublicReceipt(transaction)
    const receiptPageUrl = getReceiptUrl(transaction, origin)
    const canShareLink = vm.shouldShowShareReceipt && !!receiptPageUrl
    const canSharePdf = vm.shouldShowShareReceipt && vm.shouldShowDownloadPdf && !!kind
    const canDownloadPdf = vm.shouldShowDownloadPdf && !!kind
    const canSplit = !isPublic && isSplittable(transaction)
    // one primary per state, never two: the link, else split, else the pdf
    const primaryAction: ReceiptPrimaryAction | null = canShareLink
        ? 'share-link'
        : canSplit
          ? 'split'
          : canSharePdf
            ? 'share-pdf'
            : null
    // cancelling a pending deposit or bank-paid request is a More actions row,
    // never a receipt button, so the receipt shows two buttons at most. the
    // cancel needs the loading/close handlers, which public pages never pass.
    const cancelKind =
        !isPublic && setIsLoading && onClose ? getCancelDepositKind(transaction, isPendingBankRequest) : null
    const cancelInDrawer = cancelKind !== null
    // gated on cancelInDrawer: once the entry stops being cancellable the
    // confirm unmounts, and a stale open flag must not re-lock the parent.
    const cancelConfirmOpen = cancelInDrawer && showCancelConfirm
    // the confirm unmounts before its own reset can run, so clear the flag
    // here too — otherwise a later pending refetch reopens it untapped.
    useEffect(() => {
        setShowCancelConfirm(false)
    }, [cancelInDrawer, transaction.id])
    // the same for the close confirm: a refetch that ends the need for it, or
    // another receipt, must not reopen it untapped
    useEffect(() => {
        setShowCloseRequestConfirm(false)
    }, [closeNeedsConfirm, transaction.id])

    // Sync child-drawer state to the parent details drawer — it keeps itself
    // open while any of our drawers are up (vaul NestedRoot contract). The
    // cancel confirm is included because it opens in the same render that
    // closes the more-actions drawer; this effect runs after the child's and
    // would otherwise release the lock the child just took.
    useEffect(() => {
        setIsModalOpen?.(showCancelLinkDrawer || showMoreActions || cancelConfirmOpen || closeRequestConfirmOpen)
    }, [showCancelLinkDrawer, showMoreActions, cancelConfirmOpen, closeRequestConfirmOpen, setIsModalOpen])
    const isTest = isTestTransaction(transaction.userName)

    // hooks are unconditional; finals fetch eagerly with the stored bearer so
    // the share sheet opens inside the click's user activation.
    const pdfVersion = receiptPdfVersion(transaction)
    const pdfFile = useReceiptPdfFile({
        entryId: transaction.id,
        kind: kind ?? '',
        prefetch: canSharePdf,
        version: pdfVersion,
    })
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

    const requestGoal = transaction.isRequestPotLink ? Number(transaction.amount) : 0
    const unpaidAmount = Math.max(requestGoal - transaction.totalAmountCollected, 0)
    const closeConfirmDescription =
        requestGoal > 0 && unpaidAmount > 0
            ? t('actions.closeRequestConfirm.descriptionUnpaid', {
                  remaining: formatBankAmount(unpaidAmount, 'USD'),
                  total: formatBankAmount(requestGoal, 'USD'),
              })
            : t('actions.closeRequestConfirm.description')
    const confirmCloseRequest = () => {
        setShowCloseRequestConfirm(false)
        void handleCloseRequest()
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

    const handleSplitBill = (placement: ReceiptActionPlacement) => {
        trackReceiptAction('split', placement, kind)
        router.push(buildSplitBillRequestUrl(transaction.amount, transaction.userName))
    }
    const handleSharePdf = (placement: ReceiptActionPlacement) => {
        trackReceiptAction('share_pdf', placement, kind)
        void pdfFile.share()
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

    // the overflow rows, in menu order: split and the pdf share when the
    // primary slot holds something else, then download, cancel, invite and
    // support (TASK-22452 item 5, TASK-24141).
    const moreActions: ReceiptMoreAction[] = []
    if (!isPublic) {
        if (canSplit && primaryAction !== 'split') {
            moreActions.push({
                icon: 'users',
                title: t('actions.splitBill'),
                onSelect: () => {
                    setShowMoreActions(false)
                    handleSplitBill('more_actions')
                },
                'data-testid': 'more-action-split',
            })
        }
        if (canSharePdf && primaryAction !== 'share-pdf') {
            moreActions.push({
                icon: 'share',
                title: t('actions.sharePdf'),
                onSelect: () => {
                    setShowMoreActions(false)
                    handleSharePdf('more_actions')
                },
                disabled: pdfFile.unavailable || pdfFile.busy !== null,
                'data-testid': 'more-action-share-pdf',
            })
        }
        if (canDownloadPdf) {
            // a public receipt downloads from its url — anchor on web, no
            // bearer, no wait. native and private receipts use the
            // authenticated file hook.
            const downloadViaUrl = publicReceipt && !native.isCapacitor
            moreActions.push({
                icon: 'download',
                title: t('actions.downloadPdf'),
                onSelect: () => {
                    setShowMoreActions(false)
                    trackReceiptAction('download_pdf', 'more_actions', kind)
                    if (downloadViaUrl) openReceiptPdfUrl(receiptPdfPath(transaction.id, kind!, locale, pdfVersion))
                    else void pdfFile.download()
                },
                disabled: !downloadViaUrl && (pdfFile.unavailable || pdfFile.busy !== null),
                'data-testid': 'more-action-download',
            })
        }
        if (cancelInDrawer) {
            // same hand-off as the support row: close the menu, open the next surface
            moreActions.push({
                icon: 'ban',
                title: cancelKind === 'bank-request' ? t('actions.cancelDepositRequest') : t('actions.cancelDeposit'),
                onSelect: () => {
                    setShowMoreActions(false)
                    setShowCancelConfirm(true)
                },
                disabled: isLoading,
                'data-testid': 'more-action-cancel',
            })
        }
        if (referralAction && primaryAction) {
            moreActions.push(referralAction)
        }
        if (!isTest && primaryAction) {
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
                <div className="flex flex-col gap-2 print:hidden">
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
                                variant="secondary"
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

            {canCloseRequest && setIsLoading && onClose && (
                <Button
                    icon="ban"
                    iconSize={18}
                    loading={isLoading}
                    disabled={isLoading}
                    onClick={closeNeedsConfirm ? () => setShowCloseRequestConfirm(true) : handleCloseRequest}
                    variant="secondary"
                    shadowSize="4"
                    className="flex w-full items-center gap-1"
                >
                    {closeNeedsConfirm ? t('actions.closeRequest') : t('actions.cancelRequest')}
                </Button>
            )}

            {/* design.md nested drawer confirm: the receipt sits inside the
                transaction details drawer, where a modal would open behind it */}
            {canCloseRequest && closeNeedsConfirm && setIsLoading && onClose && (
                <Drawer
                    nested={!!setIsModalOpen}
                    open={closeRequestConfirmOpen}
                    onOpenChange={(isOpen) => {
                        if (!isOpen) setShowCloseRequestConfirm(false)
                    }}
                >
                    <DrawerContent>
                        <div className="flex flex-col items-center gap-4 pt-1 pb-6 text-center">
                            <IconBubble icon="ban" color="red" />
                            <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                                <DrawerTitle>{t('actions.closeRequestConfirm.title')}</DrawerTitle>
                                <DrawerDescription>{closeConfirmDescription}</DrawerDescription>
                            </DrawerHeader>
                            <Button
                                shadowSize="4"
                                className="w-full justify-center"
                                onClick={confirmCloseRequest}
                                data-testid="close-request-confirm"
                            >
                                {t('actions.closeRequest')}
                            </Button>
                            {/* mt-2 on the gap-4 column: 24px above the tertiary */}
                            <div className="mt-2 flex justify-center">
                                <LinkButton onClick={() => setShowCloseRequestConfirm(false)}>
                                    {t('actions.closeRequestConfirm.keepOpen')}
                                </LinkButton>
                            </div>
                        </div>
                    </DrawerContent>
                </Drawer>
            )}

            {isPendingRequestee && setIsLoading && onClose && (
                <div className="flex flex-col gap-2">
                    <Button onClick={handlePay} shadowSize="4" className="flex w-full items-center gap-1">
                        <Icon name="currency" size={20} />
                        {t('actions.pay')}
                    </Button>
                    <Button
                        icon="ban"
                        iconSize={18}
                        disabled={isLoading}
                        onClick={handleRejectRequest}
                        variant="secondary"
                        shadowSize="4"
                        className="flex w-full items-center gap-1"
                    >
                        {t('actions.rejectRequest')}
                    </Button>
                </div>
            )}

            {/* the final-state cta group (S/8 inside one action area): the one
                primary, then the overflow trigger */}
            {(primaryAction || showMoreActionsButton) && (
                <div className="flex flex-col gap-2 print:hidden">
                    {primaryAction === 'share-link' && receiptPageUrl && (
                        <ShareButton
                            url={receiptPageUrl}
                            title={t('officialReceipt.pdf.title')}
                            className="w-full"
                            onClick={() => trackReceiptAction('share_link', 'primary', kind)}
                        >
                            {t('actions.shareReceipt')}
                        </ShareButton>
                    )}

                    {primaryAction === 'split' && (
                        <Button onClick={() => handleSplitBill('primary')} icon="users" shadowSize="4">
                            {t('actions.splitBill')}
                        </Button>
                    )}

                    {primaryAction === 'share-pdf' && (
                        <Button
                            shadowSize="4"
                            className="w-full"
                            loading={pdfFile.busy === 'share'}
                            disabled={pdfFile.unavailable || pdfFile.busy !== null}
                            onClick={() => handleSharePdf('primary')}
                            icon={<Icon name="share" size={20} />}
                            data-testid="pdf-share"
                        >
                            {t('actions.shareReceipt')}
                        </Button>
                    )}

                    {showMoreActionsButton && (
                        <Button
                            variant="secondary"
                            shadowSize="4"
                            className="w-full"
                            onClick={() => setShowMoreActions(true)}
                            data-testid="more-actions-trigger"
                        >
                            {t('actions.moreActions')}
                        </Button>
                    )}

                    {/* the cancel's trigger is the more-actions row, so only the
                        confirm drawer and any error render here. it unmounts once
                        the entry stops being cancellable, which releases the
                        parent drawer lock through its effect cleanup. */}
                    {cancelInDrawer && (
                        <CancelDepositActions
                            transaction={transaction}
                            isPendingBankRequest={isPendingBankRequest}
                            setIsLoading={setIsLoading}
                            onClose={onClose}
                            setIsModalOpen={setIsModalOpen}
                            confirmOpen={showCancelConfirm}
                            onConfirmOpenChange={setShowCancelConfirm}
                        />
                    )}
                </div>
            )}

            {/* public page: download is the one primary; no account actions.
                support sits in the same tight group (S/8) — the link wrapper
                reserves its own 44px target so the two cannot overlap */}
            {isPublic && canDownloadPdf && kind && (
                <div className="flex flex-col gap-2 print:hidden">
                    <DownloadReceiptPdfLink entryId={transaction.id} kind={kind} version={pdfVersion} />
                    {isTest ? <PasskeyDocsLink className="border-t-0 pt-0" /> : <ReceiptSupportLink />}
                </div>
            )}

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
