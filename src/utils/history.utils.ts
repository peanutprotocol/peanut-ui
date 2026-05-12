import { MERCADO_PAGO, PIX, SIMPLEFI } from '@/assets/payment-apps'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { getFromLocalStorage } from '@/utils/general.utils'
import { formatUnits } from 'viem'
import { type Hash } from 'viem'
import { getTokenDetails } from '@/utils/general.utils'
import { getCurrencyPrice } from '@/app/actions/currency'
import { type ChargeEntry } from '@/services/services.types'
import { BASE_URL } from '@/constants/general.consts'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'

// NOTE: do not change the order, add new entries at the end, keep synced with backend
export enum EHistoryEntryType {
    REQUEST = 'REQUEST',
    CASHOUT = 'CASHOUT',
    DEPOSIT = 'DEPOSIT',
    SEND_LINK = 'SEND_LINK',
    DIRECT_SEND = 'DIRECT_SEND',
    WITHDRAW = 'WITHDRAW',
    BRIDGE_OFFRAMP = 'BRIDGE_OFFRAMP',
    BRIDGE_ONRAMP = 'BRIDGE_ONRAMP',
    BANK_SEND_LINK_CLAIM = 'BANK_SEND_LINK_CLAIM',
    MANTECA_QR_PAYMENT = 'MANTECA_QR_PAYMENT',
    MANTECA_OFFRAMP = 'MANTECA_OFFRAMP',
    MANTECA_ONRAMP = 'MANTECA_ONRAMP',
    BRIDGE_GUEST_OFFRAMP = 'BRIDGE_GUEST_OFFRAMP',
    SIMPLEFI_QR_PAYMENT = 'SIMPLEFI_QR_PAYMENT',
    PERK_REWARD = 'PERK_REWARD',
    RAIN_CARD_TRANSACTION = 'RAIN_CARD_TRANSACTION',
    /** User-initiated money movement; receipts for collateral/mixed-strategy
     *  Rain spends, same-chain withdraws, and (future) all other flows live
     *  here instead of behind an orphan Charge. Frontend branches on
     *  extraData.kind to style the card. */
    TRANSACTION_INTENT = 'TRANSACTION_INTENT',
}
export enum EHistoryUserRole {
    SENDER = 'SENDER',
    RECIPIENT = 'RECIPIENT',
    BOTH = 'BOTH',
    NONE = 'NONE',
}

// This comes from the backend, only add if added in the backend
// Merge of statuses of charges, sendlinks and manteca and bridge transfers
export enum EHistoryStatus {
    STARTING = 'STARTING',
    ACTIVE = 'ACTIVE',
    WAITING = 'WAITING',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
    EXPIRED = 'EXPIRED',
    FAILED = 'FAILED',
    NEW = 'NEW',
    PENDING = 'PENDING',
    SIGNED = 'SIGNED',
    creating = 'creating',
    completed = 'completed',
    CLAIMING = 'CLAIMING',
    CLAIMED = 'CLAIMED',
    AWAITING_FUNDS = 'AWAITING_FUNDS',
    IN_REVIEW = 'IN_REVIEW',
    FUNDS_RECEIVED = 'FUNDS_RECEIVED',
    PAYMENT_SUBMITTED = 'PAYMENT_SUBMITTED',
    PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
    UNDELIVERABLE = 'UNDELIVERABLE',
    RETURNED = 'RETURNED',
    REFUNDED = 'REFUNDED',
    CANCELED = 'CANCELED',
    ERROR = 'ERROR',
    approved = 'approved',
    pending = 'pending',
    refunded = 'refunded',
    canceled = 'canceled', // from simplefi, canceled with only one l
    expired = 'expired',
    CLOSED = 'CLOSED',
}

export const FINAL_STATES: HistoryStatus[] = [
    EHistoryStatus.COMPLETED,
    EHistoryStatus.EXPIRED,
    EHistoryStatus.CLAIMED,
    EHistoryStatus.PAYMENT_PROCESSED,
    EHistoryStatus.REFUNDED,
    EHistoryStatus.CANCELED,
    EHistoryStatus.ERROR,
    EHistoryStatus.CLOSED,
]

