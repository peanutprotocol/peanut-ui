'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import DesktopGuard from './DesktopGuard'
import ExplorerHeader from './ExplorerHeader'
import ExplorerStatePanel from './ExplorerStatePanel'
import ExplorerSummary from './ExplorerSummary'
import FilterPanel from './FilterPanel'
import FocusBanner from './FocusBanner'
import Inspector from './Inspector'
import NetworkCanvas from './NetworkCanvas'
import { suppressPaymentNetworkTelemetry } from './privacy'
import {
    defaultExplorerFilters,
    filterRelationships,
    findNodeByUsername,
    scrubLegacyGraphPassword,
    toRelationships,
} from './query'
import RelationshipTable from './RelationshipTable'
import type { ExplorerNode, ExplorerRelationship, ExplorerSelection } from './types'
import { useDesktopViewport } from './useDesktopViewport'
import { useExplorerUrlState } from './useExplorerUrlState'
import { usePaymentNetworkExplorer } from './usePaymentNetworkExplorer'

export default function PaymentNetworkExplorer() {
    // This runs during render, before sensitive DOM commits or feature effects start.
    suppressPaymentNetworkTelemetry()
    const legacyScrubbed = useRef(false)
    const [legacyChecked, setLegacyChecked] = useState(false)
    const [selection, setSelection] = useState<ExplorerSelection>(null)
    const [searchError, setSearchError] = useState<string | null>(null)
    const { ready: viewportReady, isDesktop } = useDesktopViewport()
    const { filters, setFilters } = useExplorerUrlState()

    useEffect(() => {
        if (legacyScrubbed.current) return
        legacyScrubbed.current = true
        scrubLegacyGraphPassword(window.location, window.history)
        setLegacyChecked(true)
    }, [])

    const request = viewportReady && isDesktop && legacyChecked ? { topNodes: filters.topNodes } : null
    const explorer = usePaymentNetworkExplorer(request)
    const data = explorer.data

    const allRelationships = useMemo(() => (data ? toRelationships(data.p2pEdges) : []), [data])
    const relationships = useMemo(
        () => filterRelationships(allRelationships, filters),
        // The filter fields are primitives/arrays from nuqs; key on their serialization.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [allRelationships, filters.types.join(','), filters.direction, filters.minCount, filters.minUsd]
    )

    // Plain ?user=<username> deep-link, resolved client-side once data arrives.
    const focusedNode = useMemo(
        () => (data && filters.focus ? findNodeByUsername(data.nodes, filters.focus) : null),
        [data, filters.focus]
    )

    useEffect(() => {
        if (!data) {
            setSelection(null)
            return
        }
        setSelection((current) => {
            if (current?.type === 'node') {
                const node = data.nodes.find((item) => item.id === current.node.id)
                if (node) return { type: 'node', node }
            }
            if (current?.type === 'relationship') {
                const relationship = allRelationships.find((item) => item.id === current.relationship.id)
                if (relationship) return { type: 'relationship', relationship }
            }
            return focusedNode ? { type: 'node', node: focusedNode } : null
        })
    }, [data, allRelationships, focusedNode])

    const changeFilters = (patch: Parameters<typeof setFilters>[0]) => {
        setSearchError(null)
        void setFilters(patch)
    }

    const resetFilters = () => {
        setSearchError(null)
        setSelection(null)
        // Reset clears filters, not the graph/table choice the user is reading in.
        void setFilters({ ...defaultExplorerFilters(), view: filters.view })
    }

    const search = async (username: string): Promise<boolean> => {
        setSearchError(null)
        if (!data) {
            setSearchError('The graph is not loaded yet.')
            return false
        }
        if (!findNodeByUsername(data.nodes, username)) {
            setSearchError('No matching user in the loaded graph.')
            return false
        }
        await setFilters({ focus: username.trim() })
        return true
    }

    const selectNode = (node: ExplorerNode) => setSelection({ type: 'node', node })
    const selectRelationship = (relationship: ExplorerRelationship) =>
        setSelection({ type: 'relationship', relationship })

    if (viewportReady && !isDesktop) {
        return (
            <main
                className="ph-no-capture fixed inset-0 z-50 bg-[#f7f4ef] text-n-1"
                data-private="true"
                data-sentry-mask
            >
                <DesktopGuard />
            </main>
        )
    }

    const selectedRelationshipId = selection?.type === 'relationship' ? selection.relationship.id : null
    const selectedCanonical = selection?.type === 'node' ? selection.node : (selection?.relationship ?? null)

    return (
        <main className="ph-no-capture fixed inset-0 z-50 bg-[#f7f4ef] text-n-1" data-private="true" data-sentry-mask>
            {!viewportReady ? (
                <ExplorerStatePanel
                    title="Preparing explorer"
                    detail="Checking this viewport before loading live data."
                    busy
                />
            ) : (
                <section className="flex h-full min-w-[1024px] flex-col">
                    <ExplorerHeader
                        view={filters.view}
                        searching={explorer.status === 'loading'}
                        searchError={searchError}
                        onViewChange={(view) => changeFilters({ view })}
                        onSearch={search}
                    />
                    {data && (
                        <ExplorerSummary
                            data={data}
                            visibleRelationshipCount={relationships.length}
                            topNodes={filters.topNodes}
                        />
                    )}
                    {filters.focus && (
                        <FocusBanner
                            username={filters.focus}
                            node={focusedNode}
                            loaded={explorer.status === 'ready'}
                            onClear={() => changeFilters({ focus: null })}
                        />
                    )}
                    <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_320px]">
                        <FilterPanel
                            filters={filters}
                            relationships={allRelationships}
                            onChange={changeFilters}
                            onReset={resetFilters}
                        />
                        <div className="min-h-0 min-w-0">
                            {explorer.status === 'loading' || explorer.status === 'idle' ? (
                                <ExplorerStatePanel
                                    title="Loading live network"
                                    detail="Data is read directly from the canonical API and is not stored by this tool."
                                    busy
                                />
                            ) : explorer.status === 'forbidden' ? (
                                <ExplorerStatePanel
                                    title="Team access required"
                                    detail="Your signed-in account does not have access to this explorer."
                                />
                            ) : explorer.status === 'error' ? (
                                <ExplorerStatePanel
                                    title="Live network unavailable"
                                    detail={explorer.error?.message ?? 'Try again.'}
                                    onRetry={explorer.reload}
                                />
                            ) : !data || data.nodes.length === 0 ? (
                                <ExplorerStatePanel
                                    title="No network found"
                                    detail="No users are in the loaded graph."
                                />
                            ) : filters.view === 'graph' ? (
                                <NetworkCanvas
                                    nodes={data.nodes}
                                    allRelationships={allRelationships}
                                    relationships={relationships}
                                    selected={selectedCanonical}
                                    focusNodeId={focusedNode?.id ?? null}
                                    onSelectNode={selectNode}
                                    onSelectRelationship={selectRelationship}
                                />
                            ) : (
                                <RelationshipTable
                                    nodes={data.nodes}
                                    relationships={relationships}
                                    selectedId={selectedRelationshipId}
                                    onSelect={selectRelationship}
                                />
                            )}
                        </div>
                        <Inspector
                            selection={selection}
                            nodes={data?.nodes ?? []}
                            relationships={relationships}
                            onSelectRelationship={selectRelationship}
                            onClear={() => setSelection(null)}
                        />
                    </div>
                </section>
            )}
        </main>
    )
}
