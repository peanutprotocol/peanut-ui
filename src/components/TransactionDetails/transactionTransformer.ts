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
    if (
        entry.type === EHistoryEntryType.BANK_SEND_LINK_CLAIM &&
        entry.userRole === EHistoryUserRole.RECIPIENT
    ) {
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
    let direction: TransactionDirection
    let transactionCardType: TransactionCardType
    let nameForDetails = ''
    let uiStatus: StatusPillType = 'pending'
    let isLinkTx = false
    let isPeerActuallyUser = false
    let fullName = '' // Full name of the user for PFP Avatar
    let showFullName: boolean | undefined = undefined // User's preference for showing full name

    // determine direction, card type, peer name, and flags based on original type and user role
    switch (entry.type) {
        case EHistoryEntryType.DIRECT_SEND:
            isPeerActuallyUser = true
            direction = 'send'
            transactionCardType = 'send'
            if (entry.userRole === EHistoryUserRole.SENDER) {
                nameForDetails = entry.recipientAccount?.username ?? entry.recipientAccount?.identifier
                fullName = entry.recipientAccount?.fullName ?? ''
                showFullName = entry.recipientAccount?.showFullName
            } else {
                direction = 'receive'
                transactionCardType = 'receive'
                nameForDetails =
                    entry.senderAccount?.username ?? entry.senderAccount?.identifier ?? 'Requested via Link'
                ;((fullName = entry.senderAccount?.fullName ?? ''), (isLinkTx = !entry.senderAccount)) // If the sender is not an user then it's a public link
                showFullName = entry.senderAccount?.showFullName
            }
            break
        case EHistoryEntryType.SEND_LINK:
            isLinkTx = true
            direction = 'send'
            transactionCardType = 'send'
            if (entry.userRole === EHistoryUserRole.SENDER) {
                nameForDetails =
                    entry.recipientAccount?.username ||
                    entry.recipientAccount?.identifier ||
                    (entry.status === 'COMPLETED' ? 'You sent via link' : "You're sending via link")
                fullName = entry.recipientAccount?.username ?? ''
                showFullName = entry.recipientAccount?.showFullName
                isPeerActuallyUser = !!entry.recipientAccount?.isUser
                isLinkTx = !isPeerActuallyUser
            } else if (entry.userRole === EHistoryUserRole.RECIPIENT) {
                // if the recipient is not a peanut user, it's an external claim
                if (entry.recipientAccount && !entry.recipientAccount.isUser) {
                    direction = 'claim_external'
                    transactionCardType = 'claim_external'
                    nameForDetails = entry.recipientAccount.identifier
                    isPeerActuallyUser = false
                    isLinkTx = true
                } else {
                    direction = 'receive'
                    transactionCardType = 'receive'
                    nameForDetails =
                        entry.senderAccount?.username || entry.senderAccount?.identifier || 'Received via Link'
                    fullName = entry.senderAccount?.fullName ?? ''
                    showFullName = entry.senderAccount?.showFullName
                    isPeerActuallyUser = !!entry.senderAccount?.isUser
                    isLinkTx = !isPeerActuallyUser
                }
            } else if (entry.userRole === EHistoryUserRole.BOTH) {
                isPeerActuallyUser = true
                uiStatus = 'cancelled'
                nameForDetails = 'Sent via Link'
            } else {
                direction = 'claim_external'
                transactionCardType = 'claim_external'
                nameForDetails = entry.recipientAccount?.username || entry.recipientAccount?.identifier
                fullName = entry.recipientAccount?.username ?? ''
                showFullName = entry.recipientAccount?.showFullName
            }
            break
        case EHistoryEntryType.REQUEST:
            if (entry.extraData?.fulfillmentType === 'bridge' && entry.userRole === EHistoryUserRole.SENDER) {
                transactionCardType = 'bank_request_fulfillment'
                direction = 'bank_request_fulfillment'
                nameForDetails = entry.recipientAccount?.username ?? entry.recipientAccount?.identifier
                fullName = entry.recipientAccount?.fullName ?? ''
                showFullName = entry.recipientAccount?.showFullName
                isPeerActuallyUser = !!entry.recipientAccount?.isUser || !!entry.senderAccount?.isUser
            } else if (entry.userRole === EHistoryUserRole.RECIPIENT) {
                direction = 'request_sent'
                transactionCardType = 'request'
                nameForDetails =
                    entry.senderAccount?.username || entry.senderAccount?.identifier || 'Requested via Link'
                fullName = entry.senderAccount?.fullName ?? ''
                showFullName = entry.senderAccount?.showFullName
                isPeerActuallyUser = !!entry.senderAccount?.isUser
            } else {
                if (
                    entry.status?.toUpperCase() === 'NEW' ||
                    (entry.status?.toUpperCase() === 'PENDING' && !entry.extraData?.fulfillmentType)
                ) {
                    direction = 'request_received'
                    transactionCardType = 'request'
                    nameForDetails =
                        entry.recipientAccount?.username ||
                        entry.recipientAccount?.identifier ||
                        `Request From ${entry.recipientAccount?.username || entry.recipientAccount?.identifier}`
                    fullName = entry.recipientAccount?.fullName ?? ''
                    showFullName = entry.recipientAccount?.showFullName
                    isPeerActuallyUser = !!entry.recipientAccount?.isUser
                } else {
                    direction = 'send'
                    transactionCardType = 'send'
                    nameForDetails =
                        entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Paid Request To'
                    fullName = entry.recipientAccount?.fullName ?? ''
                    isPeerActuallyUser = !!entry.recipientAccount?.isUser
                }
            }
            isLinkTx = !isPeerActuallyUser
            break
        case EHistoryEntryType.WITHDRAW:
            direction = 'withdraw'
            transactionCardType = 'withdraw'
            nameForDetails = entry.recipientAccount?.identifier || 'External Account'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.CASHOUT:
            direction = 'withdraw'
            transactionCardType = 'withdraw'
            nameForDetails = entry.recipientAccount?.identifier || 'Bank Account'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.BRIDGE_OFFRAMP:
        case EHistoryEntryType.MANTECA_OFFRAMP:
            direction = 'bank_withdraw'
            transactionCardType = 'bank_withdraw'
            nameForDetails = 'Bank Account'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.BANK_SEND_LINK_CLAIM:
            // this handles how a bank claim is displayed in the transaction history.
            if (entry.userRole === EHistoryUserRole.SENDER || entry.userRole === EHistoryUserRole.BOTH) {
                // from the sender's perspective (or when sender claims their own link).
                if (entry.recipientAccount.isUser) {
                    // cases 1 & 2: claimed by a peanut user (kyc'd or not). show as direct send.
                    direction = 'send'
                    transactionCardType = 'send'
                    nameForDetails =
                        entry.recipientAccount?.username ??
                        entry.recipientAccount?.fullName ??
                        entry.recipientAccount?.identifier
                    fullName = entry.recipientAccount?.fullName ?? ''
                    isPeerActuallyUser = true
                } else {
                    // case 3: claimed by a guest. show as generic bank claim.
                    direction = 'bank_claim'
                    transactionCardType = 'bank_claim'
                    nameForDetails = 'Claimed to Bank'
                    isPeerActuallyUser = false
                }
            } else {
                // from the claimant's perspective, it's always a bank claim.
                direction = 'bank_claim'
                transactionCardType = 'bank_claim'
                nameForDetails = 'Claimed to Bank'
                isPeerActuallyUser = false
            }
            break
        case EHistoryEntryType.BRIDGE_ONRAMP:
        case EHistoryEntryType.MANTECA_ONRAMP:
            direction = 'bank_deposit'
            transactionCardType = 'bank_deposit'
            nameForDetails = 'Bank Account'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.DEPOSIT: {
            direction = 'add'
            transactionCardType = 'add'
            // check if this is a test transaction (0 amount deposit during account setup), ideally this should be handled in the backend, but for now we'll handle it here cuz its a quick fix, and in promisland of post devconnect this should be handled in the backend.
            const isTestTransaction = String(entry.amount) === '0' || entry.extraData?.usdAmount === '0'
            if (isTestTransaction) {
                nameForDetails = 'Enjoy Peanut!'
            } else {
                nameForDetails = entry.senderAccount?.identifier || 'Deposit Source'
            }
            isPeerActuallyUser = false
            break
        }
        case EHistoryEntryType.MANTECA_QR_PAYMENT:
            direction = 'qr_payment'
            transactionCardType = 'pay'
            nameForDetails = entry.recipientAccount?.identifier || 'Merchant'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.SIMPLEFI_QR_PAYMENT:
            direction = 'qr_payment'
            transactionCardType = 'pay'
            nameForDetails = entry.recipientAccount?.identifier || 'Merchant'
            // We dont have merchant name so we try to prettify the slug,
            // replacing dashws with speaces and making the first letter uppercase
            nameForDetails = nameForDetails.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.PERK_REWARD:
            direction = 'receive'
            transactionCardType = 'receive'
            nameForDetails = 'Peanut Reward'
            fullName = 'Peanut Rewards'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.TRANSACTION_INTENT: {
            // Intent-sourced entries carry a user-semantic `kind` that drives
            // the card label. Direction + recipient come from the intent, not
            // from account lookups (intents store the raw recipient address).
            const kind = (entry.extraData?.kind as string | undefined) ?? 'OTHER'
            switch (kind) {
                case 'P2P_SEND':
                case 'REQUEST_PAY':
                    // Bridge-fulfilled requests render as bank-request
                    // fulfillments on the sender side (mirrors legacy REQUEST
                    // case at line 268). Viewer is paying via bank rails.
                    if (
                        kind === 'REQUEST_PAY' &&
                        entry.extraData?.fulfillmentType === 'bridge' &&
                        entry.userRole === 'SENDER'
                    ) {
                        direction = 'bank_request_fulfillment'
                        transactionCardType = 'bank_request_fulfillment'
                        nameForDetails =
                            entry.recipientAccount?.username ?? entry.recipientAccount?.identifier ?? 'Recipient'
                        fullName = entry.recipientAccount?.fullName ?? ''
                        showFullName = entry.recipientAccount?.showFullName
                        isPeerActuallyUser =
                            !!entry.recipientAccount?.isUser || !!entry.senderAccount?.isUser
                        break
                    }
                    if (entry.userRole === 'RECIPIENT') {
                        // Viewer is on the receiving side. Two sub-cases:
                        //  (a) Senderaccount.identifier is set → an actual paid
                        //      send. Render as a receive.
                        //  (b) Sender is empty → unfulfilled request the viewer
                        //      created. Render as a request_received with a
                        //      neutral label ("Request" — the FE's
                        //      TransactionDetailsHeaderCard already styles this).
                        const senderResolved = !!entry.senderAccount?.identifier
                        if (senderResolved) {
                            direction = 'receive'
                            transactionCardType = 'receive'
                            nameForDetails =
                                entry.senderAccount?.username || entry.senderAccount?.identifier || 'Sender'
                            isPeerActuallyUser = !!entry.senderAccount?.isUser
                        } else {
                            direction = 'request_received'
                            transactionCardType = 'request'
                            nameForDetails = 'Request'
                            isPeerActuallyUser = false
                        }
                    } else {
                        direction = 'send'
                        transactionCardType = 'send'
                        nameForDetails =
                            entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Recipient'
                        isPeerActuallyUser = !!entry.recipientAccount?.isUser
                    }
                    break
                case 'QR_PAY':
                    direction = 'qr_payment'
                    transactionCardType = 'pay'
                    nameForDetails = entry.recipientAccount?.identifier || 'Merchant'
                    isPeerActuallyUser = false
                    break
                case 'LINK_CREATE':
                    if (entry.userRole === 'RECIPIENT') {
                        // The viewer claimed someone else's link. Mirrors the legacy
                        // SEND_LINK × RECIPIENT branch — show the sender as the peer.
                        if (entry.senderAccount?.isUser) {
                            direction = 'receive'
                            transactionCardType = 'receive'
                            nameForDetails =
                                entry.senderAccount?.username ||
                                entry.senderAccount?.identifier ||
                                'Received via Link'
                            fullName = entry.senderAccount?.fullName ?? ''
                            showFullName = entry.senderAccount?.showFullName
                            isPeerActuallyUser = true
                            isLinkTx = false
                        } else {
                            direction = 'receive'
                            transactionCardType = 'receive'
                            nameForDetails =
                                entry.senderAccount?.username ||
                                entry.senderAccount?.identifier ||
                                'Received via Link'
                            fullName = entry.senderAccount?.fullName ?? ''
                            isPeerActuallyUser = false
                            isLinkTx = true
                        }
                    } else {
                        // SENDER (creator). Resolve claimer if it's a peanut user;
                        // otherwise show the link-shaped placeholder.
                        if (entry.recipientAccount?.isUser) {
                            direction = 'send'
                            transactionCardType = 'send'
                            nameForDetails =
                                entry.recipientAccount?.username ?? entry.recipientAccount?.identifier
                            fullName = entry.recipientAccount?.fullName ?? ''
                            showFullName = entry.recipientAccount?.showFullName
                            isPeerActuallyUser = true
                            isLinkTx = false
                        } else {
                            direction = 'send'
                            transactionCardType = 'send'
                            nameForDetails = 'Sent via link'
                            isLinkTx = true
                            isPeerActuallyUser = false
                        }
                    }
                    break
                case 'CRYPTO_DEPOSIT':
                    // Incoming on-chain deposit. If the sender resolved to a known
                    // Peanut user, surface their username + clickable avatar
                    // (improvement over the legacy DEPOSIT branch which always
                    // forced isPeerActuallyUser=false).
                    direction = 'add'
                    transactionCardType = 'add'
                    nameForDetails =
                        entry.senderAccount?.username || entry.senderAccount?.identifier || 'Deposit Source'
                    fullName = entry.senderAccount?.fullName ?? ''
                    showFullName = entry.senderAccount?.showFullName
                    isPeerActuallyUser = !!entry.senderAccount?.isUser
                    break
                case 'CRYPTO_WITHDRAW':
                    if (entry.userRole === 'RECIPIENT') {
                        // The viewer received crypto from someone else's withdraw
                        // (e.g. another user sent to this user's wallet via a
                        // CRYPTO_WITHDRAW). Render as a deposit-style row.
                        direction = 'add'
                        transactionCardType = 'add'
                        nameForDetails =
                            entry.senderAccount?.username || entry.senderAccount?.identifier || 'External Wallet'
                        isPeerActuallyUser = !!entry.senderAccount?.isUser
                    } else {
                        direction = 'withdraw'
                        transactionCardType = 'withdraw'
                        nameForDetails = entry.recipientAccount?.identifier || 'External Account'
                        isPeerActuallyUser = false
                    }
                    break
                case 'FIAT_OFFRAMP':
                    if (entry.userRole === 'RECIPIENT') {
                        // Multi-user fulfillment edge case — viewer received a
                        // bank withdraw initiated by another user. Render as a
                        // receive (USDC arrives in viewer's wallet from offramp
                        // funder).
                        direction = 'receive'
                        transactionCardType = 'receive'
                        nameForDetails =
                            entry.senderAccount?.username || entry.senderAccount?.identifier || 'Bank Account'
                        isPeerActuallyUser = !!entry.senderAccount?.isUser
                    } else {
                        direction = 'bank_withdraw'
                        transactionCardType = 'bank_withdraw'
                        nameForDetails = 'Bank Account'
                        isPeerActuallyUser = false
                    }
                    break
                case 'CARD_SPEND': {
                    // Merchant fields come from the M3 history fetcher's extraData
                    // (peanut-api-ts/src/transaction-intent/history.ts). Falling
                    // back to "Card payment" only when the merchant name is
                    // genuinely unknown — which should be rare once Rain enrichment
                    // is live for the user.
                    const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
                    direction = 'qr_payment'
                    transactionCardType = 'pay'
                    nameForDetails = merchantName || 'Card payment'
                    isPeerActuallyUser = false
                    break
                }
                default:
                    // Card refunds come back with kind === 'REFUND', provider === RAIN
                    // (toLegacyKindLabel surfaces them as 'OTHER' today since
                    // there's no dedicated CARD_REFUND legacy kind). Scope
                    // the refund branch to those two kinds — guarding on
                    // parentRainTxId alone risks misrouting any future intent
                    // that carries the linkage for some other reason.
                    if ((kind === 'OTHER' || kind === 'REFUND') && entry.extraData?.parentRainTxId) {
                        const merchantName = (entry.extraData?.merchantName as string | null | undefined) ?? null
                        direction = 'receive'
                        transactionCardType = 'receive'
                        nameForDetails = merchantName ? `Refund from ${merchantName}` : 'Card refund'
                        isPeerActuallyUser = false
                        break
                    }
                    // Unknown TRANSACTION_INTENT kind — log to Sentry so we
                    // catch BE-added kinds the FE doesn't yet handle. Render
                    // a defensive fallback so the row still appears.
                    if (typeof window !== 'undefined') {
                        // Lazy import to avoid bundling Sentry in non-browser
                        // contexts (test, SSR). Logged as a warning, not a
                        // hard error — the row still renders.
                        import('@sentry/nextjs')
                            .then((Sentry) =>
                                Sentry.captureMessage(
                                    `transactionTransformer: unhandled TRANSACTION_INTENT kind "${kind}"`,
                                    {
                                        level: 'warning',
                                        tags: { feature: 'history', kind },
                                        extra: { entryUuid: entry.uuid, userRole: entry.userRole },
                                    }
                                )
                            )
                            .catch(() => {
                                // Sentry not available (test env) — no-op.
                            })
                    }
                    direction = 'send'
                    transactionCardType = 'send'
                    nameForDetails = entry.recipientAccount?.identifier || 'Transaction'
                    isPeerActuallyUser = false
                    break
            }
            break
        }
        default:
            direction = 'send'
            transactionCardType = 'send'
            nameForDetails = entry.recipientAccount?.identifier || 'Unknown'
            isPeerActuallyUser = !!entry.recipientAccount?.isUser
            break
    }

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

    // map the raw status string to the defined ui status types
    if (
        entry.type === EHistoryEntryType.BRIDGE_OFFRAMP ||
        entry.type === EHistoryEntryType.BRIDGE_ONRAMP ||
        entry.type === EHistoryEntryType.BANK_SEND_LINK_CLAIM ||
        entry.extraData?.fulfillmentType === 'bridge'
    ) {
        switch (entry.status?.toUpperCase()) {
            case 'AWAITING_FUNDS':
                uiStatus = 'pending'
                break
            case 'IN_REVIEW':
            case 'FUNDS_RECEIVED':
            case 'PAYMENT_SUBMITTED':
                uiStatus = 'processing'
                break
            case 'PAYMENT_PROCESSED':
                uiStatus = 'completed'
                break
            case 'UNDELIVERABLE':
            case 'RETURNED':
            case 'REFUNDED':
            case 'ERROR':
                uiStatus = 'failed'
                break
            case 'CANCELED':
                uiStatus = 'cancelled'
                break
            default:
                uiStatus = 'processing'
                break
        }
    } else {
        switch (entry.status?.toUpperCase()) {
            case 'NEW':
            case 'PENDING':
                uiStatus = 'pending'
                break
            case 'COMPLETED':
                uiStatus =
                    EHistoryEntryType.SEND_LINK === entry.type && direction !== 'claim_external'
                        ? 'pending'
                        : 'completed'
                break
            case 'SUCCESSFUL':
            case 'CLAIMED':
            case 'PAID':
            case 'APPROVED':
                uiStatus = 'completed'
                break
            case 'FAILED':
            case 'ERROR':
            case 'CANCELED':
            case 'EXPIRED':
                uiStatus = 'failed'
                break
            case 'CANCELLED':
            case 'EXPIRED':
                uiStatus = 'cancelled'
                break
            case 'REFUNDED':
                uiStatus = 'refunded'
                break
            case 'CLOSED':
                // If the total amount collected is 0, the link is treated as cancelled
                uiStatus = entry.totalAmountCollected === 0 ? 'cancelled' : 'closed'
                break
            default:
                {
                    const knownStatuses: StatusType[] = [
                        'completed',
                        'pending',
                        'failed',
                        'cancelled',
                        'soon',
                        'processing',
                    ]
                    if (entry.status && knownStatuses.includes(entry.status.toLowerCase() as StatusPillType)) {
                        uiStatus = entry.status.toLowerCase() as StatusPillType
                    } else {
                        uiStatus = 'pending'
                    }
                }
                break
        }
    }

    // parse the amount from the usdamount string in extradata
    const amount = entry.extraData?.usdAmount
        ? parseFloat(String(entry.extraData.usdAmount).replace(/[^\d.-]/g, ''))
        : 0

    // construct explorer url if possible
    let explorerUrlWithTx: string | undefined = undefined
    let addressExplorerUrl: string | undefined = undefined

    // for deposits, explicitly set arbitrum as chain id for explorer url
    const explorerUrlChainID =
        entry.type === EHistoryEntryType.DEPOSIT ? PEANUT_WALLET_CHAIN.id.toString() : entry.chainId
    const baseUrl = getExplorerUrl(explorerUrlChainID)
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
        bankAccountDetails: shouldPlumbBankAccountDetails(entry)
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
