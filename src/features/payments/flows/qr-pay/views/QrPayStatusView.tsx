import { useRouter } from 'next/navigation'
import { QRPaymentStatusView } from '@/components/QRPay/QRPaymentStatusView'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { qrPaymentDisplayStatus } from '@/utils/qr-payment.utils'
import { useQrPayFlow } from '../QrPayFlowContext'
import { useQrReceipt } from '../useQrReceipt'

export function QrPayStatusView() {
    const router = useRouter()
    const { qrPayment } = useQrPayFlow()
    const receipt = useQrReceipt()
    const { isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    const status = qrPaymentDisplayStatus(qrPayment?.status)
    if (status === 'completed') return null
    return (
        <>
            <QRPaymentStatusView status={status} onViewActivity={() => router.push('/history')} />
            <TransactionDetailsDrawer
                isOpen={isTransactionSelected(receipt?.id)}
                onClose={closeTransactionDetails}
                transaction={receipt}
            />
        </>
    )
}
