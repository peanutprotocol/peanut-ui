import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Dispatch, SetStateAction } from 'react'
import { openExternalUrl } from '@/utils/capacitor'
import { profileUrl } from '@/utils/native-routes'
import {
    type ActivityFilter,
    type ExternalNode,
    type ExternalNodesConfig,
    type ForceConfig,
    type GraphData,
    type GraphNode,
    type VisibilityConfig,
    DEFAULT_ACTIVITY_FILTER,
    DEFAULT_EXTERNAL_NODES_CONFIG,
    DEFAULT_FORCE_CONFIG,
    DEFAULT_VISIBILITY_CONFIG,
} from './types'
import { CLICK_MAX_DISTANCE_PX, CLICK_MAX_DURATION_MS } from './utils'

interface UseInvitesGraphInteractionsParams {
    isMinimal: boolean
    graphRef: React.MutableRefObject<any>
    filteredGraphData: GraphData | null
    initialFocusUsername?: string
    rawGraphData: GraphData | null
    filteredExternalNodes: ExternalNode[]
    externalNodesConfig: ExternalNodesConfig
    setActivityFilter: Dispatch<SetStateAction<ActivityFilter>>
    setForceConfig: Dispatch<SetStateAction<ForceConfig>>
    setVisibilityConfig: Dispatch<SetStateAction<VisibilityConfig>>
    setExternalNodesConfig: Dispatch<SetStateAction<ExternalNodesConfig>>
}

/**
 * Owns user interaction state and handlers: node selection (click/right-click,
 * drag-vs-click detection), search, reset actions, container width measurement,
 * and the initialFocusUsername deep-link resolution.
 */
