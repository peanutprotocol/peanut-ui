'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/0_Bruddle/Button'
import { pointsApi } from '@/services/points'
import { Icon } from '@/components/Global/Icons/Icon'

// Dynamically import ForceGraph2D to avoid SSR issues
// Import only 2D component to avoid loading VR dependencies (aframe)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as any // Type assertion for dynamic import

interface GraphNode {
    id: string
    username: string
    hasAppAccess: boolean
    directPoints: number
    transitivePoints: number
    totalPoints: number
    x?: number // Added by force graph
    y?: number // Added by force graph
}

interface GraphEdge {
    id: string
    source: string
    target: string
    type: 'DIRECT' | 'PAYMENT_LINK'
    createdAt: string
}

interface GraphData {
    nodes: GraphNode[]
    edges: GraphEdge[]
    stats: {
        totalNodes: number
        totalEdges: number
        usersWithAccess: number
        orphans: number
    }
}

export default function InviteGraphPage() {
    const [graphData, setGraphData] = useState<GraphData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // UI state
    const [showUsernames, setShowUsernames] = useState(true)
    const [showPoints, setShowPoints] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [apiKey, setApiKey] = useState('')
    const [apiKeySubmitted, setApiKeySubmitted] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<GraphNode[]>([])

    const graphRef = useRef<any>(null)
    const forcesConfiguredRef = useRef(false)

    // Fetch graph data
    const fetchGraphData = useCallback(async (key: string) => {
        setLoading(true)
        setError(null)

        const result = await pointsApi.getInvitesGraph(key)

        if (result.success && result.data) {
            setGraphData(result.data)
        } else {
            setError('Failed to load invite graph. Check your API key.')
        }
        setLoading(false)
    }, [])

    // Handle API key submission
    const handleApiKeySubmit = useCallback(() => {
        if (!apiKey.trim()) {
            setError('Please enter an API key')
            return
        }
        setApiKeySubmitted(true)
        fetchGraphData(apiKey)
    }, [apiKey, fetchGraphData])

    // Build adjacency maps for tree filtering
    const { childrenMap, parentMap } = useMemo(() => {
        if (!graphData) return { childrenMap: new Map(), parentMap: new Map() }

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

    // Get ancestors of a user
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

    // Get descendants of a user
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

    // Set hierarchical positions: place invitees near their inviters
    const setHierarchicalPositions = useCallback((nodes: GraphNode[], edges: GraphEdge[]) => {
        // Build parent map for positioning
        const parentMap = new Map<string, string>()
        edges.forEach((edge) => {
            parentMap.set(edge.target, edge.source)
        })

        // Find roots (nodes with no parent)
        const roots = nodes.filter((node) => !parentMap.has(node.id))

        // Position roots in a circle (closer together)
        const positioned = new Map<string, { x: number; y: number }>()
        const rootRadius = 180 // Reduced from 300 for tighter clusters
        roots.forEach((root, i) => {
            const angle = (i / roots.length) * 2 * Math.PI
            positioned.set(root.id, {
                x: Math.cos(angle) * rootRadius,
                y: Math.sin(angle) * rootRadius,
            })
        })

        // BFS: position children near their parents
        const queue = [...roots.map((r) => r.id)]
        const visited = new Set(roots.map((r) => r.id))
        const childrenMap = new Map<string, string[]>()

        // Build children map
        edges.forEach((edge) => {
            if (!childrenMap.has(edge.source)) {
                childrenMap.set(edge.source, [])
            }
            childrenMap.get(edge.source)!.push(edge.target)
        })

        while (queue.length > 0) {
            const parentId = queue.shift()!
            const children = childrenMap.get(parentId) || []
            const parentPos = positioned.get(parentId)!

            // Position children in a circle around parent
            const childRadius = 80 + Math.random() * 20 // Add jitter to prevent overlap
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

        // Apply positions to nodes
        return nodes.map((node) => ({
            ...node,
            x: positioned.get(node.id)?.x,
            y: positioned.get(node.id)?.y,
        }))
    }, [])

    // Filter graph data based on selected user AND set hierarchical positions
    const filteredGraphData = useMemo(() => {
        if (!graphData || !selectedUserId) {
            // Set initial positions for full graph based on tree hierarchy
            if (graphData) {
                const nodesWithPositions = setHierarchicalPositions(graphData.nodes, graphData.edges)
                return { ...graphData, nodes: nodesWithPositions }
            }
            return graphData
        }

        const ancestors = getAncestors(selectedUserId)
        const descendants = getDescendants(selectedUserId)
        const treeUserIds = new Set([selectedUserId, ...ancestors, ...descendants])

        const filteredNodes = graphData.nodes.filter((node) => treeUserIds.has(node.id))
        const filteredEdges = graphData.edges.filter(
            (edge) => treeUserIds.has(edge.source) && treeUserIds.has(edge.target)
        )

        // Set hierarchical positions for filtered subgraph
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

    // Track display settings with ref to avoid re-renders
    const displaySettingsRef = useRef({ showUsernames, showPoints, selectedUserId })
    useEffect(() => {
        displaySettingsRef.current = { showUsernames, showPoints, selectedUserId }
    }, [showUsernames, showPoints, selectedUserId])

    // Node styling - memoized without dependencies to prevent zoom resets
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const { selectedUserId, showUsernames, showPoints } = displaySettingsRef.current
        const isSelected = node.id === selectedUserId
        const hasAccess = node.hasAppAccess

        // Calculate node size based on points (more aggressive scaling)
        const baseSize = hasAccess ? 6 : 3
        const pointsMultiplier = Math.sqrt(node.totalPoints) / 10 // More aggressive: was /30
        const size = baseSize + Math.min(pointsMultiplier, 25) // Higher cap: was 10

        // Node color
        const color = hasAccess ? (isSelected ? '#fbbf24' : '#8b5cf6') : '#9ca3af'

        // Draw node
        ctx.beginPath()
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
        ctx.fillStyle = color
        ctx.fill()

        // Selected node outline
        if (isSelected) {
            ctx.strokeStyle = '#f59e0b'
            ctx.lineWidth = 2
            ctx.stroke()
        }

        // Draw label if enabled and zoom is sufficient
        if (showUsernames && globalScale > 1.5) {
            const label = node.username
            const fontSize = 12 / globalScale
            ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillStyle = '#111827'
            ctx.fillText(label, node.x, node.y + size + fontSize + 2)
        }

        // Draw points if enabled
        if (showPoints && globalScale > 2) {
            const pointsText = `${node.totalPoints}pts`
            const fontSize = 10 / globalScale
            ctx.font = `${fontSize}px Inter, system-ui, -apple-system, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#6b7280'
            const offset = showUsernames ? 24 : 14
            ctx.fillText(pointsText, node.x, node.y + size + offset / globalScale)
        }
    }, [])

    // Link styling
    const linkColor = useCallback((link: any) => {
        return link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(236, 72, 153, 0.4)'
    }, [])

    const linkWidth = useCallback((link: any) => {
        return link.type === 'DIRECT' ? 1.5 : 1
    }, [])

    // Handle node click
    const handleNodeClick = useCallback((node: any) => {
        setSelectedUserId((prev) => (prev === node.id ? null : node.id))
    }, [])

    // Reset view
    const handleReset = useCallback(() => {
        setSelectedUserId(null)
        if (graphRef.current) {
            graphRef.current.zoomToFit(400)
        }
    }, [])

    // Handle close
    const handleClose = useCallback(() => {
        window.location.href = '/dev'
    }, [])

    // Handle search
    const handleSearch = useCallback(
        (query: string) => {
            setSearchQuery(query)

            if (!graphData || !query.trim()) {
                setSearchResults([])
                return
            }

            // Search for matching usernames (case-insensitive)
            const results = graphData.nodes.filter((node) => node.username.toLowerCase().includes(query.toLowerCase()))

            setSearchResults(results)

            // Auto-select if exactly one match
            if (results.length === 1) {
                setSelectedUserId(results[0].id)
            }
        },
        [graphData]
    )

    // Clear search
    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
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

    // Configure D3 forces immediately on graph mount
    const configureForces = useCallback(async () => {
        if (!graphRef.current) return

        const graph = graphRef.current

        // Only configure once, but do it immediately when graph is ready
        if (!forcesConfiguredRef.current) {
            // Moderate repulsion for balanced distribution
            graph.d3Force('charge')?.strength(-150)
            graph.d3Force('charge')?.distanceMax(300)

            // Tighter links since we start with good hierarchical positions
            graph.d3Force('link')?.distance(60)
            graph.d3Force('link')?.strength(0.7)

            // Add collision force to prevent overlap
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

            // Add centering force to keep graph compact
            graph.d3Force('center', d3.forceCenter())

            forcesConfiguredRef.current = true
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear graph ref to prevent memory leaks
            if (graphRef.current) {
                graphRef.current = null
            }
        }
    }, [])

    // API key input screen
    if (!apiKeySubmitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🕸️</div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Invite Graph</h2>
                        <p className="text-sm text-gray-600">Enter your admin API key to visualize the network</p>
                    </div>
                    {error && <div className="bg-red-50 text-red-800 rounded-lg p-3 text-sm">{error}</div>}
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
                        placeholder="Admin API Key"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <Button onClick={handleApiKeySubmit} className="w-full">
                        Enter Graph
                    </Button>
                    <button
                        onClick={() => (window.location.href = '/dev')}
                        className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                        ← Back to Dev Tools
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
            {/* Loading State */}
            {loading && (
                <div className="flex flex-1 items-center justify-center">
                    <div className="flex items-center gap-3">
                        <Icon name="pending" size={32} className="animate-spin text-purple-600" />
                        <span className="text-lg font-medium text-gray-700">Loading network...</span>
                    </div>
                </div>
            )}

            {/* Error State */}
            {error && !loading && (
                <div className="flex flex-1 items-center justify-center p-4">
                    <div className="bg-red-50 max-w-md rounded-2xl p-8 text-center shadow-lg">
                        <div className="mb-4 text-5xl">⚠️</div>
                        <p className="text-red-900 mb-4 text-lg font-medium">{error}</p>
                        <Button onClick={() => setApiKeySubmitted(false)} variant="stroke">
                            Try Again
                        </Button>
                    </div>
                </div>
            )}

            {/* Graph View */}
            {filteredGraphData && !loading && !error && (
                <>
                    {/* Top Control Bar */}
                    <div className="border-b border-gray-200 bg-white shadow-sm">
                        {/* Top Row: Navigation, Title, Stats, Controls */}
                        <div className="flex items-center justify-between px-4 py-3">
                            {/* Left: Title & Stats */}
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={handleClose}
                                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                                >
                                    <span>←</span>
                                    <span className="hidden sm:inline">Dev Tools</span>
                                </button>
                                <div className="h-6 w-px bg-gray-300"></div>
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
                                    {showUsernames ? '👤' : '👤'} Names
                                </Button>
                                <Button
                                    size="small"
                                    variant={showPoints ? 'purple' : 'stroke'}
                                    onClick={() => setShowPoints(!showPoints)}
                                    className="hidden sm:flex"
                                >
                                    {showPoints ? '🎯' : '🎯'} Points
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
                                // Reverse edges so particles flow invitee → inviter (leaves → roots)
                                links: filteredGraphData.edges.map((edge) => ({
                                    ...edge,
                                    source: edge.target,
                                    target: edge.source,
                                })),
                            }}
                            nodeId="id"
                            nodeLabel={(node: any) =>
                                // Clean, minimal tooltip on hover
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
                            width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                            height={typeof window !== 'undefined' ? window.innerHeight - 120 : 800}
                        />

                        {/* Legend - Bottom Left */}
                        <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm">
                            <h3 className="mb-3 text-sm font-bold text-gray-900">Legend</h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                                    <span className="text-gray-700">User with access</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                                    <span className="text-gray-700">Orphan (no access)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full border-2 border-yellow-500 bg-yellow-400"></div>
                                    <span className="text-gray-700">Selected user</span>
                                </div>
                                <div className="my-2 border-t border-gray-200"></div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-semibold text-gray-700">Invite Types:</div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-0.5 w-6 bg-purple-500/40"></div>
                                        <span className="text-gray-700">Direct invite</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-0.5 w-6 bg-pink-500/40"></div>
                                        <span className="text-gray-700">Payment link</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Controls - Bottom Right */}
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2 sm:hidden">
                            <button
                                onClick={() => setShowUsernames(!showUsernames)}
                                className={`rounded-full p-3 shadow-lg transition-colors ${
                                    showUsernames ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
                                }`}
                            >
                                👤
                            </button>
                            <button
                                onClick={() => setShowPoints(!showPoints)}
                                className={`rounded-full p-3 shadow-lg transition-colors ${
                                    showPoints ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
                                }`}
                            >
                                🎯
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
