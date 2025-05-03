import React, { useMemo } from 'react'

import EmptyState from '../../EmptyStates/EmptyState'
import NavHeader from '../../NavHeader'
import { NetworkConfig } from '../TokenSelector.consts'
import NetworkListItem from './NetworkListItem'
import SearchInput from './SearchInput'

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
            <SearchInput
                value={searchValue}
                onChange={setSearchValue}
                onClear={() => setSearchValue('')}
                placeholder="Search for a network"
            />

            <div className="flex max-h-[60vh] flex-col gap-3 space-y-2 overflow-y-auto pr-1 pt-2">
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
