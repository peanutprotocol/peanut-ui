import ActionModal from '@/components/Global/ActionModal'
import { Slider } from '@/components/Slider'
import { ARBITRUM_ICON } from '@/assets'
import { type NetworkConfig } from '@/components/Global/TokenSelector/TokenSelector.consts'
import { type CryptoToken } from '@/components/AddMoney/consts'
import Image from 'next/image'

export default function TokenAndNetworkConfirmationModal({
    token,
    network,
    onClose,
    onAccept,
    isVisible = true,
}: {
    token?: Pick<CryptoToken, 'symbol' | 'icon'>
    network?: Pick<NetworkConfig, 'name' | 'iconUrl'>
    onClose: () => void
    onAccept: () => void
    isVisible?: boolean
}) {
    token = token ?? { symbol: 'USDC', icon: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png' }
    network = network ?? { name: 'Arbitrum', iconUrl: ARBITRUM_ICON }

    return (
        <ActionModal
            visible={isVisible}
            onClose={onClose}
            icon={'alert'}
            iconContainerClassName="bg-yellow-1"
            modalClassName="z-[9999]"
            title={`Only send funds using`}
            description={
                <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
                        <Image src={token.icon} alt={token.symbol} width={28} height={28} />
                        <span className="text-xl font-medium text-black">{token.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Image src={network.iconUrl} alt={network.name} width={28} height={28} />
                        <span className="text-xl font-medium text-black">{network.name}</span>
                    </div>
                    <span className="text-sm">
                        Sending funds via any other network will result in a <b>permanent loss.</b>
                    </span>
                </div>
            }
            footer={
                <div className="w-full">
                    <Slider onValueChange={(v) => v && onAccept()} />
                </div>
            }
            ctas={[]}
            modalPanelClassName="max-w-xs"
        />
    )
}