export type HistoryEntryType = `${EHistoryEntryType}`
export type HistoryUserRole = `${EHistoryUserRole}`
export type HistoryStatus = `${EHistoryStatus}`

/**
 * Wire-shape extra-data carried on every HistoryEntry. Pre-this-type,
 * the field was `Record<string, any>` — every consumer did an implicit
 * cast and silent drift between BE writes and FE reads was invisible to
 * the type system.
 *
 * Each field is optional because different BE projectors emit different
 * subsets (Manteca emits `receipt`, Bridge emits `depositInstructions`,
 * card spends emit the merchant/decline cluster, etc.). The interface
 * documents the full superset; the deep object shapes are left loose
 * (`Record<string, unknown>` / aliased typed shapes from
 * `transactionTransformer.ts`) so the transformer keeps doing the
 * boundary cast — but every scalar field now has a concrete type.
 *
 * If you add a field at a BE projector, mirror it here. If you stop
 * reading one on the FE, remove it here.
 */
export interface HistoryEntryExtraData {
    // Wire-shape discriminators. Pinned to string at this layer;
    // downstream `extraDataForDrawer` narrows to `IntentKind` and
    // `Provider` after the transformer runs.
    kind?: string
    provider?: string
    // Bridge flow disambiguation — distinguishes the four Bridge sub-paths
    // that share an intent kind (ONRAMP / OFFRAMP / BANK_SEND_LINK_CLAIM /
    // GUEST_DIRECT_SEND).
    bridgeFlow?: 'ONRAMP' | 'OFFRAMP' | 'BANK_SEND_LINK_CLAIM' | 'GUEST_DIRECT_SEND'
    // Request-pot rollup discriminator — single P2P_REQUEST_FULFILL entry
    // that summarises a request pot's contributors rather than an
    // individual fulfilment.
    isRequestPotRollup?: boolean

    // Common fields
    link?: string
    fulfillmentType?: 'bridge' | 'wallet'
    bridgeTransferId?: string
    usdAmount?: string
    haveSentMoneyToUser?: boolean
    /** Token-transfer block number — `string` from indexer, sometimes `number`
     *  from on-chain webhooks. Treated as a presence signal, not parsed. */
    blockNumber?: string | number

    // Reaper-set on FAILED transitions for orphaned PENDING intents.
    failReason?: string | null

    // Card-spend cluster. Populated for Rain CARD_SPEND / card-refund
    // intents only.
    parentRainTxId?: string | null
    rainTransactionId?: string | null
    cardAuthAmount?: string | null
    cardSettledAmount?: string | null
    cardLocalAmount?: string | null
    cardLocalCurrency?: string | null
    settlementAdjusted?: boolean
    cancellationReason?: string | null
    declineReason?: string | null
    declineCategory?: string | null
    merchantName?: string | null
    merchantCategory?: string | null
    merchantCity?: string | null
    merchantCountry?: string | null
    merchantMcc?: string | null
    merchantLogo?: string | null
    merchantId?: string | null

    // Perk reward + claim metadata. Shapes match
    // TransactionDetails.extraDataForDrawer.perk* — kept loose here to
    // avoid a cross-import; transformer narrows.
    perkReward?: Record<string, unknown>
    perk?: Record<string, unknown>

    // Sendlink-create fields — written when the FE creates a sendlink so
    // the claim URL can be rebuilt at history-render time from
    // localStorage's password store.
    contractVersion?: string
    depositIdx?: string | number
    /** Wire key used to look up the password in localStorage. The BE writes
     *  this for SEND_LINK intents so the claim URL rebuilds reliably even
     *  for rows whose `uuid` is the intent id rather than the legacy link
     *  id. Fixes the Cancel-button-missing regression on TI-shaped
     *  sendlinks. */
    parentSendLinkPubKey?: string

    // Bridge bank-deposit instructions. Renders the depositInstructions
    // row on the receipt.
    depositInstructions?: Record<string, unknown>

    // Manteca / Bridge offramp receipt block. Manteca writes
    // `receipt.depositDetails`; Bridge writes the broader receipt shape.
    receipt?: Record<string, unknown>
}