export function useInvitesGraphInteractions({
    isMinimal,
    graphRef,
    filteredGraphData,
    initialFocusUsername,
    rawGraphData,
    filteredExternalNodes,
    externalNodesConfig,
    setActivityFilter,
    setForceConfig,
    setVisibilityConfig,
    setExternalNodesConfig,
}: UseInvitesGraphInteractionsParams) {
    const router = useRouter()

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GraphNode[]>([])

    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState<number | null>(null)

    // Drag vs click detection
    const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const isDraggingRef = useRef(false)

    // Measure container width for minimal mode
    useEffect(() => {
        if (!isMinimal || !containerRef.current) return

        const measureWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth)
            }
        }

        measureWidth()
        window.addEventListener('resize', measureWidth)
        return () => window.removeEventListener('resize', measureWidth)
    }, [isMinimal])

    // Clear selection if selected node is filtered out
    useEffect(() => {
        if (selectedUserId && filteredGraphData) {
            const nodeExists = filteredGraphData.nodes.some((n) => n.id === selectedUserId)
            if (!nodeExists) {
                setSelectedUserId(null)
            }
        }
    }, [selectedUserId, filteredGraphData])

    // Deep-link focus: resolve `initialFocusUsername` to a node.id once after the
    // graph data first loads. Used by Discord live-log links like
    // /dev/payment-graph?user=alice. Ref-guarded so re-renders don't pull the
    // camera back if the user has since clicked away.
    const initialFocusAppliedRef = useRef(false)
    useEffect(() => {
        if (initialFocusAppliedRef.current) return
        if (!initialFocusUsername || !filteredGraphData) return
        // Only attempt resolution once nodes are populated. An empty filtered
        // set (loading races, visibility filter momentarily excluding all)
        // should NOT trip the ref-lock — wait for real data.
        if (filteredGraphData.nodes.length === 0) return
        const needle = initialFocusUsername.toLowerCase()
        const match = filteredGraphData.nodes.find((n) => n.username?.toLowerCase() === needle)
        if (match) {
            setSelectedUserId(match.id)
        }
        // Lock regardless of match — username not in data (filtered out,
        // top-N cap, deleted user) is a definitive "no result" once nodes
        // are populated. Avoids spinning.
        initialFocusAppliedRef.current = true
    }, [initialFocusUsername, filteredGraphData])

    // Handle drag start to track for click vs drag detection
    const handleNodeDragStart = useCallback((node: any, _translate: any) => {
        dragStartRef.current = { x: node.x, y: node.y, time: Date.now() }
        isDraggingRef.current = false
    }, [])

    // Handle drag to detect actual dragging
    const handleNodeDrag = useCallback((node: any) => {
        if (!dragStartRef.current) return
        const dx = node.x - dragStartRef.current.x
        const dy = node.y - dragStartRef.current.y
        const distance = Math.sqrt(dx * dx + dy * dy)
        if (distance > CLICK_MAX_DISTANCE_PX) {
            isDraggingRef.current = true
        }
    }, [])

    // Handle drag end
    const handleNodeDragEnd = useCallback(() => {
        // Small delay to let the click handler check the drag state
        setTimeout(() => {
            dragStartRef.current = null
            isDraggingRef.current = false
        }, 50)
    }, [])

    // Click opens appropriate URL for node type
    const handleNodeClick = useCallback(
        (node: any) => {
            // Skip click if we were dragging
            if (isDraggingRef.current) {
                return
            }
            // Also check time-based threshold
            if (dragStartRef.current && Date.now() - dragStartRef.current.time > CLICK_MAX_DURATION_MS) {
                return
            }

            // Handle external node clicks
            if (node.isExternal) {
                const externalId = node.id.replace('ext_', '')

                if (node.externalType === 'WALLET') {
                    // Wallet → Arbiscan
                    openExternalUrl(`https://arbiscan.io/address/${externalId}`).catch((e) =>
                        console.warn('failed to open explorer link:', e)
                    )
                } else if (node.externalType === 'MERCHANT') {
                    // Merchant → Google search
                    openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(node.label)}`).catch((e) =>
                        console.warn('failed to open search link:', e)
                    )
                }
                // BANK → Do nothing (no useful URL for IBAN/CLABE/ACH)
                return
            }

            // User node → profile. window.open('/<user>','_blank') was dead on
            // iOS (no popup support) and a full app reset on Android.
            if (isMinimal && node.username) {
                router.push(profileUrl(node.username))
                return
            }

            // Full/Payment mode: User node → Select (camera follows)
            setSelectedUserId(node.id)
        },
        [isMinimal, router]
    )

    // Right-click selects the node (camera follows)
    const handleNodeRightClick = useCallback((node: any) => {
        setSelectedUserId((prev) => (prev === node.id ? null : node.id))
    }, [])

    const handleResetView = useCallback(() => {
        // Just reset selection and camera
        setSelectedUserId(null)
        graphRef.current?.zoomToFit(400)
    }, [])

    const handleReset = useCallback(() => {
        // Reset selection
        setSelectedUserId(null)
        // Reset all configs to defaults
        setActivityFilter(DEFAULT_ACTIVITY_FILTER)
        setForceConfig(DEFAULT_FORCE_CONFIG)
        setVisibilityConfig(DEFAULT_VISIBILITY_CONFIG)
        setExternalNodesConfig(DEFAULT_EXTERNAL_NODES_CONFIG)
        // Reset camera
        graphRef.current?.zoomToFit(400)
    }, [])

    // Debounced search to prevent UI freezing
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const handleSearch = useCallback(
        (query: string) => {
            setSearchQuery(query)

            // Clear any pending search
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }

            if (!rawGraphData || !query.trim()) {
                setSearchResults([])
                return
            }

            // Debounce the actual search by 150ms
            searchTimeoutRef.current = setTimeout(() => {
                const lowerQuery = query.toLowerCase()
                const results: any[] = []

                // Search user nodes
                if (rawGraphData) {
                    const userResults = rawGraphData.nodes.filter(
                        (node) => node.username && node.username.toLowerCase().includes(lowerQuery)
                    )
                    results.push(...userResults.map((n) => ({ ...n, isExternal: false, displayName: n.username })))
                }

                // Search external nodes (by label and ID)
                if (externalNodesConfig.enabled && filteredExternalNodes.length > 0) {
                    const externalResults = filteredExternalNodes.filter(
                        (node) =>
                            node.label.toLowerCase().includes(lowerQuery) || node.id.toLowerCase().includes(lowerQuery)
                    )
                    results.push(
                        ...externalResults.map((n) => ({
                            id: `ext_${n.id}`,
                            isExternal: true,
                            displayName: n.label,
                            externalType: n.type,
                            uniqueUsers: n.uniqueUsers,
                            totalUsd: n.totalUsd,
                        }))
                    )
                }

                setSearchResults(results)

                if (results.length === 1) {
                    setSelectedUserId(results[0].id)
                }
            }, 150)
        },
        [rawGraphData, filteredExternalNodes, externalNodesConfig.enabled]
    )

    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
    }, [])

    return {
        selectedUserId,
        setSelectedUserId,
        searchQuery,
        searchResults,
        containerRef,
        containerWidth,
        searchTimeoutRef,
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragEnd,
        handleNodeClick,
        handleNodeRightClick,
        handleResetView,
        handleReset,
        handleSearch,
        handleClearSearch,
    }
}
