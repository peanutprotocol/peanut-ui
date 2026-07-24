import Card from '@/components/Global/Card'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { getBankAccountCountryCode } from '@/constants/countryCurrencyMapping'
import { type TransactionDirection, type TransactionType } from '@/components/TransactionDetails/transaction-types'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import {
    hasUserProfile,
    isCardPaymentEntry,
    isPerkReward,
} from '@/components/TransactionDetails/transaction-predicates'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import {
    formatNumberForDisplay,
    formatCurrency,
    printableUserHandle,
    isStableCoin,
    shortenStringLong,
} from '@/utils/general.utils'
import { getAvatarUrl, getTransactionSign } from '@/utils/history.utils'
import React, { lazy, Suspense } from 'react'
import { twMerge } from 'tailwind-merge'
import Image from 'next/image'
import { isAddress } from 'viem'
import { usePrimaryName } from '@justaname.id/react'
import { normalizeEnsName } from '@/utils/ens.utils'
import StatusPill, { type StatusPillType } from '../Global/StatusPill'
import { VerifiedUserLabel } from '../UserHeader'
import { PerkIcon } from './PerkIcon'
import { useHaptic } from 'use-haptic'
import LazyLoadErrorBoundary from '@/components/Global/LazyLoadErrorBoundary'
import { PEANUTMAN } from '@/assets/mascot'
import InvitesIcon from '../Home/InvitesIcon'
import { useRouter } from 'next/navigation'
import { profileUrl } from '@/utils/native-routes'

// Lazy load transaction details drawer (~40KB) to reduce initial bundle size
// Only loaded when user taps a transaction to view details
// Wrapped in error boundary to gracefully handle chunk load failures
const TransactionDetailsDrawer = lazy(() =>
    import('@/components/TransactionDetails/TransactionDetailsDrawer').then((mod) => ({
        default: mod.TransactionDetailsDrawer,
    }))
)

interface TransactionCardProps {
    type: TransactionType
    name: string
    amount: number // For USD, this amount might come signed from mapTransactionDataForDrawer
    status?: StatusPillType
    initials?: string
    position?: CardPosition
    transaction: TransactionDetails
    isPending?: boolean
    haveSentMoneyToUser?: boolean
    hideTxnAmount?: boolean
}

/**
 * component to display a single transaction entry in a list format.
 * it handles displaying the avatar/icon, name, amount, status,
 * and opens a transaction details drawer when clicked.
 */
