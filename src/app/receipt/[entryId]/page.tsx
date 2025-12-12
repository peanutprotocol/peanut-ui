import { connection } from 'next/server'
import { notFound } from 'next/navigation'
import { isFinalState, historyTypeFromNumber } from '@/utils/history.utils'
import { getHistoryEntry } from '@/app/actions/history'
import {
    mapTransactionDataForDrawer,
    type TransactionDetails,
} from '@/components/TransactionDetails/transactionTransformer'
import { TransactionDetailsReceipt } from '@/components/TransactionDetails/TransactionDetailsReceipt'
import NavHeader from '@/components/Global/NavHeader'
import { generateMetadata as generateBaseMetadata } from '@/app/metadata'
import { type Metadata } from 'next'
import { BASE_URL } from '@/constants/general.consts'
import { formatAmount, formatCurrency, isStableCoin } from '@/utils/general.utils'
import getOrigin from '@/lib/hosting/get-origin'

// Helper function to map transaction card type to OG image type
function mapTransactionTypeToOGType(transactionType: string): 'send' | 'request' {
    switch (transactionType) {
        case 'request':
            return 'request'
        case 'send':
        case 'receive':
        case 'withdraw':
        case 'bank_withdraw':
        case 'bank_deposit':
        case 'bank_claim':
        case 'claim_external':
        case 'add':
        case 'pay':
        default:
            return 'send'
    }
}

// Helper function to generate receipt title based on transaction details
function generateReceiptTitle(transaction: TransactionDetails): string {
    const { direction, amount, userName, status, currency, tokenSymbol } = transaction

    // Format amount - use currency if available, otherwise tokenSymbol
    let formattedAmount: string
    if (currency && currency.code !== 'USD') {
        formattedAmount = `${currency.code} ${formatAmount(currency.amount)}`
    } else if (tokenSymbol && !isStableCoin(tokenSymbol)) {
        formattedAmount = `${formatAmount(Number(amount))} ${tokenSymbol}`
    } else {
        formattedAmount = `$${formatCurrency(Number(amount).toString())}`
    }

    // Handle different transaction directions and statuses
    if (status === 'failed') {
        return 'Receipt - Failed transaction'
    }

    if (status === 'cancelled') {
        return 'Receipt - Cancelled transaction'
    }

    switch (direction) {
        case 'send':
            return `Receipt - You sent ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'receive':
            return `Receipt - You received ${formattedAmount}${userName ? ` from ${userName}` : ''}`
        case 'withdraw':
        case 'bank_withdraw':
            return `Receipt - Withdrawal of ${formattedAmount}`
        case 'bank_deposit':
        case 'add':
            return `Receipt - Deposit of ${formattedAmount}`
        case 'request_sent':
            return `Receipt - Request for ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'request_received':
            return `Receipt - Request for ${formattedAmount}${userName ? ` from ${userName}` : ''}`
        case 'bank_request_fulfillment':
            return `Receipt - Bank payment of ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        case 'bank_claim':
        case 'claim_external':
            return `Receipt - Claim of ${formattedAmount}`
        case 'qr_payment':
            return `Receipt - Payment of ${formattedAmount}${userName ? ` to ${userName}` : ''}`
        default:
            return `Receipt - Transaction of ${formattedAmount}`
    }
}

// Helper function to generate receipt description based on status
function generateReceiptDescription(status: string): string {
    switch (status) {
        case 'completed':
            return 'Transaction completed via Peanut'
        case 'pending':
            return 'Transaction pending'
        case 'processing':
            return 'Transaction processing'
        case 'failed':
            return 'Transaction failed'
        case 'cancelled':
            return 'Transaction cancelled'
        default:
            return 'View transaction receipt'
    }
}

export async function generateMetadata({
    params,
    searchParams,
}: {
    params: Promise<{ entryId: string; type?: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}): Promise<Metadata> {
    const basicMetadata = generateBaseMetadata({
        title: `Receipt`,
        description: `View the receipt for the transaction`,
    })

    const { entryId } = await params
    let entryTypeId = (await searchParams).t
    if (!entryId || !entryTypeId || typeof entryTypeId !== 'string' || !historyTypeFromNumber(Number(entryTypeId))) {
        return basicMetadata
    }

    const entryType = historyTypeFromNumber(Number(entryTypeId))
    const entry = await getHistoryEntry(entryId, entryType)
    if (!entry) {
        return basicMetadata
    }

    // Transform the entry data to get readable transaction details
    const { transactionDetails } = mapTransactionDataForDrawer(entry)

    // Generate dynamic title and description
    const title = generateReceiptTitle(transactionDetails)
    const description = generateReceiptDescription(transactionDetails.status || 'pending')

    // Generate dynamic OG image URL
    const origin = (await getOrigin()) || BASE_URL
    const ogUrl = new URL(`${origin}/api/og`)

    // Map transaction type for OG image
    const ogType = mapTransactionTypeToOGType(transactionDetails.extraDataForDrawer?.transactionCardType || 'send')
    ogUrl.searchParams.set('type', ogType)
    ogUrl.searchParams.set('isReceipt', 'true')

    // Add amount if available (always use USD amount)
    if (transactionDetails.amount > 0) {
        ogUrl.searchParams.set('amount', formatCurrency(Number(transactionDetails.amount).toString()))
        ogUrl.searchParams.set('token', 'USDC')
    }

    // Add username if available and not an address-like string
    if (
        transactionDetails.userName &&
        transactionDetails.userName.length < 20 &&
        !transactionDetails.userName.startsWith('0x')
    ) {
        ogUrl.searchParams.set('username', transactionDetails.userName)
    }

    return generateBaseMetadata({
        title,
        description,
        image: ogUrl.toString(),
        keywords: 'crypto receipt, transaction receipt, payment receipt, Peanut Protocol',
    })
}

export default async function ReceiptPage({
    params,
    searchParams,
}: {
    params: Promise<{ entryId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { entryId } = await params
    let entryTypeId = (await searchParams).t
    if (!entryId || !entryTypeId || typeof entryTypeId !== 'string' || !historyTypeFromNumber(Number(entryTypeId))) {
        notFound()
    }
    const entryType = historyTypeFromNumber(Number(entryTypeId))
    const entry = await getHistoryEntry(entryId, entryType)
    if (!entry) {
        notFound()
    }
    if (!isFinalState(entry)) {
        await connection()
    }
    const { transactionDetails } = mapTransactionDataForDrawer(entry)
    return (
        <div className="p-6">
            <div className="md:hidden">
                <NavHeader title="Receipt" />
            </div>
            <div className="flex min-h-[100dvh] flex-col items-center justify-center">
                <TransactionDetailsReceipt className="w-full" transaction={transactionDetails!} />
            </div>
        </div>
    )
}
