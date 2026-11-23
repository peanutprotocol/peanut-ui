import { useRouter } from 'next/navigation'
import { QRPaymentStatusView } from '@/components/QRPay/QRPaymentStatusView'
import { TransactionDetailsDrawer } from '@/components/TransactionDetails/TransactionDetailsDrawer'
import { useModalsContext } from '@/context/ModalsContext'
import { useTransactionDetailsDrawer } from '@/hooks/useTransactionDetailsDrawer'
import { formatBankAmount } from '@/utils/currency'
import { useQrPayFlow } from '../QrPayFlowContext'
import { useQrReceipt } from '../useQrReceipt'

export function QrPayStatusView() {
    const router = useRouter()
    const { paymentStatus, paymentNeedsSupport } = useQrPayFlow()
    const { setIsSupportModalOpen } = useModalsContext()
    const receipt = useQrReceipt()
    const { isTransactionSelected, closeTransactionDetails } = useTransactionDetailsDrawer()
    if (!paymentStatus || paymentStatus === 'completed') return null
    const pendingPayment = receipt?.currency
        ? {
              merchantName: receipt.userName,
              amount: formatBankAmount(receipt.currency.amount, receipt.currency.code),
              usdAmount: formatBankAmount(Number(receipt.amount), 'USD'),
          }
        : null
    return (
        <>
            <QRPaymentStatusView
                status={paymentStatus}
                payment={pendingPayment}
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