export type HistoryEntry = {
    uuid: string
    type: HistoryEntryType
    timestamp: Date
    amount: string
    currency?: {
        amount: string
        code: string
    }
    txHash?: string
    chainId: string
    tokenSymbol: string
    tokenAddress: string
    status: HistoryStatus
    userRole: HistoryUserRole
    attachmentUrl?: string
    memo?: string
    cancelledAt?: Date | string
    senderAccount?:
        | {
              identifier: string
              type: string
              isUser: boolean
              username?: string | undefined
              fullName?: string
              userId?: string
              showFullName?: boolean
          }
        | undefined
    recipientAccount: {
        identifier: string
        type: string
        isUser: boolean
        username?: string | undefined
        fullName?: string
        userId?: string
        showFullName?: boolean
    }
    extraData?: HistoryEntryExtraData
    claimedAt?: string | Date
    createdAt?: string | Date
    completedAt?: string | Date
    isVerified?: boolean
    points?: number
    /** Provider fee in USD (human units, e.g. 0.01). Populated by bridge offramp/onramp. */
    fee?: number
    isRequestLink?: boolean // true if the transaction is a request pot link
    charges?: ChargeEntry[]
    totalAmountCollected?: number
}

export function isFinalState(transaction: Pick<HistoryEntry, 'status'>): boolean {
    return FINAL_STATES.includes(transaction.status)
}

/** Whitelist of kinds whose receipt URL is the dedicated /receipt page
 *  (shareable, OG-augmented). All other kinds use whatever
 *  `extraDataForDrawer.link` was stamped, or no shareable URL. */
const RECEIPT_PAGE_KINDS: ReadonlySet<string> = new Set(['QR_PAY', 'ONRAMP', 'OFFRAMP', 'SEND_LINK'])

export function getReceiptUrl(transaction: TransactionDetails): string | undefined {
    const kind = transaction.extraDataForDrawer?.kind
    if (kind && RECEIPT_PAGE_KINDS.has(kind)) {
        return `${BASE_URL}/receipt/${transaction.id}?kind=${kind}`
    }
    if (transaction.extraDataForDrawer?.link) {
        return transaction.extraDataForDrawer.link
    }
    return undefined
}

export function getAvatarUrl(transaction: TransactionDetails): string | undefined {
    if (transaction.extraDataForDrawer?.rewardData?.avatarUrl) {
        return transaction.extraDataForDrawer.rewardData.avatarUrl
    }
    const kind = transaction.extraDataForDrawer?.kind
    const provider = transaction.extraDataForDrawer?.provider
    if (kind === 'QR_PAY' && provider === 'MANTECA') {
        switch (transaction.currency?.code) {
            case 'ARS':
                return MERCADO_PAGO
            case 'BRL':
                return PIX
            default:
                return undefined
        }
    }
    if (kind === 'QR_PAY' && provider === 'DEPRECATED_SIMPLEFI') {
        return SIMPLEFI
    }
    return undefined
}

/** Returns the sign of the transaction, based on the direction and status of the transaction. */
export function getTransactionSign(transaction: Pick<TransactionDetails, 'direction' | 'status'>): '-' | '+' | '' {
    if (transaction.status !== 'completed') {
        return ''
    }
    switch (transaction.direction) {
        case 'send':
        case 'request_received':
        case 'withdraw':
        case 'bank_withdraw':
        case 'bank_claim':
        case 'claim_external':
        case 'qr_payment':
            return '-'
        case 'receive':
        case 'request_sent':
        case 'add':
        case 'bank_deposit':
        case 'bank_request_fulfillment':
            return '+'
    }
}

