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
