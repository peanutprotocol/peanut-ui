import { useRouter } from 'next/navigation'
import { QRPaymentStatusView } from '@/components/QRPay/QRPaymentStatusView'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { useModalsContext } from '@/context/ModalsContext'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { useQrPayFlow } from '../QrPayFlowContext'
import { useQrReceipt } from '../useQrReceipt'

export function QrPayStatusView() {
    const router = useRouter()
    const { paymentStatus, paymentNeedsSupport } = useQrPayFlow()
    const { setIsSupportModalOpen } = useModalsContext()
    const receipt = useQrReceipt()
    const { isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    if (!paymentStatus || paymentStatus === 'completed') return null
    return (
        <>
            <QRPaymentStatusView
                status={paymentStatus}
                onViewActivity={() => router.push('/history')}
                onContactSupport={paymentNeedsSupport ? () => setIsSupportModalOpen(true) : undefined}
            />
            <TransactionDetailsDrawer
                isOpen={isTransactionSelected(receipt?.id)}
                onClose={closeTransactionDetails}
                transaction={receipt}
            />
        </>
    )
}
