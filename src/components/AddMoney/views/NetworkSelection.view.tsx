import { Button } from '@/components/0_Bruddle'
import { CardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import NetworkListItem from '@/components/Global/TokenSelector/Components/NetworkListItem'
import {
    NetworkConfig,
    TOKEN_SELECTOR_COMING_SOON_NETWORKS,
    TOKEN_SELECTOR_POPULAR_NETWORK_IDS,
} from '@/components/Global/TokenSelector/TokenSelector.consts'
import { PEANUT_WALLET_CHAIN } from '@/constants'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import React, { useContext } from 'react'

export interface SelectedNetwork extends NetworkConfig {}

interface NetworkSelectionViewProps {
    onNetworkSelect: (network: SelectedNetwork) => void
    onBack: () => void
}

const NetworkSelectionView: React.FC<NetworkSelectionViewProps> = ({ onNetworkSelect, onBack }) => {
    const { supportedSquidChainsAndTokens } = useContext(tokenSelectorContext)

    const popularNetworks: SelectedNetwork[] = TOKEN_SELECTOR_POPULAR_NETWORK_IDS.map((net) => {
        const squidChain = supportedSquidChainsAndTokens[net.chainId]
        return {
            chainId: net.chainId,
            name: net.name,
            iconUrl: squidChain?.chainIconURI || '',
        }
    })

    const comingSoonNetworks: SelectedNetwork[] = TOKEN_SELECTOR_COMING_SOON_NETWORKS

    const allNetworks = [...popularNetworks, ...comingSoonNetworks]

    return (
        <div className="w-full space-y-8">
            <NavHeader title="Add Money" onPrev={onBack} />
            <div className="flex h-full w-full flex-col justify-start gap-2 self-start pb-5 md:pb-0">
                <h2 className="text-base font-bold">What network will you use?</h2>
                <div className="flex flex-col gap-3 pr-1 pt-2">
                    {allNetworks.map((network, index) => {
                        const isFirst = index === 0
                        const isLast = index === allNetworks.length - 1
                        let position: CardPosition = 'middle'
                        if (allNetworks.length === 1) {
                            position = 'single'
                        } else if (isFirst) {
                            position = 'first'
                        } else if (isLast) {
                            position = 'last'
                        }

                        const squidChainDetails = supportedSquidChainsAndTokens[network.chainId]

                        const isComingSoon = network.chainId !== PEANUT_WALLET_CHAIN.id.toString()

                        return (
                            <NetworkListItem
                                key={index}
                                chainId={squidChainDetails?.chainId ?? network.chainId}
                                name={squidChainDetails?.axelarChainName ?? network.name}
                                iconUrl={squidChainDetails?.chainIconURI ?? network.iconUrl}
                                isComingSoon={isComingSoon}
                                onClick={() =>
                                    onNetworkSelect({
                                        chainId: squidChainDetails?.chainId ?? network.chainId,
                                        name: squidChainDetails?.axelarChainName ?? network.name,
                                        iconUrl: squidChainDetails?.chainIconURI ?? network.iconUrl,
                                    })
                                }
                                titleClassName="font-medium"
                                rightContent={
                                    <Button
                                        shadowSize="4"
                                        size="small"
                                        className="h-6 w-6 rounded-full p-0 shadow-[0.12rem_0.12rem_0_#000000]"
                                    >
                                        <div className="flex size-7 items-center justify-center">
                                            <Icon name="chevron-up" className="h-9 rotate-90" />
                                        </div>
                                    </Button>
                                }
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default NetworkSelectionView