/** Completes a history entry by adding additional data and formatting the amount. */
export async function completeHistoryEntry(entry: HistoryEntry): Promise<HistoryEntry> {
    const extraData = entry.extraData ?? {}
    const kind = extraData.kind
    let link: string = ''
    let tokenSymbol: string = ''
    let usdAmount: string = ''
    switch (kind) {
        case 'SEND_LINK': {
            // localStorage stores passwords keyed by sendLinkPubKey; the BE
            // writes that key onto the intent extraData so we don't have to
            // mirror the legacy uuid-keyed scheme.
            const lookupKey = extraData.parentSendLinkPubKey ?? entry.uuid
            const password = getFromLocalStorage(`sendLink::password::${lookupKey}`)
            const { contractVersion, depositIdx } = extraData
            if (password) {
                link = `${BASE_URL}/claim?c=${entry.chainId}&v=${contractVersion}&i=${depositIdx}#p=${password}`
            }
            const tokenDetails = getTokenDetails({
                tokenAddress: entry.tokenAddress as Hash,
                chainId: entry.chainId,
            })
            usdAmount = formatUnits(BigInt(entry.amount), tokenDetails?.decimals ?? 6)
            tokenSymbol = tokenDetails?.symbol ?? ''
            break
        }
        case 'P2P_REQUEST_FULFILL': {
            // Request pots and individual request links both arrive here.
            // Pots write `isRequestLink` true on the rollup row.
            if (entry.isRequestLink) {
                const tokenCurrency = entry.tokenSymbol
                const tokenAmount = entry.amount
                link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}/${tokenAmount}${tokenCurrency}?id=${entry.uuid}`
            } else {
                link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}?chargeId=${entry.uuid}`
            }
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount.toString()
            break
        }
        case 'DIRECT_TRANSFER': {
            link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}?chargeId=${entry.uuid}`
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount.toString()
            break
        }
        case 'CRYPTO_DEPOSIT': {
            const details = getTokenDetails({
                tokenAddress: entry.tokenAddress as Hash,
                chainId: entry.chainId,
            })
            tokenSymbol = details?.symbol ?? entry.tokenSymbol
            if (entry.extraData?.blockNumber) {
                // direct deposits are always in wei
                usdAmount = formatUnits(BigInt(entry.amount), PEANUT_WALLET_TOKEN_DECIMALS)
            } else {
                usdAmount = entry.amount.toString()
            }
            break
        }
        case 'ONRAMP': {
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount.toString()
            if (entry.currency?.code) {
                entry.currency.code = entry.currency.code.toUpperCase()
            }
            if (usdAmount === entry.currency?.amount && entry.currency?.code && entry.currency?.code !== 'USD') {
                try {
                    const price = await getCurrencyPrice(entry.currency.code)
                    usdAmount = (Number(entry.currency.amount) / price.buy).toString()
                } catch (error) {
                    console.error(
                        `[completeHistoryEntry] Failed to fetch currency price for ${entry.currency.code}:`,
                        error
                    )
                }
            }
            break
        }
        case 'OFFRAMP': {
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount
            if (entry.currency?.code) {
                entry.currency.code = entry.currency.code.toUpperCase()
            }
            // when bridge/manteca returns non-usd currency on pending states, it may mirror the usd amount.
            // convert it using current fx rate if it looks unconverted (missing or ~equal to usd amount).
            if (entry.currency?.code && entry.currency.code !== 'USD') {
                const usdNum = Number(usdAmount)
                const hasCurrencyAmount = !!entry.currency.amount
                const currNum = hasCurrencyAmount ? Number(entry.currency.amount) : NaN
                const approximatelyEqual = hasCurrencyAmount && isFinite(currNum) && Math.abs(currNum - usdNum) < 0.01

                if (!hasCurrencyAmount || !isFinite(currNum) || approximatelyEqual) {
                    try {
                        const price = await getCurrencyPrice(entry.currency.code)
                        const converted = Number.isFinite(usdNum) && price?.sell ? usdNum * price.sell : usdNum
                        entry.currency.amount = converted.toString()
                    } catch (error) {
                        console.error(
                            `[completeHistoryEntry] Failed to fetch currency price for ${entry.currency.code}:`,
                            error
                        )
                    }
                }
            }
            break
        }
        default: {
            if (entry.amount && !usdAmount) {
                usdAmount = entry.amount.toString()
            }
            tokenSymbol = entry.tokenSymbol
        }
    }
    return {
        ...entry,
        tokenSymbol,
        timestamp: new Date(entry.timestamp),
        cancelledAt: entry.cancelledAt ? new Date(entry.cancelledAt) : undefined,
        extraData: {
            ...extraData,
            link,
            usdAmount,
        },
    }
}
