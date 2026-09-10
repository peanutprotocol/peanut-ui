'use client'

import { useTranslations } from 'next-intl'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { type ExternalNode, type ExternalNodesConfig, type GraphData, type GraphMode, type GraphNode } from './types'

interface GraphTopBarProps {
    onClose?: () => void
    mode: GraphMode
    combinedGraphNodes: any[]
    externalNodesConfig: ExternalNodesConfig
    filteredGraphData: GraphData
    externalLinks: any[]
    searchQuery: string
    searchResults: GraphNode[]
    selectedUserId: string | null
    setSelectedUserId: (id: string | null) => void
    filteredExternalNodes: ExternalNode[]
    handleSearch: (query: string) => void
    handleClearSearch: () => void
    handleResetView: () => void
}

/** Full-mode top control bar: title, node/edge stats, search, and the selected-node banner */
export function GraphTopBar({
    onClose,
    mode,
    combinedGraphNodes,
    externalNodesConfig,
    filteredGraphData,
    externalLinks,
    searchQuery,
    searchResults,
    selectedUserId,
    setSelectedUserId,
    filteredExternalNodes,
    handleSearch,
    handleClearSearch,
    handleResetView,
}: GraphTopBarProps) {
    const t = useTranslations('global')
    return (
        <div className="border-b bg-white shadow-sm">
            {/* Top Row: Navigation, Title, Stats, Controls */}
            <div className="flex items-center justify-between px-4 py-3">
                {/* Left: Title & Stats */}
                <div className="flex items-center gap-4">
                    {onClose && (
                        <>
                            <button
                                onClick={onClose}
                                className="flex items-center gap-2 rounded-lg px-3 py-2 text-body-s transition-colors"
                            >
                                <span>←</span>
                                <span className="hidden sm:inline">{t('invitesGraph.back')}</span>
                            </button>
                            <div className="h-6 w-px"></div>
                        </>
                    )}
                    <h1 className="text-heading-card">
                        {mode === 'payment' ? t('invitesGraph.paymentNetwork') : t('invitesGraph.inviteNetwork')}
                    </h1>
                    <div className="flex gap-3 text-body-xs font-medium">
                        <span className="rounded-full px-2 py-1">
                            {t('invitesGraph.nodes', { count: combinedGraphNodes.length })}
                            {externalNodesConfig.enabled &&
                                combinedGraphNodes.filter((n: any) => n.isExternal).length > 0 && (
                                    <span className="ml-1">
                                        (+{combinedGraphNodes.filter((n: any) => n.isExternal).length} ext)
                                    </span>
                                )}
                        </span>
                        <span className="rounded-full bg-blue-200 px-2 py-1 text-blue-600">
                            {/* In payment mode, show P2P edges; in other modes, show invite edges */}
                            {t('invitesGraph.edges', {
                                count:
                                    (mode === 'payment'
                                        ? filteredGraphData.stats.totalP2PEdges
                                        : filteredGraphData.stats.totalEdges) + externalLinks.length,
                            })}
                            {externalNodesConfig.enabled && externalLinks.length > 0 && (
                                <span className="ml-1">(+{externalLinks.length} ext)</span>
                            )}
                        </span>
                    </div>
                </div>

                {/* Right side - empty, controls are in sidebar overlay */}
            </div>

            {/* Second Row: Search (hidden in payment mode - no usernames) */}
            {mode !== 'payment' && (
                <div className="border-t px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder={t('invitesGraph.searchPlaceholder')}
                                className="/20 w-full rounded-lg border py-1.5 pr-9 pl-9 text-body-s transition-colors focus:ring-2 focus:outline-none"
                            />
                            <Icon
                                name="search"
                                size={16}
                                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    aria-label={t('tokenSelector.clearSearch')}
                                    onClick={handleClearSearch}
                                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 transition-opacity duration-instant after:absolute after:-inset-3 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60"
                                >
                                    <Icon name="cancel" size={14} />
                                </button>
                            )}
                        </div>
                        {searchResults.length > 0 && (
                            <span className="text-body-xs">
                                {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                            </span>
                        )}
                    </div>
                    {/* Search Results Dropdown */}
                    {searchQuery && searchResults.length > 1 && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg">
                            {searchResults.map((node: any) => (
                                <button
                                    key={node.id}
                                    onClick={() => {
                                        setSelectedUserId(node.id)
                                        handleClearSearch()
                                    }}
                                    className={`flex w-full items-center justify-between px-3 py-2 text-body-s transition-colors ${
                                        node.isExternal ? 'hover:bg-orange-200/40' : 'hover:bg-purple-200/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {node.isExternal && (
                                            <span className="text-body-xs">
                                                {node.externalType === 'WALLET'
                                                    ? '💳'
                                                    : node.externalType === 'BANK'
                                                      ? '🏦'
                                                      : '🏪'}
                                            </span>
                                        )}
                                        <span className="font-medium">{node.displayName}</span>
                                    </div>
                                    <span className="text-body-xs">
                                        {node.isExternal
                                            ? node.totalUsd
                                                ? `${node.uniqueUsers} users, $${node.totalUsd.toFixed(0)}`
                                                : `${node.size || node.volume || 'N/A'}`
                                            : node.totalPoints
                                              ? `${node.totalPoints.toLocaleString()} pts`
                                              : node.size || 'N/A'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Selected User/Node Banner */}
            {selectedUserId && (
                <div
                    className={`border-t px-4 py-2 text-body-s ${selectedUserId.startsWith('ext_') ? 'border-orange-200 bg-orange-200/40' : 'border-purple-200 bg-purple-200/40'}`}
                >
                    <span className={selectedUserId.startsWith('ext_') ? 'text-orange-800' : 'text-purple-600'}>
                        {t('invitesGraph.focusedOn')}{' '}
                        <span className="font-bold">
                            {selectedUserId.startsWith('ext_')
                                ? filteredExternalNodes.find((n) => `ext_${n.id}` === selectedUserId)?.label ||
                                  selectedUserId.replace('ext_', '')
                                : filteredGraphData.nodes.find((n) => n.id === selectedUserId)?.username ||
                                  selectedUserId}
                        </span>
                    </span>
                    <LinkButton onClick={handleResetView} className="ml-2">
                        {t('invitesGraph.clear')}
                    </LinkButton>
                </div>
            )}
        </div>
    )
}
