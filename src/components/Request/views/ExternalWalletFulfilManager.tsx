import { useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'
import ExternalWalletFulfilMethods from './ExternalWalletFulfilMethods'
import AddMoneyCryptoPage from '@/app/(mobile-ui)/add-money/crypto/page'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { PaymentForm } from '@/components/Payment/PaymentForm'

export default function ExternalWalletFulfilManager({ parsedPaymentData }: { parsedPaymentData: ParsedURL }) {
    const {
        showExternalWalletFulfillMethods,
        externalWalletFulfillMethod,
        setExternalWalletFulfillMethod,
        setShowExternalWalletFulfillMethods,
    } = useRequestFulfillmentFlow()
    const { currentView } = usePaymentStore()

    if (externalWalletFulfillMethod === 'wallet') {
        switch (currentView) {
            case 'INITIAL':
                return (
                    <PaymentForm
                        recipient={parsedPaymentData.recipient}
                        amount={parsedPaymentData.amount}
                        token={parsedPaymentData.token}
                        chain={parsedPaymentData.chain}
                        isExternalWalletFlow={true}
                        headerTitle="Send"
                    />
                )
            case 'CONFIRM':
                return <ConfirmPaymentView isExternalWalletFlow={true} headerTitle="Send" />
            case 'STATUS':
                return (
                    <DirectSuccessView
                        headerTitle="Send"
                        type="SEND"
                        currencyAmount={parsedPaymentData.amount}
                        recipientType={parsedPaymentData.recipient.recipientType}
                        redirectTo="/home"
                    />
                )
            default:
                break
        }
    }

    if (externalWalletFulfillMethod === 'exchange') {
        return (
            <AddMoneyCryptoPage
                headerTitle="Send"
                depositAddress={parsedPaymentData.recipient.resolvedAddress}
                onBack={() => {
                    setExternalWalletFulfillMethod(null)
                    setShowExternalWalletFulfillMethods(true)
                }}
            />
        )
    }

    if (showExternalWalletFulfillMethods) {
        return <ExternalWalletFulfilMethods onBack={() => setShowExternalWalletFulfillMethods(false)} />
    }

    return null
}
