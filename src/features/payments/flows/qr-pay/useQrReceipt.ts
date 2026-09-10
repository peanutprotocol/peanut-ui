import { useMemo } from 'react'
import { type TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import { qrPaymentDisplayStatus } from '@/utils/qr-payment.utils'
import { useQrPayFlow } from './QrPayFlowContext'

export function useQrReceipt() {
    const { qrPayment, currency, usdAmount, methodIcon } = useQrPayFlow()
    // receipt transaction for the success drawer — built up-front (not in the
    // cta's onClick) because the drawer opens off the url's `?tx=` match.
    const receiptTransaction: TransactionDetails | null = useMemo(() => {
        if (!qrPayment || !currency) return null
        const now = new Date()
        return {
            // Manteca synthetic id — the only key /receipt/<id>
            // resolves, and what Activity rows already carry.
            // `externalId` is UUID-shaped, so it slips past the
            // id-shape gate and 404s silently instead of erroring.
            id: qrPayment.id,
            direction: 'qr_payment',
            userName: qrPayment.details.merchant.name,
            fullName: qrPayment.details.merchant.name,
            amount: Number(usdAmount),
            currency: {
                amount: qrPayment.details.paymentAssetAmount,
                code: currency.code,
            },
            initials: 'QR',
            currencySymbol: currency.symbol,
            status: qrPaymentDisplayStatus(qrPayment.status),
            date: now,
            createdAt: now,
            extraDataForDrawer: {
                originalType: 'TRANSACTION_INTENT',
                originalUserRole: EHistoryUserRole.SENDER,
                kind: 'QR_PAY',
                provider: 'MANTECA',
                avatarUrl: methodIcon,
                receipt: {
                    exchange_rate: currency.price.toString(),
                },
            },
            totalAmountCollected: Number(usdAmount),
        }
    }, [qrPayment, currency, usdAmount, methodIcon])

    return receiptTransaction
}
