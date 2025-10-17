import { StatusType } from '@/components/Global/Badges/StatusBadge'
import { TransactionType as TransactionCardType } from '@/components/TransactionDetails/TransactionCard'
import { TransactionDirection } from '@/components/TransactionDetails/TransactionDetailsHeaderCard'
import { EHistoryEntryType, EHistoryUserRole, HistoryEntry } from '@/hooks/useTransactionHistory'
import {
    getExplorerUrl,
    getInitialsFromName,
    getTokenDetails,
    getChainName,
    getTokenLogo,
    getChainLogo,
} from '@/utils/general.utils'
import { StatusPillType } from '../Global/StatusPill'
import type { Address } from 'viem'
import { PEANUT_WALLET_CHAIN } from '@/constants'
import { ChargeEntry, HistoryEntryPerk } from '@/services/services.types'

/**
 * @fileoverview maps raw transaction history data from the api/hook to the format needed by ui components.
 */

export type RewardData = {
    symbol: string
    formatAmount: (amount: number | bigint) => string
    getSymbol: (amount: number | bigint) => string
    avatarUrl: string
}
// Configure reward tokens here
export const REWARD_TOKENS: { [key: string]: RewardData } = {}

/**
 * defines the structure of the data expected by the transaction details drawer component.
 * includes ui-specific fields derived from the original history entry.
 */
export interface TransactionDetails {
    id: string
    direction: TransactionDirection
    userName: string
    fullName: string
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
        link?: string
        isLinkTransaction?: boolean
        transactionCardType?: TransactionCardType
        rewardData?: RewardData
        fulfillmentType?: 'bridge' | 'wallet'
        bridgeTransferId?: string
        avatarUrl?: string
        perk?: HistoryEntryPerk
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

    // determine direction, card type, peer name, and flags based on original type and user role
    switch (entry.type) {
        case EHistoryEntryType.DIRECT_SEND:
            isPeerActuallyUser = true
            direction = 'send'
            transactionCardType = 'send'
            if (entry.userRole === EHistoryUserRole.SENDER) {
                nameForDetails = entry.recipientAccount?.username ?? entry.recipientAccount?.identifier
                fullName = entry.recipientAccount?.fullName ?? ''
            } else {
                direction = 'receive'
                transactionCardType = 'receive'
                nameForDetails =
                    entry.senderAccount?.username ?? entry.senderAccount?.identifier ?? 'Requested via Link'
                ;((fullName = entry.senderAccount?.fullName ?? ''), (isLinkTx = !entry.senderAccount)) // If the sender is not an user then it's a public link
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
            }
            break
        case EHistoryEntryType.REQUEST:
            if (entry.extraData?.fulfillmentType === 'bridge' && entry.userRole === EHistoryUserRole.SENDER) {
                transactionCardType = 'bank_request_fulfillment'
                direction = 'bank_request_fulfillment'
                nameForDetails = entry.recipientAccount?.username ?? entry.recipientAccount?.identifier
                fullName = entry.recipientAccount?.fullName ?? ''
                isPeerActuallyUser = !!entry.recipientAccount?.isUser || !!entry.senderAccount?.isUser
            } else if (entry.userRole === EHistoryUserRole.RECIPIENT) {
                direction = 'request_sent'
                transactionCardType = 'request'
                nameForDetails =
                    entry.senderAccount?.username || entry.senderAccount?.identifier || 'Requested via Link'
                fullName = entry.senderAccount?.fullName ?? ''
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
        case EHistoryEntryType.DEPOSIT:
            direction = 'add'
            transactionCardType = 'add'
            nameForDetails = entry.senderAccount?.identifier || 'Deposit Source'
            isPeerActuallyUser = false
            break
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

    // build the final transactiondetails object for the ui
    const transactionDetails: TransactionDetails = {
        id: entry.uuid,
        direction: direction,
        userName: nameForDetails,
        amount,
        fullName,
        currency: rewardData ? undefined : entry.currency,
        currencySymbol: `${entry.userRole === EHistoryUserRole.SENDER ? '-' : '+'}$`,
        tokenSymbol: rewardData?.getSymbol(amount) ?? entry.tokenSymbol,
        initials: getInitialsFromName(nameForDetails),
        status: uiStatus,
        isVerified: entry.isVerified && isPeerActuallyUser,
        // only show verification badge if the other person is a peanut user
        date: new Date(entry.timestamp),
        fee: undefined,
        memo: entry.memo?.trim(),
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
            link: entry.extraData?.link,
            isLinkTransaction: isLinkTx,
            transactionCardType,
            rewardData,
            fulfillmentType: entry.extraData?.fulfillmentType,
            bridgeTransferId: entry.extraData?.bridgeTransferId,
            perk: entry.extraData?.perk as HistoryEntryPerk | undefined,
            depositInstructions:
                entry.type === EHistoryEntryType.BRIDGE_ONRAMP || entry.extraData?.fulfillmentType === 'bridge'
                    ? entry.extraData?.depositInstructions
                    : undefined,
            receipt: entry.extraData?.receipt,
        },
        sourceView: 'history',
        points: entry.points,
        bankAccountDetails:
            entry.type === EHistoryEntryType.BRIDGE_OFFRAMP ||
            (entry.type === EHistoryEntryType.BANK_SEND_LINK_CLAIM && entry.userRole === EHistoryUserRole.RECIPIENT)
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
    }

    return {
        transactionDetails,
        transactionCardType,
    }
}
