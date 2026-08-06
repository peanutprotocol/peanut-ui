'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { PaymentNetworkApiError } from './api'
import DesktopGuard from './DesktopGuard'
import ExplorerHeader from './ExplorerHeader'
import ExplorerStatePanel from './ExplorerStatePanel'
import ExplorerSummary from './ExplorerSummary'
import FilterPanel from './FilterPanel'
import FocusBanner from './FocusBanner'
import Inspector from './Inspector'
import NetworkCanvas from './NetworkCanvas'
import { suppressPaymentNetworkTelemetry } from './privacy'
import { buildExplorerRequest, consumeLegacyGraphUsername, defaultExplorerFilters, ExplorerWindowError } from './query'
import RelationshipTable from './RelationshipTable'
import type {
    ExplorerFilters,
    ExplorerNode,
    ExplorerRelationship,
    ExplorerSelection,
    RevealReason,
    RevealResponse,
} from './types'
import { useDesktopViewport } from './useDesktopViewport'
import { useExplorerUrlState } from './useExplorerUrlState'
import { usePaymentNetworkExplorer } from './usePaymentNetworkExplorer'

export default function PaymentNetworkExplorer() {
    // This runs during render, before sensitive DOM commits or feature effects start.
    suppressPaymentNetworkTelemetry()
    const [legacyUsername] = useState(() =>
        typeof window === 'undefined' ? null : consumeLegacyGraphUsername(window.location, window.history)
    )
    const [legacyFocusPending, setLegacyFocusPending] = useState(Boolean(legacyUsername))
    const legacyFocusStarted = useRef(false)
    const [selection, setSelection] = useState<ExplorerSelection>(null)
    const [revealed, setRevealed] = useState<RevealResponse | null>(null)
    const [searchError, setSearchError] = useState<string | null>(null)
    const { ready: viewportReady, isDesktop } = useDesktopViewport()
    const { filters, setFilters } = useExplorerUrlState()
    const {
        range,
        customFrom,
        customTo,
        providers,
        methods,
        rails,
        kinds,
        assets,
        chains,
        states,
        directions,
        infrastructure,
        focus,
    } = filters

    const requestFilterKey = JSON.stringify({
        view: 'graph',
        range,
        customFrom,
        customTo,
        providers,
        methods,
        rails,
        kinds,
        assets,
        chains,
        states,
        directions,
        infrastructure,
        focus,
    } satisfies ExplorerFilters)

    const requestResult = useMemo(() => {
        const requestFilters = JSON.parse(requestFilterKey) as ExplorerFilters
        try {
            return { request: buildExplorerRequest(requestFilters), error: null }
        } catch (error) {
            return {
                request: null,
                error: error instanceof ExplorerWindowError ? error.message : 'The selected time window is invalid.',
            }
        }
    }, [requestFilterKey])

    const request =
        viewportReady && isDesktop && !legacyFocusPending && !requestResult.error ? requestResult.request : null
    const explorer = usePaymentNetworkExplorer(request)

    useEffect(() => {
        if (!viewportReady || !isDesktop || !legacyUsername || !legacyFocusPending || legacyFocusStarted.current) return
        legacyFocusStarted.current = true
        void explorer
            .focusUsername(legacyUsername)
            .then(async (result) => {
                await setFilters({ focus: result.focusToken })
                setLegacyFocusPending(false)
            })
            .catch((error) => {
                setSearchError(safeSearchError(error))
                setLegacyFocusPending(false)
            })
    }, [explorer, isDesktop, legacyFocusPending, legacyUsername, setFilters, viewportReady])

    useEffect(() => {
        if (!explorer.data) {
            setSelection(null)
            setRevealed(null)
            return
        }
        setRevealed(null)
        setSelection((current) => {
            if (current?.type === 'node') {
                const node = explorer.data?.nodes.find((item) => item.id === current.node.id)
                if (node) return { type: 'node', node }
            }
            if (current?.type === 'relationship') {
                const relationship = explorer.data?.relationships.find((item) => item.id === current.relationship.id)
                if (relationship) return { type: 'relationship', relationship }
            }
            const focused = explorer.data?.meta.focus
                ? explorer.data.nodes.find((node) => node.id === explorer.data?.meta.focus?.nodeId)
                : null
            return focused ? { type: 'node', node: focused } : null
        })
    }, [explorer.data])

    useEffect(() => {
        if (!revealed) return
        const remaining = Math.max(0, new Date(revealed.expiresAt).getTime() - Date.now())
        const timer = window.setTimeout(() => setRevealed(null), remaining)
        return () => window.clearTimeout(timer)
    }, [revealed])

    useEffect(() => {
        const clearExpiredReveal = () => {
            setRevealed((current) => (current && new Date(current.expiresAt).getTime() <= Date.now() ? null : current))
        }
        const clearRevealForPageHide = () => {
            flushSync(() => setRevealed(null))
        }
        const handlePageShow = (event: PageTransitionEvent) => {
            clearExpiredReveal()
            if (event.persisted) window.location.reload()
        }
        document.addEventListener('visibilitychange', clearExpiredReveal)
        window.addEventListener('pagehide', clearRevealForPageHide)
        window.addEventListener('pageshow', handlePageShow)
        return () => {
            document.removeEventListener('visibilitychange', clearExpiredReveal)
            window.removeEventListener('pagehide', clearRevealForPageHide)
            window.removeEventListener('pageshow', handlePageShow)
        }
    }, [])

    const changeFilters = (patch: Partial<ExplorerFilters>) => {
        setSearchError(null)
        void setFilters(patch)
    }

    const resetFilters = () => {
        setSearchError(null)
        setSelection(null)
        setRevealed(null)
        void setFilters(defaultExplorerFilters())
    }

    const search = async (username: string) => {
        setSearchError(null)
        try {
            const result = await explorer.focusUsername(username)
            await setFilters({ focus: result.focusToken })
        } catch (error) {
            setSearchError(safeSearchError(error))
        }
    }

    const reveal = async (node: ExplorerNode, reason: RevealReason) => {
        if (!node.revealToken) return
        const result = await explorer.revealNode(node.revealToken, reason)
        setRevealed(result)
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

    const data = explorer.data
    const focusedNode = data?.meta.focus
        ? (data.nodes.find((node) => node.id === data.meta.focus?.nodeId) ?? null)
        : null
    const selectedRelationshipId = selection?.type === 'relationship' ? selection.relationship.id : null
    const selectedCanonical = selection?.type === 'node' ? selection.node : (selection?.relationship ?? null)
    const activeReveal = revealed && new Date(revealed.expiresAt).getTime() > Date.now() ? revealed : null

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
                        searching={explorer.searching || legacyFocusPending}
                        searchError={searchError}
                        onViewChange={(view) => changeFilters({ view })}
                        onSearch={search}
                    />
                    {data && <ExplorerSummary data={data} />}
                    {data?.meta.focus && (
                        <FocusBanner
                            focus={data.meta.focus}
                            node={focusedNode}
                            onClear={() => changeFilters({ focus: null })}
                        />
                    )}
                    <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_320px]">
                        <FilterPanel
                            filters={filters}
                            facets={data?.facets ?? null}
                            onChange={changeFilters}
                            onReset={resetFilters}
                        />
                        <div className="min-h-0 min-w-0">
                            {requestResult.error ? (
                                <ExplorerStatePanel title="Check the time window" detail={requestResult.error} />
                            ) : legacyFocusPending || explorer.status === 'loading' || explorer.status === 'idle' ? (
                                <ExplorerStatePanel
                                    title={legacyFocusPending ? 'Opening signed focus' : 'Loading live network'}
                                    detail="Data is read directly from the canonical API and is not stored by this tool."
                                    busy
                                />
                            ) : explorer.status === 'forbidden' ? (
                                <ExplorerStatePanel
                                    title="Team access required"
                                    detail="Your signed-in account does not have the explorer role."
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
                                    detail="No movements match these filters."
                                />
                            ) : filters.view === 'graph' ? (
                                <NetworkCanvas
                                    nodes={data.nodes}
                                    relationships={data.relationships}
                                    selected={selectedCanonical}
                                    focusNodeId={data.meta.focus?.nodeId ?? null}
                                    onSelectNode={selectNode}
                                    onSelectRelationship={selectRelationship}
                                />
                            ) : (
                                <RelationshipTable
                                    nodes={data.nodes}
                                    relationships={data.relationships}
                                    selectedId={selectedRelationshipId}
                                    onSelect={selectRelationship}
                                />
                            )}
                        </div>
                        <Inspector
                            selection={selection}
                            nodes={data?.nodes ?? []}
                            relationships={data?.relationships ?? []}
                            canReveal={explorer.session?.canReveal ?? false}
                            revealing={explorer.revealing}
                            revealed={activeReveal}
                            onReveal={reveal}
                            onSelectRelationship={selectRelationship}
                            onClear={() => setSelection(null)}
                        />
                    </div>
                </section>
            )}
        </main>
    )
}

function safeSearchError(error: unknown): string {
    return error instanceof PaymentNetworkApiError ? error.message : 'Search is unavailable. Try again.'
}
