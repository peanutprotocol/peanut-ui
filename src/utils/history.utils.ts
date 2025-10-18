import { MERCADO_PAGO, PIX, SIMPLEFI } from '@/assets/payment-apps'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { getFromLocalStorage } from '@/utils'
import { PEANUT_WALLET_TOKEN_DECIMALS, BASE_URL } from '@/constants'
import { formatUnits } from 'viem'
import { type Hash } from 'viem'
import { getTokenDetails } from '@/utils'
import { getCurrencyPrice } from '@/app/actions/currency'
import { ChargeEntry } from '@/services/services.types'

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
    SIMPLEFI_QR_PAYMENT = 'SIMPLEFI_QR_PAYMENT',
    MANTECA_OFFRAMP = 'MANTECA_OFFRAMP',
    MANTECA_ONRAMP = 'MANTECA_ONRAMP',
    BRIDGE_GUEST_OFFRAMP = 'BRIDGE_GUEST_OFFRAMP',
}
export function historyTypeToNumber(type: EHistoryEntryType): number {
    return Object.values(EHistoryEntryType).indexOf(type)
}
export function historyTypeFromNumber(type: number): EHistoryEntryType {
    return Object.values(EHistoryEntryType)[type]
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
          }
        | undefined
    recipientAccount: {
        identifier: string
        type: string
        isUser: boolean
        username?: string | undefined
        fullName?: string
        userId?: string
    }
    extraData?: Record<string, any>
    claimedAt?: string | Date
    createdAt?: string | Date
    completedAt?: string | Date
    isVerified?: boolean
    points?: number
    isRequestLink?: boolean // true if the transaction is a request pot link
    charges?: ChargeEntry[]
    totalAmountCollected?: number
}

export function isFinalState(transaction: Pick<HistoryEntry, 'status'>): boolean {
    return FINAL_STATES.includes(transaction.status)
}

export function getReceiptUrl(transaction: TransactionDetails): string | undefined {
    const hasReceiptPage =
        transaction.extraDataForDrawer?.originalType &&
        [
            EHistoryEntryType.MANTECA_QR_PAYMENT,
            EHistoryEntryType.SIMPLEFI_QR_PAYMENT,
            EHistoryEntryType.MANTECA_OFFRAMP,
            EHistoryEntryType.MANTECA_ONRAMP,
            EHistoryEntryType.SEND_LINK,
        ].includes(transaction.extraDataForDrawer.originalType)
    if (hasReceiptPage) {
        const typeId = historyTypeToNumber(transaction.extraDataForDrawer!.originalType)
        return `${BASE_URL}/receipt/${transaction.id}?t=${typeId}`
    }

    if (transaction.extraDataForDrawer?.link) {
        return transaction.extraDataForDrawer.link
    }
}

export function getAvatarUrl(transaction: TransactionDetails): string | undefined {
    if (transaction.extraDataForDrawer?.rewardData?.avatarUrl) {
        return transaction.extraDataForDrawer.rewardData.avatarUrl
    }
    if (transaction.extraDataForDrawer?.originalType === EHistoryEntryType.MANTECA_QR_PAYMENT) {
        switch (transaction.currency?.code) {
            case 'ARS':
                return MERCADO_PAGO
            case 'BRL':
                return PIX
            default:
                return undefined
        }
    }
    if (transaction.extraDataForDrawer?.originalType === EHistoryEntryType.SIMPLEFI_QR_PAYMENT) {
        return SIMPLEFI
    }
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
    let link: string = ''
    let tokenSymbol: string = ''
    let usdAmount: string = ''
    switch (entry.type) {
        case EHistoryEntryType.SEND_LINK: {
            const password = getFromLocalStorage(`sendLink::password::${entry.uuid}`)
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
        case EHistoryEntryType.REQUEST: {
            // if link is a request link, we need to add the token amount and symbol to the link, also use id param instead of chargeId
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
        case EHistoryEntryType.DIRECT_SEND: {
            link = `${BASE_URL}/${entry.recipientAccount.username || entry.recipientAccount.identifier}?chargeId=${entry.uuid}`
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount.toString()
            break
        }
        case EHistoryEntryType.DEPOSIT: {
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
        case EHistoryEntryType.BRIDGE_ONRAMP: {
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount.toString()
            if (entry.currency?.code) {
                entry.currency.code = entry.currency.code.toUpperCase()
            }
            if (usdAmount === entry.currency?.amount && entry.currency?.code && entry.currency?.code !== 'USD') {
                const price = await getCurrencyPrice(entry.currency.code)
                usdAmount = (Number(entry.currency.amount) / price.buy).toString()
            }
            break
        }
        case EHistoryEntryType.BRIDGE_OFFRAMP:
        case EHistoryEntryType.BRIDGE_GUEST_OFFRAMP:
        case EHistoryEntryType.BANK_SEND_LINK_CLAIM: {
            tokenSymbol = entry.tokenSymbol
            usdAmount = entry.amount
            if (entry.currency?.code) {
                entry.currency.code = entry.currency.code.toUpperCase()
            }
            if (usdAmount === entry.currency?.amount && entry.currency?.code && entry.currency?.code !== 'USD') {
                const price = await getCurrencyPrice(entry.currency.code)
                entry.currency.amount = (Number(entry.amount) / price.sell).toString()
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
