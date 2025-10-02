import { BINANCE_LOGO, LEMON_LOGO, RIPIO_LOGO } from '@/assets'
import { METAMASK_LOGO, RAINBOW_LOGO, TRUST_WALLET_SMALL_LOGO } from '@/assets/wallets'
import { MethodCard } from '@/components/Common/ActionList'
import NavHeader from '@/components/Global/NavHeader'
import { PaymentMethod } from '@/constants/actionlist.consts'
import { ExternalWalletFulfilMethod, useRequestFulfillmentFlow } from '@/context/RequestFulfillmentFlowContext'

const methods: PaymentMethod[] = [
    {
        id: 'exchange',
        title: 'Exchange',
        description: 'Lemon, Binance, Ripio and more',
        icons: [RIPIO_LOGO, BINANCE_LOGO, LEMON_LOGO],
        soon: false,
    },
    {
        id: 'wallet',
        title: 'Crypto Wallet',
        description: 'Metamask, Trustwallet and more',
        icons: [RAINBOW_LOGO, TRUST_WALLET_SMALL_LOGO, METAMASK_LOGO],
        soon: false,
    },
]

export default function ExternalWalletFulfilMethods({ onBack }: { onBack: () => void }) {
    const { setExternalWalletFulfillMethod } = useRequestFulfillmentFlow()

    return (
        <div className="flex h-full min-h-[inherit] w-full flex-1 flex-col justify-start gap-4">
            <NavHeader title="Send" onPrev={onBack} />
            <div className="my-auto space-y-2">
                <div className="text-base font-bold">Where will you send from?</div>
                {methods.map((method) => (
                    <MethodCard
                        key={method.id}
                        method={method}
                        onClick={() => {
                            setExternalWalletFulfillMethod(method.id as ExternalWalletFulfilMethod)
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
