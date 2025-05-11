import { StatusType } from '@/components/Global/Badges/StatusBadge'
import { TransactionType as TransactionCardType } from '@/components/TransactionDetails/TransactionCard'
import { TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { EHistoryEntryType, EHistoryUserRole, HistoryEntry } from '@/hooks/useTransactionHistory'
import { getExplorerUrl, getInitialsFromName } from '@/utils/general.utils'

/**
 * @fileoverview maps raw transaction history data from the api/hook to the format needed by ui components.
 */

/**
 * defines the structure of the data expected by the transaction details drawer component.
 * includes ui-specific fields derived from the original history entry.
 */
export interface TransactionDetails {
    id: string
    direction: TransactionDirection
    userName: string
    amount: number | bigint
    currencySymbol?: string
    tokenSymbol?: string
    initials: string
    status?: StatusType
    isVerified?: boolean
    date: string | Date
    fee?: number | string
    memo?: string
    txHash?: string
    explorerUrl?: string
    extraDataForDrawer?: {
        originalType: EHistoryEntryType
        originalUserRole: EHistoryUserRole
        link?: string
        isLinkTransaction?: boolean
        transactionCardType?: TransactionCardType
    }
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
export function mapTransactionDataForDrawer(entry: HistoryEntry, currentUserUsername?: string): MappedTransactionData {
    // initialize variables
    let direction: TransactionDirection
    let transactionCardType: TransactionCardType
    let nameForDetails = ''
    let uiStatus: StatusType = 'pending'
    let isLinkTx = false
    let isPeerActuallyUser = false

    // determine if the current user was the sender or recipient in the original entry
    const isCurrentUserSender = entry.senderAccount?.isUser && entry.senderAccount?.username === currentUserUsername
    const isCurrentUserRecipient =
        entry.recipientAccount?.isUser && entry.recipientAccount?.username === currentUserUsername

    // determine direction, card type, peer name, and flags based on original type and user role
    switch (entry.type) {
        case EHistoryEntryType.SEND_LINK:
            isLinkTx = true
            if (isCurrentUserSender) {
                direction = 'send'
                transactionCardType = 'send'
                nameForDetails =
                    entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Sent via Link'
                isPeerActuallyUser = !!entry.recipientAccount?.isUser
            } else {
                direction = 'receive'
                transactionCardType = 'add'
                nameForDetails = entry.senderAccount?.username || entry.senderAccount?.identifier || 'Received via Link'
                isPeerActuallyUser = !!entry.senderAccount?.isUser
            }
            break
        case EHistoryEntryType.REQUEST:
            isLinkTx = !entry.txHash
            if (isCurrentUserSender) {
                direction = 'request_sent'
                transactionCardType = 'request'
                nameForDetails =
                    entry.recipientAccount?.username || entry.recipientAccount?.identifier || 'Requested To'
                isPeerActuallyUser = !!entry.recipientAccount?.isUser
            } else {
                if (entry.status?.toUpperCase() === 'NEW' || entry.status?.toUpperCase() === 'PENDING') {
                    direction = 'request_received'
                    transactionCardType = 'request'
                    nameForDetails =
                        entry.senderAccount?.username ||
                        entry.senderAccount?.identifier ||
                        `Request From ${entry.recipientAccount?.username || entry.recipientAccount?.identifier}`
                    isPeerActuallyUser = !!entry.senderAccount?.isUser
                } else {
                    direction = 'send'
                    transactionCardType = 'send'
                    nameForDetails =
                        entry.senderAccount?.username || entry.senderAccount?.identifier || 'Paid Request To'
                    isPeerActuallyUser = !!entry.senderAccount?.isUser
                }
            }
            break
        case EHistoryEntryType.CASHOUT:
            direction = 'withdraw'
            transactionCardType = 'withdraw'
            nameForDetails = entry.recipientAccount?.identifier || 'Bank Account'
            isPeerActuallyUser = false
            break
        case EHistoryEntryType.DEPOSIT:
            direction = 'add'
            transactionCardType = 'add'
            nameForDetails = entry.senderAccount?.identifier || 'Deposit Source'
            isPeerActuallyUser = false
            break
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

    // map the raw status string to the defined ui status types
    switch (entry.status?.toUpperCase()) {
        case 'NEW':
        case 'PENDING':
            uiStatus = 'pending'
            break
        case 'COMPLETED':
        case 'SUCCESSFUL':
        case 'CLAIMED':
        case 'PAID':
            uiStatus = 'completed'
            break
        case 'FAILED':
        case 'ERROR':
            uiStatus = 'failed'
            break
        case 'CANCELLED':
        case 'EXPIRED':
            uiStatus = 'cancelled'
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
                if (entry.status && knownStatuses.includes(entry.status.toLowerCase() as StatusType)) {
                    uiStatus = entry.status.toLowerCase() as StatusType
                } else {
                    uiStatus = 'pending'
                }
            }
            break
    }

    // parse the amount from the usdamount string in extradata
    const amount = entry.extraData?.usdAmount
        ? parseFloat(String(entry.extraData.usdAmount).replace(/[^\d.-]/g, ''))
        : 0

    // construct explorer url if possible
    let explorerUrlWithTx: string | undefined = undefined
    if (entry.txHash && entry.chainId) {
        const baseUrl = getExplorerUrl(entry.chainId)
        if (baseUrl) {
            explorerUrlWithTx = `${baseUrl}/tx/${entry.txHash}`
        }
    }

    // build the final transactiondetails object for the ui
    const transactionDetails: TransactionDetails = {
        id: entry.uuid,
        direction: direction,
        userName: nameForDetails,
        amount: amount,
        currencySymbol: '$',
        tokenSymbol: entry.tokenSymbol,
        initials: getInitialsFromName(nameForDetails),
        status: uiStatus,
        isVerified: entry.recipientAccount?.isUser || entry.senderAccount?.isUser || false,
        date: entry.timestamp,
        fee: undefined,
        memo: entry.attachmentUrl
            ? entry.attachmentUrl
            : entry.extraData?.link && uiStatus === 'pending'
              ? entry.extraData.link
              : undefined,
        txHash: entry.txHash,
        explorerUrl: explorerUrlWithTx,
        extraDataForDrawer: {
            originalType: entry.type as EHistoryEntryType,
            originalUserRole: entry.userRole as EHistoryUserRole,
            link: entry.extraData?.link,
            isLinkTransaction: isLinkTx,
            transactionCardType: transactionCardType,
        },
    }

    return {
        transactionDetails,
        transactionCardType,
    }
}
