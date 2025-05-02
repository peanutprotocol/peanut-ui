import React, { useMemo } from 'react'

import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import EmptyState from '../../EmptyStates/EmptyState'
import { Icon } from '../../Icons/Icon'
import NavHeader from '../../NavHeader'
import { NetworkConfig } from '../TokenSelector.consts'
import NetworkListItem from './NetworkListItem'

interface NetworkListViewProps {
    chains: Record<string, any>
    onSelectChain: (chainId: string) => void
    onBack: () => void
    searchValue: string
    setSearchValue: (value: string) => void
    selectedChainID: string
    allowedChainIds: Set<string>
    comingSoonNetworks: NetworkConfig[]
}

const NetworkListView: React.FC<NetworkListViewProps> = ({
    chains,
    onSelectChain,
    onBack,
    searchValue,
    setSearchValue,
    selectedChainID,
    allowedChainIds,
    comingSoonNetworks,
}) => {
    const filteredChains = useMemo(() => {
        const lowerSearchValue = searchValue.toLowerCase()

        // filter active chains that match the search term and are in the allowed chains list
        const activeChains = Object.values(chains)
            .filter((chain) => allowedChainIds.has(String(chain.chainId)))
            .filter(
                (chain) =>
                    chain.axelarChainName?.toLowerCase().includes(lowerSearchValue) ||
                    chain.chainName?.toLowerCase().includes(lowerSearchValue)
            )
            .map((chain) => ({
                chainId: chain.chainId,
                name: chain.axelarChainName || chain.chainName,
                iconUrl: chain.chainIconURI,
                isComingSoon: false,
            }))

        // filter coming soon networks that match the search term
        const filteredComingSoon = comingSoonNetworks
            .filter((network) => network.name.toLowerCase().includes(lowerSearchValue))
            .map((network) => ({
                chainId: network.chainId,
                name: network.name,
                iconUrl: network.iconUrl,
                isComingSoon: true,
            }))

        return [...activeChains, ...filteredComingSoon]
    }, [chains, searchValue, allowedChainIds, comingSoonNetworks])

    return (
        <div className="relative flex flex-col space-y-4">
            <NavHeader title="More networks" onPrev={onBack} />
            <div className="relative">
                <BaseInput
                    variant="md"
                    className="h-10 w-full border border-black px-10 text-sm font-normal"
                    placeholder="Search for a network"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                />
                <Icon name="search" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" />
                {searchValue && (
                    <Button
                        variant="transparent"
                        onClick={() => setSearchValue('')}
                        className="absolute right-2 top-1/2 w-fit -translate-y-1/2 p-0"
                    >
                        <div className="flex size-6 items-center justify-center">
                            <Icon name="cancel" />
                        </div>
                    </Button>
                )}
            </div>

            <div className="flex max-h-[calc(70vh-120px)] flex-col gap-3 space-y-2 overflow-y-auto pr-1 pt-2">
                {filteredChains.length > 0 ? (
                    filteredChains.map((chain) => (
                        <NetworkListItem
                            key={chain.chainId}
                            chainId={chain.chainId}
                            name={chain.name}
                            iconUrl={chain.iconUrl}
                            isSelected={!chain.isComingSoon && chain.chainId === selectedChainID}
                            isComingSoon={chain.isComingSoon}
                            onClick={() => onSelectChain(chain.chainId)}
                        />
                    ))
                ) : (
                    <EmptyState
                        icon="search"
                        title={`No networks found matching ${searchValue}`}
                        description="Try searching for a different network"
                    />
                )}
            </div>
        </div>
    )
}

export default NetworkListView
