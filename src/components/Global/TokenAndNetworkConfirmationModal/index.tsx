import ActionModal from '@/components/Global/ActionModal'
import { Slider } from '@/components/Slider'
import ChainChip from '@/components/AddMoney/components/ChainChip'
import {
    RHINO_SUPPORTED_CHAINS,
    RHINO_SUPPORTED_EVM_CHAINS,
    RHINO_SUPPORTED_OTHER_CHAINS,
    RHINO_SUPPORTED_TOKENS,
} from '@/constants/rhino.consts'

export default function TokenAndNetworkConfirmationModal({
    onClose,
    onAccept,
    isVisible = true,
}: {
    onClose: () => void
    onAccept: () => void
    isVisible?: boolean
}) {
    return (
        <ActionModal
            visible={isVisible}
            onClose={onClose}
            icon={'alert'}
            iconContainerClassName="bg-yellow-1"
            modalClassName="z-[9999]"
            title={`Send only supported tokens on supported networks`}
            description={
                <div className="flex flex-col items-center gap-2">
                    <span className="text-sm">
                        Sending the wrong token or using the wrong network will result in permanent loss.
                    </span>

                    <div className="mt-2 flex w-full flex-col items-start gap-2">
                        <h2 className="font-bold text-black">Supported Networks</h2>

                        <div className="flex flex-wrap gap-2">
                            {RHINO_SUPPORTED_OTHER_CHAINS.map((chain) => (
                                <ChainChip key={chain.name} chainName={chain.name} chainSymbol={chain.logoUrl} />
                            ))}
                            {RHINO_SUPPORTED_EVM_CHAINS.slice(0, 6).map((chain) => (
                                <ChainChip key={chain.name} chainName={chain.name} chainSymbol={chain.logoUrl} />
                            ))}
                            <ChainChip
                                chainName={'+4 EVM'}
                                logo="plus"
                                logoClassName="bg-black rounded-full text-white"
                            />
                        </div>
                    </div>

                    <div className="mt-2 flex w-full flex-col items-start gap-2">
                        <h2 className="font-bold text-black">Supported Tokens</h2>

                        <div className="flex flex-wrap gap-2">
                            {RHINO_SUPPORTED_TOKENS.map((token) => (
                                <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                            ))}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="w-full">
                    <Slider onValueChange={(v) => v && onAccept()} />
                </div>
            }
            ctas={[]}
            modalPanelClassName="max-w-sm"
        />
    )
}