const TransactionCard: React.FC<TransactionCardProps> = ({
    type,
    name,
    amount,
    status,
    initials = '',
    position = 'middle',
    transaction,
    isPending = false,
    haveSentMoneyToUser = false,
    hideTxnAmount = false,
}) => {
    // hook to manage the state of the details drawer (open/closed, selected transaction)
    const { isDrawerOpen, selectedTransaction, openTransactionDetails, closeTransactionDetails } =
        useTransactionDetailsDrawer()
    const { triggerHaptic } = useHaptic()
    const router = useRouter()

    const handleClick = () => {
        triggerHaptic()
        openTransactionDetails(transaction)
    }

    const canNavigateToProfile = hasUserProfile(transaction)

    // Tap the name → the counterparty's profile (to repeat the send/request);
    // the rest of the card still opens the details drawer (VerifiedUserLabel
    // stops the name tap from bubbling to the card's drawer handler).
    const handleNameClick = () => {
        triggerHaptic()
        router.push(profileUrl(transaction.userName))
    }

    const isLinkTx = transaction.extraDataForDrawer?.isLinkTransaction ?? false
    const isPerkRewardEntry = isPerkReward(transaction)
    // respect user's showFullName preference: use fullName only if showFullName is true, otherwise use username
    const userNameForAvatar =
        transaction.showFullName && transaction.fullName ? transaction.fullName : transaction.userName
    const avatarUrl = getAvatarUrl(transaction)
    // check if this is a test transaction (setup confirmation)
    const isTestTransaction = name === 'Enjoy Peanut!'

    // ENS reverse-lookup for raw addresses; hook is a no-op when name is a username.
    const { primaryName } = usePrimaryName({
        address: isAddress(name) ? (name as `0x${string}`) : undefined,
        chainId: 1,
        priority: 'onChain',
    })
    let displayName = normalizeEnsName(primaryName) ?? name
    // Shortens crypto addresses AND raw UUIDs (usernameless Peanut users whose
    // `identifier` arrives as a userId) so the feed row never renders a 36-char
    // string.
    const shortened = printableUserHandle(displayName)
    if (shortened !== displayName) {
        displayName = shortened
    } else if ((type === 'pay' || type === 'card_pay') && displayName.length > 19) {
        displayName = shortenStringLong(displayName, 0, 16)
    }

    const sign = getTransactionSign(transaction)
    let usdAmount = amount
    // `currency.amount` is treated as the USD-equivalent ONLY when it's
    // actually denominated in USD — that's the cross-token-withdraw case
    // (amount=ETH destination, currency={USD-equiv, USD}). For local-fiat
    // currency blocks (ARS / BRL on Manteca QR pays + Rain card spends with
    // a non-USD merchant) `amount` is already the USD-denominated value and
    // `currency` just carries the local fiat for the "≈ X" subtext below.
    // Without the USD guard the activity row would render the ARS amount
    // formatted as `$X` (e.g. `$40,200` for a $30.24 BOYACA card spend).
    const currencyCodeForUsdCheck = transaction.currency?.code?.toUpperCase()
    if (!isStableCoin(transaction.tokenSymbol ?? 'USDC') && currencyCodeForUsdCheck === 'USD') {
        usdAmount = Number(transaction.currency?.amount ?? amount)
    }

    const formattedAmount = formatCurrency(Math.abs(usdAmount).toString(), 2, 0)
    const formattedTotalAmountCollected = formatCurrency(transaction.totalAmountCollected.toString(), 2, 0)

    let displayAmount = `${sign}$${formattedAmount}`

    if (transaction.isRequestPotLink && Number(transaction.amount) > 0) {
        displayAmount = `$${formattedTotalAmountCollected} / $${formattedAmount}`
    } else if (transaction.isRequestPotLink && Number(transaction.amount) === 0) {
        displayAmount = `$${formattedTotalAmountCollected}`
    }

    let currencyDisplayAmount: string | undefined
    // Secondary line preference:
    //   1. Local fiat (e.g. ARS for Manteca off-ramp) via currency.code/amount
    //   2. Destination token (e.g. ETH for cross-token withdraw) via amount + tokenSymbol
    // Skip both for USD / USD-pegged stablecoins to avoid `$0.10 / ≈ USDC 0.10` noise.
    const ccyCode = transaction.currency?.code.toUpperCase()
    const tokenSymbolUpper = (transaction.tokenSymbol ?? '').toUpperCase()
    if (transaction.currency && ccyCode && ccyCode !== 'USD' && !isStableCoin(ccyCode)) {
        const formattedCurrencyAmount = formatNumberForDisplay(transaction.currency.amount, { maxDecimals: 2 })
        currencyDisplayAmount = `≈ ${ccyCode} ${formattedCurrencyAmount}`
    } else if (
        tokenSymbolUpper &&
        tokenSymbolUpper !== 'USD' &&
        !isStableCoin(tokenSymbolUpper) &&
        transaction.tokenAmount
    ) {
        const formattedTokenAmount = formatNumberForDisplay(transaction.tokenAmount, { maxDecimals: 6 })
        currencyDisplayAmount = `≈ ${formattedTokenAmount} ${tokenSymbolUpper}`
    }

    // Spec §4.4: declined card transactions stay in the feed but are visually
    // de-emphasized so they don't compete with successful items. Scope to
    // declined SPENDS specifically — refunds also populate cardPayment, but
    // a failed refund (e.g. processing error) shouldn't be greyed out.
    const isDeclinedCardSpend =
        status === 'failed' && isCardPaymentEntry(transaction) && !transaction.extraDataForDrawer?.cardPayment?.isRefund

    // Settlement cleared at a different amount than authorized (tip / FX
    // true-up) — flag the row so the balance impact isn't invisible in the
    // feed; the receipt carries the authorized/adjustment breakdown. Refunds
    // excluded like isDeclinedCardSpend above — a refund-auth that clears at
    // a different amount would otherwise render "Refund · Adjusted".
    const isAdjustedCardSpend =
        isCardPaymentEntry(transaction) &&
        Boolean(transaction.extraDataForDrawer?.cardPayment?.settlementAdjusted) &&
        !transaction.extraDataForDrawer?.cardPayment?.isRefund

    return (
        <>
            {/* the clickable card */}
            <Card position={position} onClick={handleClick} className="cursor-pointer" data-testid="transaction-card">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* txn avatar component handles icon/initials/colors */}
                        {isTestTransaction ? (
                            <div className={'relative flex size-7 items-center justify-center rounded-full p-0.5'}>
                                <Image
                                    src={PEANUTMAN}
                                    alt="Peanut Logo"
                                    className="size-8 object-contain"
                                    width={30}
                                    height={30}
                                />
                            </div>
                        ) : isPerkRewardEntry ? (
                            <>
                                <PerkIcon size="extra-small" />
                            </>
                        ) : avatarUrl ? (
                            <div className={'relative flex size-8 items-center justify-center rounded-full'}>
                                <Image
                                    src={avatarUrl}
                                    alt="Icon"
                                    className="size-8 object-contain"
                                    width={30}
                                    height={30}
                                />
                            </div>
                        ) : (
                            <TransactionAvatarBadge
                                initials={initials}
                                userName={userNameForAvatar}
                                isLinkTransaction={isLinkTx}
                                transactionType={type}
                                context="card"
                                size="extra-small"
                                countryCode={getBankAccountCountryCode(
                                    transaction.bankAccountDetails,
                                    transaction.currency?.code
                                )}
                            />
                        )}
                        <div className="flex flex-col">
                            {/* display formatted name (address or username) */}
                            <div className="flex flex-row items-center gap-2">
                                {isPending && <div className="h-2 w-2 animate-pulsate rounded-full bg-primary-1" />}
                                <div className="min-w-0 flex-1 truncate font-roboto text-[16px] font-medium">
                                    <VerifiedUserLabel
                                        username={transaction.userName}
                                        name={displayName}
                                        isVerified={transaction.isVerified}
                                        haveSentMoneyToUser={haveSentMoneyToUser}
                                        onNameClick={canNavigateToProfile ? handleNameClick : undefined}
                                    />
                                </div>
                            </div>
                            {/* display the action icon and type text */}
                            <div className="flex items-center gap-1 text-xs font-medium text-gray-1">
                                {!isTestTransaction && getActionIcon(type, transaction.direction, status)}
                                <span className="capitalize">
                                    {isTestTransaction
                                        ? 'Setup'
                                        : isPerkRewardEntry
                                          ? 'Reward'
                                          : getActionText(type, status)}
                                </span>
                                {status && <StatusPill status={status} />}
                                {isAdjustedCardSpend && <span>· Adjusted</span>}
                            </div>
                        </div>
                    </div>

                    {/* amount and status on the right side */}
                    {isTestTransaction ? (
                        <InvitesIcon animate={false} className="size-4" />
                    ) : (
                        <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end gap-1">
                                {hideTxnAmount ? (
                                    <span className="text-2xl font-bold">****</span>
                                ) : (
                                    <>
                                        <span
                                            className={twMerge(
                                                'font-semibold',
                                                status === 'refunded' && 'text-gray-1 line-through',
                                                // Declined card spends: gray the amount so the row reads
                                                // as "didn't go through" without the opacity-60 wash
                                                // we used before (which dimmed merchant name + icons
                                                // too and made the row hard to read at a glance).
                                                isDeclinedCardSpend && 'text-gray-1'
                                            )}
                                        >
                                            {displayAmount}
                                        </span>
                                        {currencyDisplayAmount && (
                                            <span
                                                className={twMerge(
                                                    'text-sm font-medium text-gray-1',
                                                    status === 'refunded' && 'line-through'
                                                )}
                                            >
                                                {currencyDisplayAmount}
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Card>

            {/* Transaction Details Drawer */}
            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <TransactionDetailsDrawer
                        isOpen={isDrawerOpen && selectedTransaction?.id === transaction.id}
                        onClose={closeTransactionDetails}
                        transaction={selectedTransaction}
                        transactionAmount={displayAmount}
                        avatarUrl={avatarUrl}
                    />
                </Suspense>
            </LazyLoadErrorBoundary>
        </>
    )
}

// Per-type presentation: the feed row's action icon + label. One table keyed
// by TransactionType replaces the two parallel switches these used to be, so a
// new type is a single row here instead of an edit in two places that can
// drift out of sync. `icon: null` means "no icon" (e.g. `request`, which is
// direction-dependent and handled in getActionIcon). `text` defaults to the
// type literal when omitted (matches the old `let actionText = type` fallback).
const TYPE_PRESENTATION: Record<TransactionType, { icon: IconName | null; iconSize?: number; text?: string }> = {
    send: { icon: 'arrow-up-right' },
    receive: { icon: 'arrow-down-left' },
    request: { icon: null }, // direction-dependent — see getActionIcon
    withdraw: { icon: 'arrow-up', iconSize: 8 },
    cashout: { icon: 'arrow-up', iconSize: 8 },
    claim_external: { icon: 'arrow-up', iconSize: 8, text: 'Claim' },
    bank_claim: { icon: 'arrow-up', iconSize: 8, text: 'Claim' },
    bank_withdraw: { icon: 'arrow-up', iconSize: 8, text: 'Withdraw' },
    add: { icon: 'arrow-down', iconSize: 8 },
    bank_deposit: { icon: 'arrow-down', iconSize: 8, text: 'Add' },
    bank_request_fulfillment: { icon: 'arrow-up-right', text: 'Request paid via bank' },
    pay: { icon: 'arrow-up-right' },
    // 'Pay' for card spends — the `card_pay` literal is an internal
    // discriminator (see TransactionType comment) that renders as "Pay".
    card_pay: { icon: 'arrow-up-right', text: 'Pay' },
    // Refund credit row — same inbound arrow as 'receive', labelled "Refund".
    refund: { icon: 'arrow-down-left', text: 'Refund' },
}

// helper functions
function getActionIcon(
    type: TransactionType,
    direction: TransactionDirection,
    status?: StatusPillType
): React.ReactNode {
    if (status === 'refunded') {
        return <Icon name="arrow-down-left" size={7} fill="currentColor" />
    }
    // `request` is the one type whose icon depends on direction (incoming vs
    // outgoing request), so it stays out of the table.
    if (type === 'request') {
        const iconName: IconName = direction === 'request_received' ? 'arrow-up-right' : 'arrow-down-left'
        return <Icon name={iconName} size={7} fill="currentColor" />
    }
    const { icon, iconSize } = TYPE_PRESENTATION[type]
    if (!icon) return null
    return <Icon name={icon} size={iconSize ?? 7} fill="currentColor" />
}

function getActionText(type: TransactionType, status?: StatusPillType): string {
    if (status === 'refunded') return 'Refund'
    return TYPE_PRESENTATION[type].text ?? type
}

export default TransactionCard
