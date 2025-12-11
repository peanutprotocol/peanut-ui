'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { pointsApi } from '@/services/points'

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as any

// Types
export interface GraphNode {
    id: string
    username: string
    hasAppAccess: boolean
    directPoints: number
    transitivePoints: number
    totalPoints: number
    x?: number
    y?: number
}

export interface GraphEdge {
    id: string
    source: string
    target: string
    type: 'DIRECT' | 'PAYMENT_LINK'
    createdAt: string
}

export interface GraphData {
    nodes: GraphNode[]
    edges: GraphEdge[]
    stats: {
        totalNodes: number
        totalEdges: number
        usersWithAccess: number
        orphans: number
    }
}

interface BaseProps {
    width?: number
    height?: number
    backgroundColor?: string
    /** Show usernames on nodes */
    showUsernames?: boolean
    /** Show points on nodes */
    showPoints?: boolean
    /** Render prop for additional overlays */
    renderOverlays?: (props: {
        showUsernames: boolean
        setShowUsernames: (v: boolean) => void
        showPoints: boolean
        setShowPoints: (v: boolean) => void
    }) => React.ReactNode
}

interface FullModeProps extends BaseProps {
    /** Admin API key to fetch full graph */
    apiKey: string
    /** Close/back button handler */
    onClose?: () => void
    /** Minimal mode disabled */
    minimal?: false
    data?: never
}

interface MinimalModeProps extends BaseProps {
    /** Graph data passed directly */
    data: GraphData
    /** Minimal mode - just the graph canvas, no controls */
    minimal: true
    apiKey?: never
    onClose?: never
}

type InvitesGraphProps = FullModeProps | MinimalModeProps

// Hook for tree filtering logic
function useGraphFiltering(graphData: GraphData | null, selectedUserId: string | null) {
    const { childrenMap, parentMap } = useMemo(() => {
        if (!graphData) return { childrenMap: new Map<string, Set<string>>(), parentMap: new Map<string, string>() }

        const children = new Map<string, Set<string>>()
        const parent = new Map<string, string>()

        graphData.edges.forEach((edge) => {
            if (!children.has(edge.source)) {
                children.set(edge.source, new Set())
            }
            children.get(edge.source)!.add(edge.target)
            parent.set(edge.target, edge.source)
        })

        return { childrenMap: children, parentMap: parent }
    }, [graphData])

    const getAncestors = useCallback(
        (userId: string): Set<string> => {
            const ancestors = new Set<string>()
            let current = userId

            while (parentMap.has(current)) {
                const parent = parentMap.get(current)!
                ancestors.add(parent)
                current = parent
            }

            return ancestors
        },
        [parentMap]
    )

    const getDescendants = useCallback(
        (userId: string): Set<string> => {
            const descendants = new Set<string>()
            const queue = [userId]

            while (queue.length > 0) {
                const current = queue.shift()!
                const children = childrenMap.get(current)

                if (children) {
                    children.forEach((child: string) => {
                        descendants.add(child)
                        queue.push(child)
                    })
                }
            }

            return descendants
        },
        [childrenMap]
    )

    const setHierarchicalPositions = useCallback((nodes: GraphNode[], edges: GraphEdge[]) => {
        const edgeParentMap = new Map<string, string>()
        edges.forEach((edge) => {
            edgeParentMap.set(edge.target, edge.source)
        })

        const roots = nodes.filter((node) => !edgeParentMap.has(node.id))
        const positioned = new Map<string, { x: number; y: number }>()
        const rootRadius = 180

        roots.forEach((root, i) => {
            const angle = (i / roots.length) * 2 * Math.PI
            positioned.set(root.id, {
                x: Math.cos(angle) * rootRadius,
                y: Math.sin(angle) * rootRadius,
            })
        })

        const queue = [...roots.map((r) => r.id)]
        const visited = new Set(roots.map((r) => r.id))
        const edgeChildrenMap = new Map<string, string[]>()

        edges.forEach((edge) => {
            if (!edgeChildrenMap.has(edge.source)) {
                edgeChildrenMap.set(edge.source, [])
            }
            edgeChildrenMap.get(edge.source)!.push(edge.target)
        })

        while (queue.length > 0) {
            const parentId = queue.shift()!
            const children = edgeChildrenMap.get(parentId) || []
            const parentPos = positioned.get(parentId)!

            const childRadius = 80 + Math.random() * 20
            children.forEach((childId, i) => {
                if (!visited.has(childId)) {
                    const angle = (i / children.length) * 2 * Math.PI
                    positioned.set(childId, {
                        x: parentPos.x + Math.cos(angle) * childRadius,
                        y: parentPos.y + Math.sin(angle) * childRadius,
                    })
                    visited.add(childId)
                    queue.push(childId)
                }
            })
        }

        return nodes.map((node) => ({
            ...node,
            x: positioned.get(node.id)?.x,
            y: positioned.get(node.id)?.y,
        }))
    }, [])

    const filteredGraphData = useMemo(() => {
        if (!graphData) return null

        if (!selectedUserId) {
            const nodesWithPositions = setHierarchicalPositions(graphData.nodes, graphData.edges)
            return { ...graphData, nodes: nodesWithPositions }
        }

        const ancestors = getAncestors(selectedUserId)
        const descendants = getDescendants(selectedUserId)
        const treeUserIds = new Set([selectedUserId, ...ancestors, ...descendants])

        const filteredNodes = graphData.nodes.filter((node) => treeUserIds.has(node.id))
        const filteredEdges = graphData.edges.filter(
            (edge) => treeUserIds.has(edge.source) && treeUserIds.has(edge.target)
        )

        const nodesWithPositions = setHierarchicalPositions(filteredNodes, filteredEdges)

        return {
            nodes: nodesWithPositions,
            edges: filteredEdges,
            stats: {
                totalNodes: filteredNodes.length,
                totalEdges: filteredEdges.length,
                usersWithAccess: filteredNodes.filter((n) => n.hasAppAccess).length,
                orphans: filteredNodes.filter((n) => !n.hasAppAccess).length,
            },
        }
    }, [graphData, selectedUserId, getAncestors, getDescendants, setHierarchicalPositions])

    return filteredGraphData
}

