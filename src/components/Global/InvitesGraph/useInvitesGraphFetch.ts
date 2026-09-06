import { useEffect, useRef } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { pointsApi } from '@/services/points'
import {
    type ExternalNode,
    type ExternalNodesConfig,
    type GraphData,
    type GraphDisplaySettings,
    type GraphMode,
    type InvitesGraphProps,
} from './types'

interface UseInvitesGraphFetchParams {
    props: InvitesGraphProps
    mode: GraphMode
    topNodes: number
    displaySettingsRef: MutableRefObject<GraphDisplaySettings>
    setLoading: Dispatch<SetStateAction<boolean>>
    setError: Dispatch<SetStateAction<string | null>>
    setFetchedGraphData: Dispatch<SetStateAction<GraphData | null>>
    externalNodesConfig: ExternalNodesConfig
    externalNodesFetchedLimitRef: MutableRefObject<number | null>
    setExternalNodesData: Dispatch<SetStateAction<ExternalNode[]>>
    setExternalNodesLoading: Dispatch<SetStateAction<boolean>>
    setExternalNodesError: Dispatch<SetStateAction<string | null>>
}

/**
 * Backend fetch effects: the invites graph itself (debounced on topNodes changes)
 * and the lazily-loaded external nodes (wallets, banks, merchants).
 */
export function useInvitesGraphFetch({
    props,
    mode,
    topNodes,
    displaySettingsRef,
    setLoading,
    setError,
    setFetchedGraphData,
    externalNodesConfig,
    externalNodesFetchedLimitRef,
    setExternalNodesData,
    setExternalNodesLoading,
    setExternalNodesError,
}: UseInvitesGraphFetchParams) {
    // Derived from props (not passed in) so TS aliased-condition narrowing keeps
    // `props` narrowed to FullModeProps inside the effects after `if (isMinimal) return`
    const isMinimal = props.minimal === true

    // Fetch graph data on mount and when topNodes changes (only in full mode)
    // Note: topNodes filtering only applies to full mode (payment mode has fixed 5000 limit in backend)
    // topNodes is debounced so the slider doesn't trigger a refetch on every tick
    const topNodesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isInitialFetchRef = useRef(true)
    useEffect(() => {
        if (isMinimal) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)

            // API only supports 'full' | 'payment' modes (user mode uses different endpoint)
            const apiMode = mode === 'payment' ? 'payment' : 'full'
            // Pass topNodes for both modes - payment mode now supports it via Performance button
            // Pass includeNewDays so backend always includes recent signups regardless of topNodes
            const result = await pointsApi.getInvitesGraph(props.apiKey, {
                mode: apiMode,
                topNodes: topNodes > 0 ? topNodes : undefined,
                includeNewDays: displaySettingsRef.current.activityFilter.activityDays,
            })

            if (result.success && result.data) {
                setFetchedGraphData(result.data)
            } else {
                setError(result.error || 'Failed to load invite graph.')
            }
            setLoading(false)
        }

        // First fetch is immediate, subsequent topNodes changes are debounced (500ms)
        if (isInitialFetchRef.current) {
            isInitialFetchRef.current = false
            fetchData()
        } else {
            if (topNodesDebounceRef.current) clearTimeout(topNodesDebounceRef.current)
            topNodesDebounceRef.current = setTimeout(fetchData, 500)
        }

        return () => {
            if (topNodesDebounceRef.current) clearTimeout(topNodesDebounceRef.current)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMinimal, !isMinimal && props.apiKey, mode, topNodes])

    // Fetch external nodes when enabled (lazy load on first enable)
    // Refetch if limit changes (but not on simple toggle off/on)
    useEffect(() => {
        if (isMinimal) return
        if (!externalNodesConfig.enabled) return
        // Skip if already fetched with same or higher limit (no need to refetch for same data)
        const lastLimit = externalNodesFetchedLimitRef.current
        if (lastLimit !== null && lastLimit >= externalNodesConfig.limit) return

        const fetchExternalNodes = async () => {
            setExternalNodesLoading(true)
            setExternalNodesError(null)

            try {
                // API only supports 'full' | 'payment' modes
                const apiMode = mode === 'payment' ? 'payment' : 'full'
                // Fetch ALL types so user can toggle client-side without refetch
                // Backend defaults to MERCHANT only in payment mode, so we must explicitly request all
                const result = await pointsApi.getExternalNodes(props.apiKey, {
                    mode: apiMode,
                    minConnections: 1, // Fetch all, filter client-side for flexibility
                    limit: externalNodesConfig.limit, // User-configurable limit
                    types: ['WALLET', 'BANK', 'MERCHANT'], // Fetch all types, filter client-side
                    topNodes: topNodes > 0 ? topNodes : undefined, // Match graph's top-N filter
                })

                if (result.success && result.data) {
                    // Debug logging for external nodes
                    setExternalNodesData(result.data.nodes)
                    externalNodesFetchedLimitRef.current = externalNodesConfig.limit
                } else {
                    const errorMsg = result.error || 'Unknown error'
                    setExternalNodesError(errorMsg)
                    console.error('Failed to fetch external nodes:', errorMsg)
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : 'Network error'
                setExternalNodesError(errorMsg)
                console.error('External nodes fetch error:', err)
            } finally {
                setExternalNodesLoading(false)
            }
        }

        fetchExternalNodes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMinimal, !isMinimal && props.apiKey, externalNodesConfig.enabled, mode, externalNodesConfig.limit])
}
