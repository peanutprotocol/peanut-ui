import { ListItem } from '@/components/0_Bruddle/ListItem'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import IndicatorDot from '@/components/Global/IndicatorDot'
import TransactionAvatarBadge from '@/components/TransactionDetails/TransactionAvatarBadge'
import { getBankAccountCountryCode } from '@/constants/countryCurrencyMapping'
import { type TransactionDirection, type TransactionType } from '@/components/TransactionDetails/transaction-types'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { translateTransactionName } from '@/components/TransactionDetails/transaction-name-keys'
import {
    hasUserProfile,
    isCardPaymentEntry,
    isPerkReward,
} from '@/components/TransactionDetails/transaction-predicates'
import { useTranslations } from 'next-intl'
import {
    formatNumberForDisplay,
    formatCurrency,
    printableUserHandle,
    isStableCoin,
    shortenStringLong,
} from '@/utils/general.utils'
import {
    getAvatarUrl,
    getTransactionSign,
    isOpenRequestDisplay,
    isTestTransaction,
    PENDING_AMOUNT_STATUSES,
    STRUCK_AMOUNT_STATUSES,
} from '@/utils/history.utils'
import React, { lazy, Suspense, useEffect, useRef } from 'react'
import { twMerge } from '@/utils/tw'
import Image from 'next/image'
import { isAddress } from 'viem'
import { usePrimaryNameServer } from '@/hooks/usePrimaryNameServer'
import { normalizeEnsName } from '@/utils/ens-name.utils'
import StatusPill, { type StatusPillType } from '../Global/StatusPill'
import { VerifiedUserLabel } from '../UserHeader'
import { PerkIcon } from './PerkIcon'
import { useAppHaptic } from '@/hooks/useAppHaptic'
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
    /** whether this row's receipt drawer is open — computed by the LIST from
     *  useTransactionDetailsDrawer, so N rows don't each subscribe to `?tx=` */
    isSelected: boolean
    /** the list's (stable) useTransactionDetailsDrawer callbacks */
    onOpen: (transaction: TransactionDetails) => void
    onClose: () => void
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
    isSelected,
    onOpen,
    onClose,
}) => {
    // mount the (lazy, vaul) drawer only once this row has been selected —
    // keeps N history rows from each carrying a mounted dialog, while the
    // ref keeps it mounted through the close animation. Written in an effect
    // (not during render) so a discarded render can't leak the flag.
    const hasBeenSelectedRef = useRef(false)
    useEffect(() => {
        if (isSelected) hasBeenSelectedRef.current = true
    }, [isSelected])
    const { triggerHaptic } = useAppHaptic()
    const router = useRouter()
    const t = useTranslations('transaction')

    const handleClick = () => {
        triggerHaptic()
        onOpen(transaction)
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
    const isTest = isTestTransaction(name)

    // FE-generated labels carry a catalog key — localize; real counterparty
    // names (usernames, merchants, addresses) pass through as data.
    const localizedName = transaction.nameKey
        ? translateTransactionName(t, transaction.nameKey, transaction.nameParams)
        : name

    // ENS reverse-lookup for raw addresses; hook is a no-op when name is a username.
    const { primaryName } = usePrimaryNameServer(isAddress(name) ? name : undefined)
    let displayName = normalizeEnsName(primaryName) ?? localizedName
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

    // States board 17966:12128 amount treatment — the single place both the
    // home widget and the history page inherit:
    //   incoming successful = base state (no "+", no badge — see getTransactionSign)
    //   pending family      = greyed amount + pending chip
    //   cancelled           = strikethrough, no chip
    //   failed              = strikethrough + failed chip
    //   refunded            = strikethrough + refund chip (board is silent; kept from before)
    // Status families come from history.utils so they stay in lockstep with
    // STATUS_SHOWS_SIGN (the sign rule) — don't re-list statuses here.
    //
    // Carve-out (kept from the old isDeclinedCardSpend rule): a FAILED card
    // REFUND is money still owed to the user — striking it through reads as
    // "this credit never counted". It keeps the failed chip but not the strike.
    const isFailedCardRefund =
        status === 'failed' &&
        isCardPaymentEntry(transaction) &&
        !!transaction.extraDataForDrawer?.cardPayment?.isRefund
    // Open requests (unfulfilled request links + pots) are exempt from the
    // pending treatment — no greyed amount, no pending chip. See
    // isOpenRequestDisplay for the reasoning; PR #2813 review.
    const isOpenRequest = isOpenRequestDisplay(transaction)
    const isPendingAmount = !!status && PENDING_AMOUNT_STATUSES.has(status) && !isOpenRequest
    const isStruckAmount = !!status && STRUCK_AMOUNT_STATUSES.has(status) && !isFailedCardRefund
    const showStatusChip =
        !!status &&
        status !== 'completed' &&
        status !== 'closed' &&
        status !== 'cancelled' &&
        !(isOpenRequest && PENDING_AMOUNT_STATUSES.has(status))

    // Settlement cleared at a different amount than authorized (tip / FX
    // true-up) — flag the row so the balance impact isn't invisible in the
    // feed; the receipt carries the authorized/adjustment breakdown. Refunds
    // excluded like isFailedCardRefund above — a refund-auth that clears at
    // a different amount would otherwise render "Refund · Adjusted".
    const isAdjustedCardSpend =
        isCardPaymentEntry(transaction) &&
        Boolean(transaction.extraDataForDrawer?.cardPayment?.settlementAdjusted) &&
        !transaction.extraDataForDrawer?.cardPayment?.isRefund

    // txn avatar handles icon/initials/colors — the row's leading slot
    const leading = isTest ? (
        <div className={'relative flex size-7 items-center justify-center rounded-full p-0.5'}>
            <Image src={PEANUTMAN} alt="Peanut Logo" className="size-8 object-contain" width={30} height={30} />
        </div>
    ) : isPerkRewardEntry ? (
        <PerkIcon size="extra-small" />
    ) : avatarUrl ? (
        <div className={'relative flex size-8 items-center justify-center rounded-full'}>
            <Image src={avatarUrl} alt="Icon" className="size-8 object-contain" width={30} height={30} />
        </div>
    ) : (
        <TransactionAvatarBadge
            initials={initials}
            userName={userNameForAvatar}
            isLinkTransaction={isLinkTx}
            transactionType={type}
            context="card"
            size="extra-small"
            countryCode={getBankAccountCountryCode(transaction.bankAccountDetails, transaction.currency?.code)}
        />
    )

    return (
        <>
            {/* the clickable row — figma list-item board anatomy */}
            <ListItem
                position={position}
                onClick={handleClick}
                data-testid="transaction-card"
                leading={leading}
                title={
                    <div className="flex flex-row items-center gap-2">
                        {isPending && <IndicatorDot className="h-2 w-2 animate-pulsate" />}
                        <div className="min-w-0 flex-1 truncate">
                            <VerifiedUserLabel
                                username={transaction.userName}
                                name={displayName}
                                isVerified={transaction.isVerified}
                                haveSentMoneyToUser={haveSentMoneyToUser}
                                onNameClick={canNavigateToProfile ? handleNameClick : undefined}
                            />
                        </div>
                    </div>
                }
                body={
                    <div className="flex items-center gap-1">
                        {!isTest && getActionIcon(type, transaction.direction, status)}
                        <span>
                            {isTest
                                ? t('type.setup')
                                : isPerkRewardEntry
                                  ? t('type.reward')
                                  : t(getActionLabelKey(type, status))}
                        </span>
                        {showStatusChip && status && <StatusPill status={status} />}
                        {isAdjustedCardSpend && <span>{t('adjustedSuffix')}</span>}
                    </div>
                }
                trailing={
                    isTest ? (
                        <InvitesIcon animate={false} className="size-4" />
                    ) : (
                        <div className="flex flex-col items-end gap-1">
                            {hideTxnAmount ? (
                                <span className="text-body-m-semibold">****</span>
                            ) : (
                                <>
                                    <span
                                        className={twMerge(
                                            'text-body-m-semibold text-foreground-primary',
                                            isPendingAmount && 'opacity-40',
                                            isStruckAmount && 'line-through'
                                        )}
                                    >
                                        {displayAmount}
                                    </span>
                                    {currencyDisplayAmount && (
                                        <span
                                            className={twMerge(
                                                'text-body-s text-foreground-secondary',
                                                isPendingAmount && 'opacity-40',
                                                isStruckAmount && 'line-through'
                                            )}
                                        >
                                            {currencyDisplayAmount}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    )
                }
            />

            {/* Transaction Details Drawer */}
            <LazyLoadErrorBoundary>
                <Suspense fallback={null}>
                    <TransactionDetailsDrawer
                        isOpen={isSelected}
                        onClose={onClose}
                        transaction={isSelected || hasBeenSelectedRef.current ? transaction : null}
                        transactionAmount={displayAmount}
                        avatarUrl={avatarUrl}
                    />
                </Suspense>
            </LazyLoadErrorBoundary>
        </>
    )
}

// Per-type presentation: the feed row's action icon. One table keyed by
// TransactionType replaces the switch this used to be, so a new type is a
// single row here. `icon: null` means "no icon" (e.g. `request`, which is
// direction-dependent and handled in getActionIcon). The row's label lives
// in the `transaction.type.*` catalog, keyed by the same literal.
const TYPE_PRESENTATION: Record<TransactionType, { icon: IconName | null; iconSize?: number }> = {
    send: { icon: 'arrow-up-right' },
    receive: { icon: 'arrow-down-left' },
    request: { icon: null }, // direction-dependent — see getActionIcon
    withdraw: { icon: 'arrow-up', iconSize: 8 },
    cashout: { icon: 'arrow-up', iconSize: 8 },
    claim_external: { icon: 'arrow-up', iconSize: 8 },
    bank_claim: { icon: 'arrow-up', iconSize: 8 },
    bank_withdraw: { icon: 'arrow-up', iconSize: 8 },
    add: { icon: 'arrow-down', iconSize: 8 },
    bank_deposit: { icon: 'arrow-down', iconSize: 8 },
    bank_request_fulfillment: { icon: 'arrow-up-right' },
    pay: { icon: 'arrow-up-right' },
    card_pay: { icon: 'arrow-up-right' },
    // Refund credit row — same inbound arrow as 'receive', labelled "Refund".
    refund: { icon: 'arrow-down-left' },
}

const TYPE_LABEL_KEYS = {
    send: 'type.send',
    receive: 'type.receive',
    request: 'type.request',
    withdraw: 'type.withdraw',
    cashout: 'type.cashout',
    claim_external: 'type.claim_external',
    bank_claim: 'type.bank_claim',
    bank_withdraw: 'type.bank_withdraw',
    add: 'type.add',
    bank_deposit: 'type.bank_deposit',
    bank_request_fulfillment: 'type.bank_request_fulfillment',
    pay: 'type.pay',
    card_pay: 'type.card_pay',
    refund: 'type.refund',
} as const satisfies Record<TransactionType, string>

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

/** Catalog key for the row's action label — refunded rows read "Refund"
 *  regardless of the underlying type. */
function getActionLabelKey(type: TransactionType, status?: StatusPillType) {
    return TYPE_LABEL_KEYS[status === 'refunded' ? 'refund' : type]
}

// memo: history is an unvirtualized infinite list — without this, any
// drawer open/close re-rendered every loaded row (each row read `?tx=`).
export default React.memo(TransactionCard)