export default function InvitesGraph(props: InvitesGraphProps) {
    const {
        width,
        height,
        backgroundColor = '#f9fafb',
        showUsernames: initialShowUsernames = true,
        showPoints: initialShowPoints = false,
        renderOverlays,
    } = props

    const isMinimal = props.minimal === true

    // Data state
    const [fetchedGraphData, setFetchedGraphData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(!isMinimal)
    const [error, setError] = useState<string | null>(null)

    // Use passed data in minimal mode, fetched data otherwise
    const graphData = isMinimal ? props.data : fetchedGraphData

    // UI state
    const [showUsernames, setShowUsernames] = useState(initialShowUsernames)
    const [showPoints, setShowPoints] = useState(initialShowPoints)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GraphNode[]>([])

    const graphRef = useRef<any>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const forcesConfiguredRef = useRef(false)
    const [containerWidth, setContainerWidth] = useState<number | null>(null)

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

    const filteredGraphData = useGraphFiltering(graphData, selectedUserId)

    // Fetch graph data on mount (only in full mode)
    useEffect(() => {
        if (isMinimal) return

        const fetchData = async () => {
            setLoading(true)
            setError(null)

            const result = await pointsApi.getInvitesGraph(props.apiKey)

            if (result.success && result.data) {
                setFetchedGraphData(result.data)
            } else {
                setError(result.error || 'Failed to load invite graph.')
            }
            setLoading(false)
        }

        fetchData()
    }, [isMinimal, props.apiKey])

    // Track display settings with ref to avoid re-renders
    const displaySettingsRef = useRef({ showUsernames, showPoints, selectedUserId, isMinimal })
    useEffect(() => {
        displaySettingsRef.current = { showUsernames, showPoints, selectedUserId, isMinimal }
    }, [showUsernames, showPoints, selectedUserId, isMinimal])

    // Node styling
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const {
            selectedUserId: selId,
            showUsernames: showNames,
            showPoints: showPts,
            isMinimal: minimal,
        } = displaySettingsRef.current
        const isSelected = node.id === selId
        const hasAccess = node.hasAppAccess

        const baseSize = hasAccess ? 6 : 3
        const pointsMultiplier = Math.sqrt(node.totalPoints) / 10
        const size = baseSize + Math.min(pointsMultiplier, 25)

        const color = hasAccess ? (isSelected ? '#fbbf24' : '#8b5cf6') : '#9ca3af'

        ctx.beginPath()
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()

        if (isSelected) {
            ctx.strokeStyle = '#f59e0b'
            ctx.lineWidth = 2
            ctx.stroke()
        }

        // In minimal mode, always show labels; otherwise require zoom
        if (showNames && (minimal || globalScale > 1.5)) {
            const label = node.username
            const fontSize = minimal ? 4 : 12 / globalScale
            ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#111827'
            ctx.fillText(label, node.x, node.y + size + fontSize + 2)
        }

        if (showPts && (minimal || globalScale > 2)) {
            const pointsText = `${node.totalPoints}pts`
            const fontSize = minimal ? 3 : 10 / globalScale
            ctx.font = `${fontSize}px Inter, system-ui, -apple-system, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#6b7280'
            const offset = showNames ? 10 : 6
            ctx.fillText(pointsText, node.x, node.y + size + (minimal ? offset : offset / globalScale))
        }
    }, [])

    const linkColor = useCallback((link: any) => {
        return link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)'
    }, [])

    const linkWidth = useCallback((link: any) => {
        return link.type === 'DIRECT' ? 1.5 : 1
    }, [])

    const handleNodeClick = useCallback((node: any) => {
        setSelectedUserId((prev) => (prev === node.id ? null : node.id))
    }, [])

    const handleReset = useCallback(() => {
        setSelectedUserId(null)
        graphRef.current?.zoomToFit(400)
    }, [])

    const handleSearch = useCallback(
        (query: string) => {
            setSearchQuery(query)

            if (!graphData || !query.trim()) {
                setSearchResults([])
                return
            }

            const results = graphData.nodes.filter((node) => node.username.toLowerCase().includes(query.toLowerCase()))

            setSearchResults(results)

            if (results.length === 1) {
                setSelectedUserId(results[0].id)
            }
        },
        [graphData]
    )

    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
    }, [])

    // Configure D3 forces
    const configureForces = useCallback(async () => {
        if (!graphRef.current || forcesConfiguredRef.current) return

        const graph = graphRef.current

        graph.d3Force('charge')?.strength(-150)
        graph.d3Force('charge')?.distanceMax(300)
        graph.d3Force('link')?.distance(60)
        graph.d3Force('link')?.strength(0.7)

        const d3 = await import('d3-force')
        graph.d3Force(
            'collide',
            d3
                .forceCollide((node: any) => {
                    const hasAccess = node.hasAppAccess
                    const baseSize = hasAccess ? 6 : 3
                    const pointsMultiplier = Math.sqrt(node.totalPoints) / 10
                    return baseSize + Math.min(pointsMultiplier, 25) + 15
                })
                .strength(0.9)
        )

        graph.d3Force('center', d3.forceCenter())
        forcesConfiguredRef.current = true
    }, [])

    // Center on selected node
    useEffect(() => {
        if (selectedUserId && graphRef.current && filteredGraphData) {
            const node = filteredGraphData.nodes.find((n) => n.id === selectedUserId)
            if (node && node.x !== undefined && node.y !== undefined) {
                graphRef.current.centerAt(node.x, node.y, 1000)
                graphRef.current.zoom(3, 1000)
            }
        }
    }, [selectedUserId, filteredGraphData])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (graphRef.current) {
                graphRef.current = null
            }
        }
    }, [])

    // Loading state (only for full mode)
    if (!isMinimal && loading) {
        return (
            <div className="flex flex-1 items-center justify-center">
                <div className="flex items-center gap-3">
                    <Icon name="pending" size={32} className="animate-spin text-purple-600" />
                    <span className="text-lg font-medium text-gray-700">Loading network...</span>
                </div>
            </div>
        )
    }

    // Error state (only for full mode)
    if (!isMinimal && error) {
        return (
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="bg-red-50 max-w-md rounded-2xl p-8 text-center shadow-lg">
                    <div className="mb-4 text-5xl">⚠️</div>
                    <p className="text-red-900 mb-4 text-lg font-medium">{error}</p>
                    {props.onClose && (
                        <Button onClick={props.onClose} variant="stroke">
                            Go Back
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    if (!filteredGraphData) return null

    const graphWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const graphHeight = height ?? (typeof window !== 'undefined' ? window.innerHeight - 120 : 800)

    // Minimal mode - just the graph canvas
    if (isMinimal) {
        const minimalWidth = containerWidth ?? width ?? 350
        return (
            <div ref={containerRef} className="relative w-full" style={{ height: graphHeight }}>
                {containerWidth !== null && (
                    <ForceGraph2D
                        ref={graphRef}
                        graphData={{
                            nodes: filteredGraphData.nodes,
                            links: filteredGraphData.edges.map((edge) => ({
                                ...edge,
                                source: edge.target,
                                target: edge.source,
                            })),
                        }}
                        nodeId="id"
                        nodeCanvasObject={nodeCanvasObject}
                        nodeCanvasObjectMode={() => 'replace'}
                        linkColor={linkColor}
                        linkWidth={linkWidth}
                        linkDirectionalArrowLength={3}
                        linkDirectionalArrowRelPos={1}
                        linkDirectionalParticles={2}
                        linkDirectionalParticleWidth={1.5}
                        linkDirectionalParticleSpeed={0.0012}
                        linkDirectionalArrowColor={(link: any) =>
                            link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.6)' : 'rgba(236, 72, 153, 0.6)'
                        }
                        linkDirectionalParticleColor={(link: any) =>
                            link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.8)' : 'rgba(236, 72, 153, 0.8)'
                        }
                        onNodeClick={handleNodeClick}
                        enableNodeDrag={true}
                        cooldownTicks={100}
                        warmupTicks={20}
                        d3VelocityDecay={0.5}
                        d3AlphaDecay={0.03}
                        onEngineStop={configureForces}
                        backgroundColor={backgroundColor}
                        width={minimalWidth}
                        height={graphHeight}
                    />
                )}
                {renderOverlays?.({ showUsernames, setShowUsernames, showPoints, setShowPoints })}
            </div>
        )
    }

    // Full mode with controls
    return (
        <>
            {/* Top Control Bar */}
            <div className="border-b border-gray-200 bg-white shadow-sm">
                {/* Top Row: Navigation, Title, Stats, Controls */}
                <div className="flex items-center justify-between px-4 py-3">
                    {/* Left: Title & Stats */}
                    <div className="flex items-center gap-4">
                        {props.onClose && (
                            <>
                                <button
                                    onClick={props.onClose}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                >
                                    <span>←</span>
                                    <span className="hidden sm:inline">Back</span>
                                </button>
                                <div className="h-6 w-px bg-gray-300"></div>
                            </>
                        )}
                        <h1 className="text-lg font-bold text-gray-900">Invite Network</h1>
                        <div className="flex gap-3 text-xs font-medium">
                            <span className="rounded-full bg-purple-100 px-2 py-1 text-purple-700">
                                {filteredGraphData.stats.totalNodes} nodes
                            </span>
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-700">
                                {filteredGraphData.stats.totalEdges} edges
                            </span>
                        </div>
                    </div>

                    {/* Right: Controls */}
                    <div className="flex items-center gap-2">
                        <Button
                            size="small"
                            variant={showUsernames ? 'purple' : 'stroke'}
                            onClick={() => setShowUsernames(!showUsernames)}
                            className="hidden sm:flex"
                        >
                            👤 Names
                        </Button>
                        <Button
                            size="small"
                            variant={showPoints ? 'purple' : 'stroke'}
                            onClick={() => setShowPoints(!showPoints)}
                            className="hidden sm:flex"
                        >
                            🎯 Points
                        </Button>
                        {selectedUserId && (
                            <Button size="small" variant="stroke" onClick={handleReset}>
                                ↺ Reset
                            </Button>
                        )}
                    </div>
                </div>

                {/* Second Row: Search */}
                <div className="border-t border-gray-100 px-4 py-2">
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                placeholder="Search username..."
                                className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-9 text-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                            />
                            <Icon
                                name="search"
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            {searchQuery && (
                                <button
                                    onClick={handleClearSearch}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <Icon name="cancel" size={14} />
                                </button>
                            )}
                        </div>
                        {searchResults.length > 0 && (
                            <span className="text-xs text-gray-600">
                                {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                            </span>
                        )}
                    </div>
                    {/* Search Results Dropdown */}
                    {searchQuery && searchResults.length > 1 && (
                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                            {searchResults.map((node) => (
                                <button
                                    key={node.id}
                                    onClick={() => {
                                        setSelectedUserId(node.id)
                                        handleClearSearch()
                                    }}
                                    className="flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-purple-50"
                                >
                                    <span className="font-medium text-gray-900">{node.username}</span>
                                    <span className="text-xs text-gray-500">
                                        {node.totalPoints.toLocaleString()} pts
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Selected User Banner */}
                {selectedUserId && (
                    <div className="border-t border-purple-100 bg-purple-50 px-4 py-2 text-sm">
                        <span className="text-purple-700">
                            Filtering:{' '}
                            <span className="font-bold">
                                {filteredGraphData.nodes.find((n) => n.id === selectedUserId)?.username ||
                                    selectedUserId}
                            </span>
                        </span>
                        <button onClick={handleReset} className="ml-2 font-semibold text-purple-900 underline">
                            Clear
                        </button>
                    </div>
                )}
            </div>

            {/* Graph Canvas */}
            <div className="relative flex-1">
                <ForceGraph2D
                    ref={graphRef}
                    graphData={{
                        nodes: filteredGraphData.nodes,
                        links: filteredGraphData.edges.map((edge) => ({
                            ...edge,
                            source: edge.target,
                            target: edge.source,
                        })),
                    }}
                    nodeId="id"
                    nodeLabel={(node: any) =>
                        `<div style="background: rgba(255, 255, 255, 0.98); border-radius: 8px; border: 1px solid rgba(139, 92, 246, 0.15); font-family: Inter, system-ui, sans-serif; max-width: 220px; padding: 10px 14px;">
                            <div style="font-weight: 700; margin-bottom: 6px; font-size: 14px; color: #1f2937;">${node.username}</div>
                            <div style="font-size: 12px; line-height: 1.5;">
                                ${node.hasAppAccess ? '<div style="color: #10b981; margin-bottom: 4px; font-weight: 600;">✓ Has Access</div>' : '<div style="color: #f59e0b; margin-bottom: 4px; font-weight: 600;">⏳ No Access</div>'}
                                <div style="color: #6b7280; margin-bottom: 3px;">
                                    <span style="color: #8b5cf6; font-weight: 600;">Total:</span> ${node.totalPoints.toLocaleString()} pts
                                </div>
                                <div style="color: #9ca3af; font-size: 11px; display: flex; gap: 10px;">
                                    <span>Direct: ${node.directPoints}</span>
                                    <span>Trans: ${node.transitivePoints}</span>
                                </div>
                            </div>
                        </div>`
                    }
                    nodeCanvasObject={nodeCanvasObject}
                    nodeCanvasObjectMode={() => 'replace'}
                    linkLabel={(link: any) => `${link.type} - ${new Date(link.createdAt).toLocaleDateString()}`}
                    linkColor={linkColor}
                    linkWidth={linkWidth}
                    linkDirectionalArrowLength={3}
                    linkDirectionalArrowRelPos={1}
                    linkDirectionalParticles={2}
                    linkDirectionalParticleWidth={1.5}
                    linkDirectionalParticleSpeed={0.0012}
                    linkDirectionalArrowColor={(link: any) =>
                        link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.6)' : 'rgba(236, 72, 153, 0.6)'
                    }
                    linkDirectionalParticleColor={(link: any) =>
                        link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.8)' : 'rgba(236, 72, 153, 0.8)'
                    }
                    onNodeClick={handleNodeClick}
                    enableNodeDrag={true}
                    cooldownTicks={100}
                    warmupTicks={20}
                    d3VelocityDecay={0.5}
                    d3AlphaDecay={0.03}
                    onEngineStop={configureForces}
                    backgroundColor="#f9fafb"
                    width={graphWidth}
                    height={graphHeight}
                />

                {/* Render overlays (legend, mobile controls) via render prop */}
                {renderOverlays?.({ showUsernames, setShowUsernames, showPoints, setShowPoints })}
            </div>
        </>
    )
}
