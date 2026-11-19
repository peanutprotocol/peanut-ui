'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReturnTo } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import { Card } from '@/components/0_Bruddle/Card'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import PointsCard from '@/components/Common/PointsCard'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { useAuth } from '@/context/authContext'
import { getShakeClass } from '@/utils/perk.utils'
import { calculateSavingsInCents, hasCardMarkupComparison } from '@/utils/qr-payment.utils'
import { formatCurrency } from '@/utils/general.utils'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { trackReceiptAction } from '@/components/TransactionDetails/receipt-action-analytics'
import { useQrPayFlow } from '../QrPayFlowContext'
import { useQrReceipt } from '../useQrReceipt'
import { usePerkHoldToClaim } from '../usePerkHoldToClaim'
import { PaidRewardCard } from '@/features/payments/shared/components/PaidRewardCard'
import { HoldToClaimButton } from '@/features/payments/shared/components/HoldToClaimButton'

export function QrPaySuccessView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    // rewinds to home past every entry the flow pushed; a replace kept the
    // earlier entries, so back from home re-entered the flow
    const leaveToHome = useReturnTo('/home')
    const { user } = useAuth()
    const {
        paidReward,
        markRewardClaimed,
        currency,
        usdAmount,
        pointsData,
        pointsDivRef,
        pixKeyOwner,
        paidTo,
        paidLocalAmount,
    } = useQrPayFlow()
    const { rewardOffered, perkClaimed, holdProgress, isShaking, shakeIntensity, startHold, cancelHold } =
        usePerkHoldToClaim(paidReward, markRewardClaimed)
    const { openTransactionDetails, isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false)
    // a double tap would push /request twice and leave a duplicate history entry
    const splitNavigatedRef = useRef(false)

    // Live card-vs-local-rail markup, driven by Manteca's rate + (for ARS)
    // BCRA's official rate. Same hook (and cache entry) the confirm screen's
    // "Save vs card" row reads — keeps the two in sync.
    const { data: cardMarkup } = useCardMarkupRate(currency?.code, currency?.price)

    const receiptTransaction = useQrReceipt()

    // The payment settled but the response has not landed yet — one render at
    // most; the old page returned null from the same race.
    if (!paidLocalAmount || !currency) return null

    // Show "saved $X vs card" only for currencies with a meaningful
    // card-vs-local-rail gap (ARS; never BRL — see CARD_FX_MARKUP_BY_CURRENCY).
    // Rate is live (BCRA for ARS) via useCardMarkupRate above.
    const savingsInCents = calculateSavingsInCents(usdAmount, cardMarkup?.rate)
    const showSavingsMessage = savingsInCents > 0 && hasCardMarkupComparison(currency?.code)
    // < $1 reads in cents, otherwise in dollars — same split the old English-only util made
    const savingsMessage = showSavingsMessage
        ? savingsInCents < 100
            ? t('success.savedVsCardCents', { count: savingsInCents })
            : t('success.savedVsCardDollars', {
                  amount: formatCurrency(savingsInCents / 100),
              })
        : ''

    // `rewardOffered` is the hook's verdict (reserved AND not a failed payout);
    // `claimed` is a reveal flag (local hold or API), not payout settlement.
    // A failed payout is never revealed, whatever the flag says.
    const rewardRevealed = rewardOffered && (perkClaimed || !!paidReward?.perk?.claimed)
    const rewardClaimable = rewardOffered && !rewardRevealed

    return (
        <PageStack className={getShakeClass(isShaking, shakeIntensity)}>
            <SoundPlayer sound="success" />
            <NavHeader title={tNav('pay')} />
            <PageStack.Center className="gap-4">
                {/* Only show payment card if reward was not revealed */}
                {!rewardRevealed && (
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <IconBubble icon="check" color="green" />
                        </div>

                        <div className="flex flex-col gap-1">
                            <h1
                                className={`text-body-s font-normal text-foreground-secondary ${pixKeyOwner ? 'ph-mask ph-no-capture' : ''}`}
                            >
                                {t('success.youPaid', { merchant: paidTo })}
                            </h1>
                            <div className="text-heading-s">
                                {currency.symbol} {formatCurrency(paidLocalAmount)}
                            </div>
                            <div className="text-heading-card">≈ {formatCurrency(usdAmount ?? undefined)} USD</div>
                            {/* Savings Message (Argentina Manteca only) */}
                            {showSavingsMessage && savingsMessage && (
                                <p className="text-body-s text-foreground-secondary italic">{savingsMessage}</p>
                            )}
                        </div>
                    </Card>
                )}

                {/* the reward: hold to claim it, then its banner */}
                {rewardOffered && (
                    <PaidRewardCard reward={paidReward} revealed={rewardRevealed} cardRef={pointsDivRef} />
                )}

                {/* Points Display - ref used for confetti origin point */}
                {!rewardOffered && pointsData?.estimatedPoints && (
                    <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                )}

                <div className="flex w-full flex-col gap-4">
                    {/* Show Claim Reward button if eligible and not claimed yet */}
                    {rewardClaimable ? (
                        <HoldToClaimButton holdProgress={holdProgress} startHold={startHold} cancelHold={cancelHold} />
                    ) : (
                        <>
                            {/* after claiming a reward, primary CTA is "Done" — not "Split this bill" */}
                            {rewardRevealed ? (
                                <Button shadowSize="4" onClick={leaveToHome}>
                                    {tCommon('goToHome')}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        if (splitNavigatedRef.current) return
                                        splitNavigatedRef.current = true
                                        trackReceiptAction('split', 'qr_success', 'QR_PAY')
                                        // same query-builder shape as withdraw's downstreamQuery —
                                        // /request seeds its form from these params
                                        // A person's name paid by PIX key stays out of the URL,
                                        // which analytics records and a request can be shared from.
                                        const params = new URLSearchParams({
                                            amount: String(usdAmount ?? ''),
                                            ...(pixKeyOwner ? {} : { merchant: paidTo }),
                                        })
                                        const splitBillUrl = `/request?${params.toString()}`
                                        router.push(splitBillUrl)
                                    }}
                                    icon="users"
                                    shadowSize="4"
                                >
                                    {t('success.splitThisBill')}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                shadowSize="4"
                                disabled={!receiptTransaction}
                                onClick={() => {
                                    if (receiptTransaction) {
                                        openTransactionDetails(receiptTransaction)
                                    }
                                }}
                            >
                                {t('success.seeReceipt')}
                            </Button>
                        </>
                    )}

                    {/* Underlined text, not a button, so the stack stays at two filled
                        CTAs. Not gated on isActivated (the receipt nudge is): on a first
                        QR pay that flag is still false server-side. Hidden while a reward
                        is claimable so it cannot compete with the hold-to-claim gesture. */}
                    {user?.user.username && !rewardClaimable && (
                        <LinkButton onClick={() => setShowInviteFriendsModal(true)} className="w-full justify-center">
                            <Icon name="invite-heart" size={16} className="shrink-0" />
                            {t('success.inviteFriendsCta')}
                        </LinkButton>
                    )}
                </div>
            </PageStack.Center>
            <TransactionDetailsDrawer
                isOpen={isTransactionSelected(receiptTransaction?.id)}
                onClose={closeTransactionDetails}
                transaction={receiptTransaction}
            />
            {/* Mounted only while open: the modal's shown-guard is a ref that lives
                for the mount, so a persistent mount would swallow the MODAL_SHOWN /
                REFERRAL_CTA_SHOWN pair on every re-open. The modal fires every
                referral capture; this page fires none. */}
            {showInviteFriendsModal && user?.user.username && (
                <InviteFriendsModal
                    visible
                    onClose={() => setShowInviteFriendsModal(false)}
                    username={user.user.username}
                    source={REFERRAL_SOURCES.QR_PAY_SUCCESS}
                />
            )}
        </PageStack>
    )
}
