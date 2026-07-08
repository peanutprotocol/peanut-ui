import { type StatusType } from '@/components/Global/Badges/StatusBadge'
import {
    type TransactionDirection,
    type TransactionType as TransactionCardType,
} from '@/components/TransactionDetails/transaction-types'
import { EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
import {
    getExplorerUrl,
    getInitialsFromName,
    getTokenDetails,
    getChainName,
    getTokenLogo,
    getChainLogo,
} from '@/utils/general.utils'
import { type StatusPillType } from '../Global/StatusPill'
import type { Address } from 'viem'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { type HistoryEntryPerkReward, type ChargeEntry } from '@/services/services.types'
import { dispatchStrategy, isIntentKind, type IntentKind } from './strategies/registry'

/** Rain dispute lifecycle status values. Source: Rain dispute.* webhooks. */
export type DisputeStatus = 'pending' | 'inReview' | 'accepted' | 'rejected' | 'canceled' | 'resolvedByMerchant'

const DISPUTE_STATUSES: ReadonlySet<string> = new Set([
    'pending',
    'inReview',
    'accepted',
    'rejected',
    'canceled',
    'resolvedByMerchant',
])

function isDisputeStatus(value: unknown): value is DisputeStatus {
    return typeof value === 'string' && DISPUTE_STATUSES.has(value)
}

// Mirror of peanut-api-ts `enum TransactionProvider`. Receipts that branch
// on provider (e.g. Manteca-specific deposit-info row) use this typed
// value via `extraDataForDrawer.provider` for positive identity rather
// than inferring from the absence of other fields.
//
// Stays a string union (not an enum) so it stays interchangeable with the
// wire string at runtime and so adding a value here forces TS-side updates
// at every gate that switches on it. Deprecated values are kept so old
// rows that still carry them on the wire don't blow up the type system.
export type Provider =
    | 'PEANUT'
    | 'BRIDGE'
    | 'MANTECA'
    | 'RHINO'
    | 'RAIN'
    | 'ONCHAIN'
    | 'DEPRECATED_SIMPLEFI'
    | 'DEPRECATED_SQUID'

/**
 * @fileoverview maps raw transaction history data from the api/hook to the format needed by ui components.
 */

// Wire-level read of `entry.extraData.kind`. Runtime-guarded against the
// strategy registry's IntentKind union — an unknown kind returns undefined
// (which routes to intentFallback downstream) instead of a silent cast.
function intentKindOf(entry: HistoryEntry): IntentKind | undefined {
    const kind = entry.extraData?.kind
    return isIntentKind(kind) ? kind : undefined
}

/**
 * Should the receipt drawer's `bankAccountDetails` row render for this entry?
 *
 * Fires for any flow whose recipient is a bank account: OFFRAMP (Bridge or
 * Manteca), CRYPTO_WITHDRAW (USDC out, sometimes to an IBAN), and the
 * BANK_SEND_LINK_CLAIM path (an OFFRAMP intent claimed via Peanut sendlink,
 * surfaced via extraData.bridgeFlow). Without the BANK_SEND_LINK_CLAIM lane
 * the IBAN row would disappear and `getBankAccountCountryCode`'s country-by-
 * IBAN fallback would render an EU flag for an ES IBAN.
 */
function shouldPlumbBankAccountDetails(entry: HistoryEntry): boolean {
    const kind = intentKindOf(entry)
    if (kind === 'OFFRAMP' || kind === 'CRYPTO_WITHDRAW') return true
    if (entry.extraData?.bridgeFlow === 'BANK_SEND_LINK_CLAIM' && entry.userRole === EHistoryUserRole.RECIPIENT) {
        return true
    }
    return false
}

// Bank-deposit instructions blob — Bridge ships this verbatim from its
// transfer API (BE: BridgeHistoryFetcher forwards `source_deposit_instructions`).
// Multi-rail union of fields; `AddMoneyBankDetails` reads whichever subset
// matches the rail. Exported so the transformer can cast at the wire
// boundary and the drawer can keep its strict shape.
export interface DrawerDepositInstructions {
    amount: string
    currency: string
    bank_name: string
    bank_address: string
    payment_rail: string
    deposit_message: string
    // US format
    bank_account_number?: string
    bank_routing_number?: string
    bank_beneficiary_name?: string
    bank_beneficiary_address?: string
    // European format
    iban?: string
    bic?: string
    account_holder_name?: string
    // UK faster_payments format
    sort_code?: string
    account_number?: string
    // Mexican format (SPEI)
    clabe?: string
}

// Manteca / Bridge offramp receipt block. Manteca populates
// `depositDetails`; Bridge populates the broader fee/amount cluster.
export interface DrawerReceipt {
    depositDetails?: {
        depositAddress: string
        depositAlias: string
    }
    initial_amount?: string
    developer_fee?: string
    exchange_fee?: string
    subtotal_amount?: string
    gas_fee?: string
    final_amount?: string
    exchange_rate?: string
}

export type RewardData = {
    symbol: string
    formatAmount: (amount: number | bigint) => string
    getSymbol: (amount: number | bigint) => string
    avatarUrl: string
}
// Configure reward tokens here
export const REWARD_TOKENS: { [key: string]: RewardData } = {}

/**
 * User-facing copy for reaper-failed rows. Keyed by the failReason string
 * the BE reaper writes (`${kindStr.toLowerCase()}_timeout`).
 *
 * Why per-kind: a generic "Transaction failed" is ambiguous ("did funds
 * move?"). These strings make clear the action never happened — no funds
 * moved, no chain TX exists. Don't show a Cancel button; the row is already
 * terminal.
 */
const REAPER_FAIL_COPY: Record<string, string> = {
    p2p_send_timeout: "Send didn't complete",
    p2p_request_fulfill_timeout: "Payment didn't complete",
    send_link_timeout: "Link didn't complete",
    send_link_claim_timeout: "Claim didn't complete",
    crypto_withdraw_timeout: "Withdrawal didn't complete",
    qr_pay_timeout: "QR payment didn't complete",
    onramp_timeout: "Bank deposit didn't arrive",
    offramp_timeout: "Bank transfer didn't complete",
    refund_timeout: "Refund didn't complete",
}

/**
 * Map raw `entry.status` to the drawer's StatusPillType. Two regimes:
 * Bridge/bank rails (AWAITING_FUNDS / FUNDS_RECEIVED / PAYMENT_*) and
 * the rest (NEW/PENDING/COMPLETED/...). SEND_LINK with COMPLETED status
 * stays "pending" until claimed (sender-side).
 */
function mapEntryStatusToUiStatus(entry: HistoryEntry, direction: TransactionDirection): StatusPillType {
    const status = entry.status?.toUpperCase()
    const provider = entry.extraData?.provider
    const isBridgeRails = provider === 'BRIDGE' || entry.extraData?.fulfillmentType === 'bridge'

    if (isBridgeRails) {
        switch (status) {
            case 'AWAITING_FUNDS':
                return 'pending'
            case 'IN_REVIEW':
            case 'FUNDS_RECEIVED':
            case 'PAYMENT_SUBMITTED':
                return 'processing'
            case 'PAYMENT_PROCESSED':
                return 'completed'
            case 'UNDELIVERABLE':
            case 'RETURNED':
            case 'REFUNDED':
            case 'ERROR':
                return 'failed'
            case 'CANCELED':
                return 'cancelled'
            default:
                return 'processing'
        }
    }

    switch (status) {
        case 'NEW':
        case 'PENDING':
            return 'pending'
        case 'COMPLETED': {
            // Send links stay 'pending' for the sender side until the link is
            // claimed — the BE's intent.status hits COMPLETED on escrow, but
            // from the sender's UI perspective the link isn't "done" until
            // claimed.
            const isUnclaimedSendLinkSender = direction !== 'claim_external' && intentKindOf(entry) === 'SEND_LINK'
            return isUnclaimedSendLinkSender ? 'pending' : 'completed'
        }
        case 'SUCCESSFUL':
        case 'CLAIMED':
        case 'PAID':
        case 'APPROVED':
            return 'completed'
        case 'FAILED':
        case 'ERROR':
        case 'EXPIRED':
            return 'failed'
        case 'CANCELED':
        case 'CANCELLED':
            return 'cancelled'
        case 'REFUNDED':
            return 'refunded'
        case 'CLOSED':
            // 0 collected → treated as cancelled, not closed
            return entry.totalAmountCollected === 0 ? 'cancelled' : 'closed'
        default: {
            const knownStatuses: StatusType[] = ['completed', 'pending', 'failed', 'cancelled', 'soon', 'processing']
            const lower = entry.status?.toLowerCase()
            return lower && knownStatuses.includes(lower as StatusPillType) ? (lower as StatusPillType) : 'pending'
        }
    }
}

/**
 * Derived display fields — explorer URLs, token/chain icons, reward
 * lookup. Computed from `entry` alone; doesn't read the strategy output.
 */
function computeDerivedFields(entry: HistoryEntry): {
    explorerUrlWithTx: string | undefined
    addressExplorerUrl: string | undefined
    tokenDisplayDetails:
        | {
              tokenSymbol: string | undefined
              tokenIconUrl: string | undefined
              chainName: string | undefined
              chainIconUrl: string | undefined
          }
        | undefined
    rewardData: RewardData | undefined
} {
    // For crypto deposits, force the explorer URL to Peanut's wallet chain
    // (Arbitrum) — the underlying chainId field is the deposit-source chain.
    const explorerUrlChainID =
        intentKindOf(entry) === 'CRYPTO_DEPOSIT' ? PEANUT_WALLET_CHAIN.id.toString() : entry.chainId
    const baseUrl = getExplorerUrl(explorerUrlChainID)

    let explorerUrlWithTx: string | undefined
    let addressExplorerUrl: string | undefined
    if (baseUrl) {
        if (entry.senderAccount?.identifier) {
            addressExplorerUrl = `${baseUrl}/address/${entry.senderAccount.identifier}`
        }
        if (entry.txHash && explorerUrlChainID) {
            explorerUrlWithTx = `${baseUrl}/tx/${entry.txHash}`
        }
    }

    let tokenDisplayDetails
    if (entry.tokenAddress && entry.chainId) {
        const tokenDetails = getTokenDetails({
            tokenAddress: entry.tokenAddress as Address,
            chainId: entry.chainId,
        })
        const chainName = getChainName(entry.chainId)
        const tokenSymbol = entry.tokenSymbol ?? tokenDetails?.symbol
        tokenDisplayDetails = {
            tokenSymbol,
            tokenIconUrl: tokenSymbol ? getTokenLogo(tokenSymbol) : undefined,
            chainName,
            chainIconUrl: chainName ? getChainLogo(chainName) : undefined,
        }
    }

    const rewardData = REWARD_TOKENS[entry.tokenAddress?.toLowerCase()]
    return { explorerUrlWithTx, addressExplorerUrl, tokenDisplayDetails, rewardData }
}

/**
 * defines the structure of the data expected by the transaction details drawer component.
 * includes ui-specific fields derived from the original history entry.
 */
export interface TransactionDetails {
    id: string
    direction: TransactionDirection
    userName: string
    fullName: string
    showFullName?: boolean
    amount: number | bigint
    /** Raw destination-token amount string from the BE (e.g. "0.000416666"
     *  for a $1 ETH withdraw). Preserves full decimals for receipt rendering;
     *  feed cards still truncate via formatNumberForDisplay. */
    tokenAmount?: string
    currency?: {
        amount: string
        code: string
    }
    currencySymbol?: string
    tokenSymbol?: string
    initials: string
    status?: StatusPillType
    isVerified?: boolean
    haveSentMoneyToUser?: boolean
    date: string | Date
    fee?: number | string
    memo?: string
    attachmentUrl?: string
    cancelledDate?: string | Date
    txHash?: string
    explorerUrl?: string
    tokenAddress?: string
    extraDataForDrawer?: {
        addressExplorerUrl?: string
        /** Always 'TRANSACTION_INTENT' on the wire — kept as a literal so
         *  the TransactionDetails view model carries the wire `type` field
         *  forward without surprises. */
        originalType: 'TRANSACTION_INTENT'
        originalUserRole: EHistoryUserRole
        /** Canonical TransactionIntentKind (DIRECT_TRANSFER, QR_PAY,
         *  CARD_SPEND_AUTH, …) or the synthetic 'PERK_REWARD'. Drives every
         *  predicate, badge, and row-visibility decision in the drawer.
         *  Pinned to the strategy registry's IntentKind union — adding a new
         *  kind here is a TS-side failure unless the registry knows about it. */
        kind?: IntentKind
        /** TransactionProvider enum value from the BE (peanut-api-ts:
         *  `enum TransactionProvider`). Every wire entry carries this as of
         *  peanut-api-ts#739 — predicates branch on it for positive identity
         *  (e.g. `provider === 'MANTECA'`) instead of inferring from the
         *  presence/absence of other fields. */
        provider?: Provider
        /** Bridge sub-flow discriminator. Only set for `provider === 'BRIDGE'`
         *  entries — separates the four Bridge paths that share an intent kind
         *  (ONRAMP, OFFRAMP, BANK_SEND_LINK_CLAIM, GUEST_DIRECT_SEND). */
        bridgeFlow?: 'ONRAMP' | 'OFFRAMP' | 'BANK_SEND_LINK_CLAIM' | 'GUEST_DIRECT_SEND'
        link?: string
        isLinkTransaction?: boolean
        transactionCardType?: TransactionCardType
        rewardData?: RewardData
        fulfillmentType?: 'bridge' | 'wallet'
        bridgeTransferId?: string
        avatarUrl?: string
        perkReward?: HistoryEntryPerkReward
        perk?: {
            claimed: boolean
            discountPercentage: number
            amountSponsored?: number
            txHash?: string
            merchantInfo?: {
                promoDescription?: string
            }
            isCapped?: boolean
            campaignCapUsd?: number
            remainingCapUsd?: number
        }
        depositInstructions?: DrawerDepositInstructions
        receipt?: DrawerReceipt
        /** Card-payment specifics — populated for Rain CARD_SPEND / card-refund
         *  entries only. Drives the merchant hero, status timeline, decline
         *  reason, and "Adjusted from $X" settlement note in the drawer. */
        cardPayment?: {
            merchantName: string | null
            merchantCategory: string | null
            merchantCity: string | null
            merchantCountry: string | null
            merchantMcc: string | null
            /** Rain-enriched brand logo URL when their enrichment identified the
             *  merchant. Drawer keeps the generic card icon for v1; this is
             *  plumbed so a future swap doesn't need a backend change. */
            merchantLogo: string | null
            merchantId: string | null
            localAmount: string | null
            localCurrency: string | null
            declineReason: string | null
            /** Synthetic category set by the BE. Preferred over the raw
             *  `declineReason` for friendly-copy mapping because Rain returns
             *  `INSUFFICIENT_FUNDS` for both real shortfalls and limit-too-low
             *  cases. Union kept narrow so unknown strings from the wire are
             *  caught by the consumer rather than mis-mapped. */
            declineCategory: 'limit_too_low' | 'insufficient_balance' | 'other' | null
            authAmount: string | null
            settledAmount: string | null
            settlementAdjusted: boolean
            cancellationReason: string | null
            parentRainTxId: string | null
            rainTransactionId: string | null
            isRefund: boolean
            /** Populated when Rain has fired any dispute.* webhook for this
             *  spend. Status drives the drawer's "Disputed — <label>" badge;
             *  evidenceRequestedMessage prompts the user to upload docs. */
            dispute: {
                status: DisputeStatus
                type: string | null
                resolvedAt: string | null
                textEvidence: string | null
                evidenceRequestedMessage: string | null
                chargebackRainTxId: string | null
            } | null
        }
    }
    sourceView?: 'status' | 'history'
    tokenDisplayDetails?: {
        tokenSymbol?: string
        tokenIconUrl?: string
        chainName?: string
        chainIconUrl?: string
    }
    networkFeeDetails?: {
        amountDisplay: string
        moreInfoText?: string
    }
    peanutFeeDetails?: {
        amountDisplay: string
    }
    bankAccountDetails?: {
        identifier: string
        type: string
    }
    claimedAt?: string | Date
    createdAt?: string | Date
    completedAt?: string | Date
    points?: number
    isRequestPotLink?: boolean
    requestPotPayments?: ChargeEntry[]
    totalAmountCollected: number
}

/**
 * defines the output structure of the mapping function.
 */
interface MappedTransactionData {
    /** data structured for the transactiondetailsdrawer. */
    transactionDetails: TransactionDetails
    /** the visual type for the transactioncard component. */
    transactionCardType: TransactionCardType
}

/**
 * maps a raw historyentry from the api/hook to the structured data needed by ui components.
 *
 * @param entry the raw history entry object.
 * @param currentuserusername the username of the currently logged-in user.
 * @returns an object containing structured transactiondetails and the transactioncardtype.
 */
export function mapTransactionDataForDrawer(entry: HistoryEntry): MappedTransactionData {
    // initialize variables
    // Pick the per-kind strategy. Post-strategy code below applies status
    // mapping, the reaper-failed override, and derived fields (explorer
    // URL, token logos, initials).
    const out = dispatchStrategy(entry)(entry)
    const direction: TransactionDirection = out.direction
    const transactionCardType: TransactionCardType = out.transactionCardType
    let nameForDetails = out.nameForDetails
    let isPeerActuallyUser = out.isPeerActuallyUser
    const isLinkTx = out.isLinkTx
    let fullName = out.fullName ?? ''
    const showFullName = out.showFullName
    let uiStatus: StatusPillType = out.uiStatus ?? 'pending'
    const strategyOverrodeUiStatus = out.uiStatus !== undefined

    if (!isPeerActuallyUser) {
        isPeerActuallyUser = false
    } else if (entry.recipientAccount?.isUser === false && entry.senderAccount?.isUser === false) {
        isPeerActuallyUser = false
    }

    // Reaper-failed rows (orphaned PENDING intents the BE timed out — see
    // peanut-api-ts/src/ledger/reaper.ts) get user-friendly copy. Without
    // this branch the row renders with whatever userName the kind-switch
    // landed on, which for a P2P_SEND that never confirmed is misleading
    // ("Sent to alice" implies funds moved). The reaper sets
    // metadata.failReason to '${kind}_timeout' before transitioning FAILED;
    // the BE history fetcher surfaces it as `entry.extraData.failReason`.
    const reaperFailReason = entry.extraData?.failReason as string | undefined
    if (entry.status === 'FAILED' && reaperFailReason && reaperFailReason.endsWith('_timeout')) {
        nameForDetails = REAPER_FAIL_COPY[reaperFailReason] ?? 'Transaction did not complete'
        isPeerActuallyUser = false
    } else if (entry.status === 'FAILED' && intentKindOf(entry) === 'QR_PAY') {
        // A collateral QR-pay that failed at submit (e.g. the stale-approval 403)
        // has no reaper _timeout reason, but the BE now surfaces it (peanut-api-ts
        // #1146). Render the same neutral "didn't complete" copy instead of the
        // kind-switch's "QR payment to <merchant>", which implies the payment
        // happened. Deliberately does NOT assert charge status — a payment that
        // settles then fails is refunded elsewhere — so "didn't complete" is honest
        // whether or not funds moved; the ledger stays the source of truth for that.
        nameForDetails = 'Failed QR payment attempt'
        isPeerActuallyUser = false
    }

    // Strategy uiStatus wins (e.g. SEND_LINK BOTH → 'cancelled'); otherwise
    // map raw entry.status via the shared helper.
    if (!strategyOverrodeUiStatus) uiStatus = mapEntryStatusToUiStatus(entry, direction)

    // Active dispute trumps the underlying spend's status — a card spend
    // that's been contested isn't really "completed" from the user's POV,
    // even though Rain settled it. Flip the pill to `pending` while the
    // dispute is open. Terminal dispute states (accepted / resolvedByMerchant
    // / rejected / canceled) restore the underlying status: the chargeback
    // for accepted disputes arrives as a separate credit transaction; the
    // others left the original spend standing. Status discrimination beyond
    // the pill lives on the "Disputed — <label>" sub-row.
    const disputeStatus = (entry.extraData?.dispute as { status?: string } | null | undefined)?.status
    if (disputeStatus === 'pending' || disputeStatus === 'inReview') {
        uiStatus = 'pending'
    }

    // parse the amount from the usdamount string in extradata
    const baseAmount = entry.extraData?.usdAmount
        ? parseFloat(String(entry.extraData.usdAmount).replace(/[^\d.-]/g, ''))
        : 0
    // Bake the cross-chain network fee into the displayed amount (product
    // convention: fees are part of the amount, never a separate line — see the
    // `fee: undefined` note below). The BE only sets `networkFeeUsd` for a
    // CRYPTO_WITHDRAW whose kernel actually debited principal + fee (SDA path),
    // so this shows the true amount deducted instead of just the principal.
    const networkFeeUsd = typeof entry.extraData?.networkFeeUsd === 'number' ? entry.extraData.networkFeeUsd : 0
    const amount = baseAmount + networkFeeUsd

    const { explorerUrlWithTx, addressExplorerUrl, tokenDisplayDetails, rewardData } = computeDerivedFields(entry)

    // If full name is empty, set it to same as nameForDetails as fallback
    if (!fullName || fullName === '') {
        fullName = nameForDetails
    }

    // determine which name to use for initials based on showFullName preference
    // if showFullName is false or undefined, use username; otherwise use fullName
    const nameForInitials = showFullName && fullName ? fullName : nameForDetails

    // check if this is a test transaction for adding a memo
    const isTestDeposit =
        intentKindOf(entry) === 'CRYPTO_DEPOSIT' && (String(entry.amount) === '0' || entry.extraData?.usdAmount === '0')

    // build the final transactiondetails object for the ui
    const transactionDetails: TransactionDetails = {
        id: entry.uuid,
        direction: direction,
        userName: nameForDetails,
        amount,
        tokenAmount: entry.amount,
        fullName,
        showFullName,
        currency: rewardData ? undefined : entry.currency,
        currencySymbol: `${entry.userRole === EHistoryUserRole.SENDER ? '-' : '+'}$`,
        tokenSymbol: rewardData?.getSymbol(amount) ?? entry.tokenSymbol,
        initials: getInitialsFromName(nameForInitials),
        status: uiStatus,
        isVerified: entry.isVerified && isPeerActuallyUser,
        // only show verification badge if the other person is a peanut user
        date: new Date(entry.timestamp),
        // Peanut product convention: fees are baked into the displayed exchange
        // rate, never surfaced as a separate line item. Keep the backend field
        // populated for ops/debug, but never thread it to the UI. `fee` stays
        // `undefined` so `rowVisibilityConfig.fee` is always false and the
        // drawer's fee row never renders. If this rule changes, update
        // docs/product-conventions.md first.
        fee: undefined,
        // memo carries free-form user notes from non-card flows (link memos,
        // request comments). Card spends + Rain refunds suppress this — the
        // merchant name and any decline reason render inside CardPaymentRows
        // in the drawer, so a duplicate "Comment" row is just noise. Backend
        // already sets memo=undefined for card entries, but defend in depth.
        memo: (() => {
            if (isTestDeposit) return 'Your peanut wallet is ready to use!'
            const kind = intentKindOf(entry)
            const isCardKind =
                kind === 'CARD_SPEND_AUTH' || kind === 'CARD_SPEND_CLEAR' || kind === 'CARD_AUTH_REVERSAL'
            const isCardEntry = isCardKind || !!entry.extraData?.parentRainTxId
            if (isCardEntry) return undefined
            return entry.memo?.trim()
        })(),
        attachmentUrl: entry.attachmentUrl,
        cancelledDate: entry.cancelledAt,
        txHash: entry.txHash,
        explorerUrl: explorerUrlWithTx,
        tokenDisplayDetails,
        tokenAddress: entry.tokenAddress,
        extraDataForDrawer: {
            addressExplorerUrl,
            originalType: 'TRANSACTION_INTENT',
            originalUserRole: entry.userRole as EHistoryUserRole,
            kind: intentKindOf(entry),
            provider: entry.extraData?.provider as Provider | undefined,
            bridgeFlow: entry.extraData?.bridgeFlow,
            link: entry.extraData?.link,
            isLinkTransaction: isLinkTx,
            transactionCardType,
            rewardData,
            fulfillmentType: entry.extraData?.fulfillmentType,
            bridgeTransferId: entry.extraData?.bridgeTransferId,
            // Card-payment specifics — populated only for Rain CARD_SPEND /
            // card-refund entries. Drawer reads these to render the merchant
            // hero, status timeline, decline reason, and "Adjusted from $X"
            // settlement note. Backend source: src/transaction-intent/history.ts.
            // Build the cardPayment block for any card-shaped intent (the three
            // canonical card kinds) and for Rain refunds (parentRainTxId set).
            // Earlier we guarded on merchantName presence, but that dropped the
            // block for unknown-merchant spends — losing the de-emphasis-on-
            // failed, decline-reason rows, and merchant-detail Card. The block
            // falls back to "Card payment" downstream when merchantName is null.
            cardPayment:
                intentKindOf(entry) === 'CARD_SPEND_AUTH' ||
                intentKindOf(entry) === 'CARD_SPEND_CLEAR' ||
                intentKindOf(entry) === 'CARD_AUTH_REVERSAL' ||
                entry.extraData?.parentRainTxId
                    ? {
                          merchantName: entry.extraData?.merchantName as string | null,
                          merchantCategory: entry.extraData?.merchantCategory as string | null,
                          merchantCity: entry.extraData?.merchantCity as string | null,
                          merchantCountry: entry.extraData?.merchantCountry as string | null,
                          merchantMcc: entry.extraData?.merchantMcc as string | null,
                          merchantLogo: entry.extraData?.merchantLogo as string | null,
                          merchantId: entry.extraData?.merchantId as string | null,
                          localAmount: entry.extraData?.cardLocalAmount as string | null,
                          localCurrency: entry.extraData?.cardLocalCurrency as string | null,
                          declineReason: (entry.extraData?.declineReason as string | null | undefined) ?? null,
                          declineCategory:
                              (entry.extraData?.declineCategory as
                                  | 'limit_too_low'
                                  | 'insufficient_balance'
                                  | 'other'
                                  | null
                                  | undefined) ?? null,
                          authAmount: entry.extraData?.cardAuthAmount as string | null,
                          settledAmount: entry.extraData?.cardSettledAmount as string | null,
                          settlementAdjusted: Boolean(entry.extraData?.settlementAdjusted),
                          cancellationReason: entry.extraData?.cancellationReason as string | null,
                          parentRainTxId: entry.extraData?.parentRainTxId as string | null,
                          rainTransactionId: entry.extraData?.rainTransactionId as string | null,
                          isRefund: !!entry.extraData?.parentRainTxId,
                          // Dispute lifecycle — null when Rain hasn't fired
                          // any dispute.* webhook for this spend.
                          dispute: (() => {
                              const d = entry.extraData?.dispute as Record<string, unknown> | null | undefined
                              if (!d || typeof d !== 'object') return null
                              // Type-guard d.status — any non-DisputeStatus string from
                              // the wire (sandbox drift, schema bump) should drop the
                              // whole block rather than leak through.
                              if (!isDisputeStatus(d.status)) return null
                              return {
                                  status: d.status,
                                  type: (d.type as string | undefined) ?? null,
                                  resolvedAt: (d.resolvedAt as string | undefined) ?? null,
                                  textEvidence: (d.textEvidence as string | undefined) ?? null,
                                  evidenceRequestedMessage: (d.evidenceRequestedMessage as string | undefined) ?? null,
                                  chargebackRainTxId: (d.chargebackRainTxId as string | undefined) ?? null,
                              }
                          })(),
                      }
                    : undefined,
            perkReward: entry.extraData?.perkReward as HistoryEntryPerkReward | undefined,
            perk: entry.extraData?.perk as
                | {
                      claimed: boolean
                      discountPercentage: number
                      amountSponsored?: number
                      txHash?: string
                      merchantInfo?: { promoDescription?: string }
                      isCapped?: boolean
                      campaignCapUsd?: number
                      remainingCapUsd?: number
                  }
                | undefined,
            // Wire-shape boundary: BE writes `Record<string, unknown>` here
            // (BridgeHistoryFetcher forwards the raw API blob unchecked);
            // drawer consumers expect the typed shape. Cast at the boundary.
            depositInstructions:
                (intentKindOf(entry) === 'ONRAMP' && entry.extraData?.provider === 'BRIDGE') ||
                entry.extraData?.fulfillmentType === 'bridge'
                    ? (entry.extraData?.depositInstructions as DrawerDepositInstructions | undefined)
                    : undefined,
            receipt: entry.extraData?.receipt as DrawerReceipt | undefined,
        },
        sourceView: 'history',
        points: entry.points,
        // shouldPlumbBankAccountDetails gates on type/kind/role; also require
        // identifier + type to be present so getBankAccountLabel doesn't crash
        // on rows whose recipientAccount payload is incomplete (seen on
        // mid-flight FIAT_OFFRAMP intents before the BE stamps the account).
        bankAccountDetails:
            shouldPlumbBankAccountDetails(entry) && entry.recipientAccount?.identifier && entry.recipientAccount?.type
                ? {
                      identifier: entry.recipientAccount.identifier,
                      type: entry.recipientAccount.type,
                  }
                : undefined,
        claimedAt: entry.claimedAt,
        createdAt: entry.createdAt,
        completedAt: entry.completedAt,
        haveSentMoneyToUser: entry.extraData?.haveSentMoneyToUser as boolean,
        isRequestPotLink: entry.isRequestLink,
        requestPotPayments: entry.charges,
        totalAmountCollected: entry.totalAmountCollected ?? 0,
    }

    return {
        transactionDetails,
        transactionCardType,
    }
}
