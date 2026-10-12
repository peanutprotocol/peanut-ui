/**
 * full network list view for the token selector
 *
 * shows searchable list of all supported networks plus "coming soon" networks
 * accessed via the "More networks" link in the network section
 *
 * BACK AFFORDANCE — `NavHeader`, by kush's ruling 2026-09-21: the DS has one
 * back control and a sub-view of a drawer should not invent a second one.
 * `hideMaintenanceBanner` is what makes it safe here — it suppresses BOTH page
 * behaviours that made NavHeader wrong inside a sheet: the maintenance `Banner`
 * mount, and the `useRegisterNavHeader` presence claim that would otherwise
 * tell the shell a page header exists and suppress its own banner fallback.
 * design.md scopes NavHeader to pages; this extends it to a drawer sub-view and
 * the rulebook needs the same line (follow-up, TASK-22839).
 */

import { useTranslations } from 'next-intl'
import React, { useMemo } from 'react'

import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { SearchInput } from '@/components/SearchInput'
import NavHeader from '../../NavHeader'
import { type ChainWithTokens } from '@/interfaces/chain-meta'
import EmptyState from '../../EmptyStates/EmptyState'
import { type NetworkConfig } from '../TokenSelector.consts'
import NetworkListItem from './NetworkListItem'

interface NetworkListViewProps {
    chains: Record<string, ChainWithTokens>
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
    const t = useTranslations('global')

    const filteredChains = useMemo(() => {
        const lowerSearchValue = searchValue.toLowerCase()

        // filter active chains that match the search term and are in the allowed chains list
        const activeChains = Object.values(chains)
            .filter((chain) => allowedChainIds.has(String(chain.chainId)))
            .filter((chain) => chain.networkName.toLowerCase().includes(lowerSearchValue))
            .map((chain) => ({
                chainId: chain.chainId,
                name: chain.networkName,
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
        <div className="flex flex-col gap-4">
            <NavHeader title={t('tokenSelector.moreNetworksTitle')} onPrev={onBack} hideMaintenanceBanner />

            <SearchInput
                value={searchValue}
                onChange={setSearchValue}
                onClear={() => setSearchValue('')}
                placeholder={t('tokenSelector.searchNetworkPlaceholder')}
            />

            {/* the px-1/-mx-1 gutter keeps the 3px focus ring off the scroll clip */}
            <div className="-mx-1 max-h-screen-60 overflow-y-auto px-1">
                {filteredChains.length > 0 ? (
                    <ListGroup role="listbox" aria-label={t('tokenSelector.selectANetwork')}>
                        {filteredChains.map((chain) => (
                            <NetworkListItem
                                key={chain.chainId}
                                name={chain.name}
                                iconUrl={chain.iconUrl}
                                isSelected={!chain.isComingSoon && chain.chainId === selectedChainID}
                                isComingSoon={chain.isComingSoon}
                                onClick={() => onSelectChain(chain.chainId)}
                            />
                        ))}
                    </ListGroup>
                ) : (
                    <EmptyState
                        icon="search"
                        title={t('tokenSelector.noNetworksFoundTitle', { search: searchValue })}
                        description={t('tokenSelector.noNetworksFoundDescription')}
                    />
                )}
            </div>
        </div>
    )
}

export default NetworkListView
