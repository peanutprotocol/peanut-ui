import NavHeader from '@/components/Global/NavHeader'
import { useRequestFulfilmentFlow } from '@/context/RequestFulfilBankFlowContext'
import ExternalWalletFulfilMethods from './ExternalWalletFulfilMethods'
import AddMoneyCryptoPage from '@/app/(mobile-ui)/add-money/crypto/page'
import { ParsedURL } from '@/lib/url-parser/types/payment'

export default function ExternalWalletFulfilManager({ parsedPaymentData }: { parsedPaymentData: ParsedURL }) {
    const {
        showExternalWalletFulfilMethods,
        externalWalletFulfilMethod,
        setExternalWalletFulfilMethod,
        setShowExternalWalletFulfilMethods,
    } = useRequestFulfilmentFlow()

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
        return <ExternalWalletFulfilMethods />
    }

    return (
        <div className="flex h-full min-h-[inherit] w-full flex-1 flex-col justify-start gap-4">
            <NavHeader title="Send" onPrev={() => setShowExternalWalletFulfilMethods(false)} />
            <div className="my-auto space-y-2">
                <div className="text-base font-bold">Where will you send from?</div>
            </div>
        </div>
    )
}
