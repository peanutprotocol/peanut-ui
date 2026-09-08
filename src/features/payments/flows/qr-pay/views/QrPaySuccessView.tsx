'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import Card from '@/components/Global/Card'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import InviteFriendsModal from '@/components/Global/InviteFriendsModal'
import PointsCard from '@/components/Common/PointsCard'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { useCardMarkupRate } from '@/hooks/useCardMarkupRate'
import { useAuth } from '@/context/authContext'
import { getShakeClass } from '@/utils/perk.utils'
import { calculateSavingsInCents, hasCardMarkupComparison } from '@/utils/qr-payment.utils'
import { formatNumberForDisplay } from '@/utils/general.utils'
import { STAR_STRAIGHT_ICON } from '@/assets/icons'
import { REFERRAL_SOURCES } from '@/constants/analytics.consts'
import { useQrPayFlow } from '../QrPayFlowContext'
import { usePerkHoldToClaim } from '../usePerkHoldToClaim'

export function QrPaySuccessView() {
    const t = useAppTranslations('qrPay')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const { user } = useAuth()
    const { qrPayment, setQrPayment, paymentLock, currency, usdAmount, methodIcon, pointsData, pointsDivRef } =
        useQrPayFlow()
    const { perkClaimed, holdProgress, isShaking, shakeIntensity, startHold, cancelHold } = usePerkHoldToClaim(
        qrPayment,
        setQrPayment
    )
    const { openTransactionDetails, isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    const [showInviteFriendsModal, setShowInviteFriendsModal] = useState(false)

    // Live card-vs-local-rail markup, driven by Manteca's rate + (for ARS)
    // BCRA's official rate. Same hook (and cache entry) the confirm screen's
    // "Save vs card" row reads — keeps the two in sync.
    const { data: cardMarkup } = useCardMarkupRate(currency?.code, currency?.price)

    // receipt transaction for the success drawer — built up-front (not in the
    // cta's onClick) because the drawer opens off the url's `?tx=` match.
    const receiptTransaction: TransactionDetails | null = useMemo(() => {
        if (!qrPayment || !currency) return null
        const now = new Date()
        return {
            // Manteca synthetic id — the only key /receipt/<id>
            // resolves, and what Activity rows already carry.
            // `externalId` is UUID-shaped, so it slips past the
            // id-shape gate and 404s silently instead of erroring.
            id: qrPayment.id,
            direction: 'qr_payment',
            userName: qrPayment.details.merchant.name,
            fullName: qrPayment.details.merchant.name,
            amount: Number(usdAmount),
            currency: {
                amount: qrPayment.details.paymentAssetAmount,
                code: currency.code,
            },
            initials: 'QR',
            currencySymbol: currency.symbol,
            status: 'completed',
            date: now,
            createdAt: now,
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'QR_PAY',
                provider: 'MANTECA',
                avatarUrl: methodIcon,
                receipt: {
                    exchange_rate: currency.price.toString(),
                },
            },
            totalAmountCollected: Number(usdAmount),
        }
    }, [qrPayment, currency, usdAmount, methodIcon])

    // The payment settled but the response has not landed yet — one render at
    // most; the old page returned null from the same race.
    if (!qrPayment || !currency) return null

    // Show "saved $X vs card" only for currencies with a meaningful
    // card-vs-local-rail gap (ARS, BRL — see CARD_FX_MARKUP_BY_CURRENCY).
    // Rate is live (BCRA for ARS) via useCardMarkupRate above.
    const savingsInCents = calculateSavingsInCents(usdAmount, cardMarkup?.rate)
    const showSavingsMessage = savingsInCents > 0 && hasCardMarkupComparison(currency?.code)
    // < $1 reads in cents, otherwise in dollars — same split the old English-only util made
    const savingsMessage = showSavingsMessage
        ? savingsInCents < 100
            ? t('success.savedVsCardCents', { count: savingsInCents })
            : t('success.savedVsCardDollars', {
                  amount: formatNumberForDisplay((savingsInCents / 100).toString(), { maxDecimals: 2 }),
              })
        : ''

    const rewardClaimable = !!qrPayment?.perk?.eligible && !perkClaimed && !qrPayment.perk.claimed

    return (
        <div className={`flex min-h-inherit flex-col gap-8 ${getShakeClass(isShaking, shakeIntensity)}`}>
            <SoundPlayer sound="success" />
            <NavHeader title={tNav('pay')} />
            <div className="my-auto space-y-4 flex h-full flex-col justify-center">
                {/* Only show payment card if reward was not claimed */}
                {!perkClaimed && !qrPayment?.perk?.claimed && (
                    <Card className="flex flex-row items-center gap-3 p-4">
                        <div className="flex items-center gap-3">
                            <IconBubble icon="check" color="green" />
                        </div>

                        <div className="space-y-1">
                            <h1 className="text-body-s font-normal text-foreground-secondary">
                                {t('success.youPaid', {
                                    merchant:
                                        qrPayment?.details.merchant.name ?? paymentLock?.paymentRecipientName ?? '',
                                })}
                            </h1>
                            <div className="text-heading-s">
                                {currency.symbol}{' '}
                                {formatNumberForDisplay(
                                    qrPayment?.details.paymentAssetAmount ?? paymentLock?.paymentAssetAmount,
                                    { maxDecimals: 2 }
                                )}
                            </div>
                            <div className="text-heading-card">
                                ≈ {formatNumberForDisplay(usdAmount ?? undefined, { maxDecimals: 2 })} USD
                            </div>
                            {/* Savings Message (Argentina Manteca only) */}
                            {showSavingsMessage && savingsMessage && (
                                <p className="text-body-s text-foreground-secondary italic">{savingsMessage}</p>
                            )}
                        </div>
                    </Card>
                )}

                {/* Reward Eligibility Card - Show before claiming */}
                {rewardClaimable && (
                    <Card ref={pointsDivRef} className="flex items-start gap-3 bg-white p-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={24} height={24} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-heading-card">{t('success.earnedRewardTitle')}</h2>
                            <p className="text-body-s">
                                {(() => {
                                    const amountSponsored = qrPayment?.perk?.amountSponsored
                                    if (amountSponsored && typeof amountSponsored === 'number') {
                                        return t('success.earnedHoldToClaim', {
                                            amount: amountSponsored.toFixed(2),
                                        })
                                    }

                                    return t('success.holdToClaim')
                                })()}
                            </p>
                        </div>
                    </Card>
                )}

                {/* Reward Success Banner - Show after claiming */}
                {(perkClaimed || qrPayment?.perk?.claimed) && (
                    <Card className="flex items-start gap-3 bg-white p-4">
                        <div className="flex max-w-[15%] flex-shrink-0 items-center justify-center rounded-full p-2">
                            <Image src={STAR_STRAIGHT_ICON} alt="star" width={28} height={28} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="text-heading-s">{t('success.earnedRewardTitle')}</h2>
                            <p className="text-body-m">
                                {(() => {
                                    const amountSponsored = qrPayment?.perk?.amountSponsored

                                    if (amountSponsored && typeof amountSponsored === 'number') {
                                        return t('success.earnedInviteFriends', {
                                            amount: amountSponsored.toFixed(2),
                                        })
                                    }

                                    return t('success.inviteFriends')
                                })()}
                            </p>
                        </div>
                    </Card>
                )}

                {/* Points Display - ref used for confetti origin point */}
                {!qrPayment?.perk?.eligible && pointsData?.estimatedPoints && (
                    <PointsCard points={pointsData.estimatedPoints} pointsDivRef={pointsDivRef} />
                )}

                <div className="space-y-4 w-full">
                    {/* Show Claim Reward button if eligible and not claimed yet */}
                    {rewardClaimable ? (
                        <Button
                            onPointerDown={startHold}
                            onPointerUp={cancelHold}
                            onPointerLeave={cancelHold}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    startHold()
                                }
                            }}
                            onKeyUp={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    cancelHold()
                                }
                            }}
                            onContextMenu={(e) => {
                                // Prevent context menu from appearing
                                e.preventDefault()
                            }}
                            shadowSize="4"
                            className="relative touch-manipulation overflow-hidden select-none"
                            style={{
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            {/* progress fill from left to right */}
                            <div
                                className="absolute inset-0 bg-black transition-all duration-instant"
                                style={{
                                    width: `${holdProgress}%`,
                                    left: 0,
                                }}
                            />
                            {(() => {
                                const label = t('success.claimReward')
                                return (
                                    <>
                                        <span className="relative z-10">{label}</span>
                                        <span
                                            className="absolute inset-0 z-20 flex items-center justify-center text-white transition-all duration-instant"
                                            style={{ clipPath: `inset(0 ${100 - holdProgress}% 0 0)` }}
                                        >
                                            {label}
                                        </span>
                                    </>
                                )
                            })()}
                        </Button>
                    ) : (
                        <>
                            {/* after claiming a reward, primary CTA is "Done" — not "Split this bill" */}
                            {perkClaimed || qrPayment?.perk?.claimed ? (
                                <Button shadowSize="4" onClick={() => router.push('/home')}>
                                    {tCommon('goToHome')}
                                </Button>
                            ) : (
                                <Button
                                    onClick={() => {
                                        // same query-builder shape as withdraw's downstreamQuery —
                                        // /request seeds its form from these params
                                        const params = new URLSearchParams({
                                            amount: String(usdAmount ?? ''),
                                            merchant: qrPayment.details.merchant.name,
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
                                variant="primary-soft"
                                shadowSize="4"
                                disabled={false}
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
                        <button
                            onClick={() => setShowInviteFriendsModal(true)}
                            className="flex w-full items-center justify-center gap-2 text-body-s text-foreground-secondary underline transition-colors hover:text-black active:text-black"
                        >
                            <Icon name="invite-heart" size={16} className="text-foreground-secondary" />
                            {t('success.inviteFriendsCta')}
                        </button>
                    )}
                </div>
            </div>
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
        </div>
    )
}
