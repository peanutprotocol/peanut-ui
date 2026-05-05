import { type StatusType } from '@/components/Global/Badges/StatusBadge'
import { type TransactionType as TransactionCardType } from '@/components/TransactionDetails/TransactionCard'
import { type TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { EHistoryEntryType, EHistoryUserRole, type HistoryEntry } from '@/hooks/useTransactionHistory'
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
import { dispatchStrategy } from './strategies/registry'

/**
 * @fileoverview maps raw transaction history data from the api/hook to the format needed by ui components.
 */

/**
 * Should the receipt drawer's `bankAccountDetails` row render for this entry?
 *
 * Original gate (pre-decomplexify) only fired for legacy `BRIDGE_OFFRAMP` and
 * `BANK_SEND_LINK_CLAIM × RECIPIENT`. Post-decomplexify, the same flows arrive
 * as `TRANSACTION_INTENT` with `kind ∈ {FIAT_OFFRAMP, CRYPTO_WITHDRAW}`, so the
 * gate must include those too — otherwise the IBAN row disappears and the
 * country-by-IBAN flag fallback in `getBankAccountCountryCode` kicks in,
 * showing an EU flag for an ES IBAN (Hugo's screenshot d on 2026-04-29).
 *
 * Also includes legacy `MANTECA_OFFRAMP` — independent legacy bug, was never
 * plumbed before. Catches Argentina/Brazil rail withdrawals.
 */
function shouldPlumbBankAccountDetails(entry: HistoryEntry): boolean {
    if (entry.type === EHistoryEntryType.BRIDGE_OFFRAMP) return true
    if (entry.type === EHistoryEntryType.MANTECA_OFFRAMP) return true
    if (entry.type === EHistoryEntryType.BANK_SEND_LINK_CLAIM && entry.userRole === EHistoryUserRole.RECIPIENT) {
        return true
    }
    if (entry.type === EHistoryEntryType.TRANSACTION_INTENT) {
        const kind = entry.extraData?.kind as string | undefined
        if (kind === 'FIAT_OFFRAMP' || kind === 'CRYPTO_WITHDRAW') return true
    }
    return false
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
    const isBridgeRails =
        entry.type === EHistoryEntryType.BRIDGE_OFFRAMP ||
        entry.type === EHistoryEntryType.BRIDGE_ONRAMP ||
        entry.type === EHistoryEntryType.BANK_SEND_LINK_CLAIM ||
        entry.extraData?.fulfillmentType === 'bridge'

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
            // claimed. Covers both legacy `EHistoryEntryType.SEND_LINK` rows
            // and post-decomplexify `TRANSACTION_INTENT × kind=LINK_CREATE`.
            const isUnclaimedSendLinkSender =
                direction !== 'claim_external' &&
                (entry.type === EHistoryEntryType.SEND_LINK ||
                    (entry.type === EHistoryEntryType.TRANSACTION_INTENT && entry.extraData?.kind === 'LINK_CREATE'))
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
    // For deposits, force the explorer URL to Peanut's wallet chain
    // (Arbitrum) — the underlying chainId field is the deposit-source chain.
    const explorerUrlChainID =
        entry.type === EHistoryEntryType.DEPOSIT ? PEANUT_WALLET_CHAIN.id.toString() : entry.chainId
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
        originalType: EHistoryEntryType
        originalUserRole: EHistoryUserRole
        /** Post-M3 transaction-intent kind (P2P_SEND, QR_PAY, CARD_SPEND, …).
         *  Some predicates need this to disambiguate within TRANSACTION_INTENT
         *  entries — e.g. QR payments now arrive as TRANSACTION_INTENT + kind=QR_PAY
         *  rather than a dedicated originalType. */
        kind?: string
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
        depositInstructions?: {
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
        receipt?: {
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
            authAmount: string | null
            settledAmount: string | null
            settlementAdjusted: boolean
            cancellationReason: string | null
            parentRainTxId: string | null
            rainTransactionId: string | null
            isRefund: boolean
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
    }

    // Strategy uiStatus wins (e.g. SEND_LINK BOTH → 'cancelled'); otherwise
    // map raw entry.status via the shared helper.
    if (!strategyOverrodeUiStatus) uiStatus = mapEntryStatusToUiStatus(entry, direction)

    // parse the amount from the usdamount string in extradata
    const amount = entry.extraData?.usdAmount
        ? parseFloat(String(entry.extraData.usdAmount).replace(/[^\d.-]/g, ''))
        : 0

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
        entry.type === EHistoryEntryType.DEPOSIT && (String(entry.amount) === '0' || entry.extraData?.usdAmount === '0')

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
            const isCardEntry = entry.extraData?.kind === 'CARD_SPEND' || !!entry.extraData?.parentRainTxId
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
            originalType: entry.type as EHistoryEntryType,
            originalUserRole: entry.userRole as EHistoryUserRole,
            kind: entry.extraData?.kind as string | undefined,
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
            // Build the cardPayment block for any card-shaped intent (CARD_SPEND
            // kind) and for Rain refunds (parentRainTxId set). Earlier we
            // guarded on merchantName presence, but that dropped the block for
            // unknown-merchant spends — losing the de-emphasis-on-failed,
            // decline-reason rows, and merchant-detail Card. The block falls
            // back to "Card payment" downstream when merchantName is null.
            cardPayment:
                entry.extraData?.kind === 'CARD_SPEND' || entry.extraData?.parentRainTxId
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
                          declineReason: entry.extraData?.declineReason as string | null,
                          authAmount: entry.extraData?.cardAuthAmount as string | null,
                          settledAmount: entry.extraData?.cardSettledAmount as string | null,
                          settlementAdjusted: Boolean(entry.extraData?.settlementAdjusted),
                          cancellationReason: entry.extraData?.cancellationReason as string | null,
                          parentRainTxId: entry.extraData?.parentRainTxId as string | null,
                          rainTransactionId: entry.extraData?.rainTransactionId as string | null,
                          isRefund: !!entry.extraData?.parentRainTxId,
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
            depositInstructions:
                entry.type === EHistoryEntryType.BRIDGE_ONRAMP || entry.extraData?.fulfillmentType === 'bridge'
                    ? entry.extraData?.depositInstructions
                    : undefined,
            receipt: entry.extraData?.receipt,
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
