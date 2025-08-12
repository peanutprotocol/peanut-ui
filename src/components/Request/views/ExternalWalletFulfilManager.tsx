import { useRequestFulfilmentFlow } from '@/context/RequestFulfilBankFlowContext'
import ExternalWalletFulfilMethods from './ExternalWalletFulfilMethods'
import AddMoneyCryptoPage from '@/app/(mobile-ui)/add-money/crypto/page'
import { ParsedURL } from '@/lib/url-parser/types/payment'
import { usePaymentStore } from '@/redux/hooks'
import ConfirmPaymentView from '@/components/Payment/Views/Confirm.payment.view'
import DirectSuccessView from '@/components/Payment/Views/Status.payment.view'
import { PaymentForm } from '@/components/Payment/PaymentForm'

export default function ExternalWalletFulfilManager({
    parsedPaymentData,
    onBack,
}: {
    parsedPaymentData: ParsedURL
    onBack: () => void
}) {
    const {
        showExternalWalletFulfilMethods,
        externalWalletFulfilMethod,
        setExternalWalletFulfilMethod,
        setShowExternalWalletFulfilMethods,
    } = useRequestFulfilmentFlow()
    const { currentView } = usePaymentStore()

    if (externalWalletFulfilMethod === 'wallet') {
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

    if (externalWalletFulfilMethod === 'exchange') {
        return (
            <AddMoneyCryptoPage
                headerTitle="Send"
                depositAddress={parsedPaymentData.recipient.resolvedAddress}
                onBack={() => {
                    setExternalWalletFulfilMethod(null)
                    setShowExternalWalletFulfilMethods(true)
                }}
            />
        )
    }

    if (showExternalWalletFulfilMethods) {
        return <ExternalWalletFulfilMethods onBack={onBack} />
    }

    return null
}
