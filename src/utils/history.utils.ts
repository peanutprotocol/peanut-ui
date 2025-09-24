import { MERCADO_PAGO, PIX } from '@/assets/payment-apps'
import { EHistoryEntryType } from '@/hooks/useTransactionHistory'
import { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'

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
