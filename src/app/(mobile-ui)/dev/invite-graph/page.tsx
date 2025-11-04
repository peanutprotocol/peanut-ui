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

    const graphRef = useRef<any>(null)

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

    // Filter graph data based on selected user
    const filteredGraphData = useMemo(() => {
        if (!graphData || !selectedUserId) return graphData

        const ancestors = getAncestors(selectedUserId)
        const descendants = getDescendants(selectedUserId)
        const treeUserIds = new Set([selectedUserId, ...ancestors, ...descendants])

        const filteredNodes = graphData.nodes.filter((node) => treeUserIds.has(node.id))
        const filteredEdges = graphData.edges.filter(
            (edge) => treeUserIds.has(edge.source) && treeUserIds.has(edge.target)
        )

        return {
            nodes: filteredNodes,
            edges: filteredEdges,
            stats: {
                totalNodes: filteredNodes.length,
                totalEdges: filteredEdges.length,
                usersWithAccess: filteredNodes.filter((n) => n.hasAppAccess).length,
                orphans: filteredNodes.filter((n) => !n.hasAppAccess).length,
            },
        }
    }, [graphData, selectedUserId, getAncestors, getDescendants])

    // Node styling
    const nodeCanvasObject = useCallback(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const isSelected = node.id === selectedUserId
            const hasAccess = node.hasAppAccess

            // Calculate node size based on points
            const baseSize = hasAccess ? 4 : 2.5
            const pointsMultiplier = Math.sqrt(node.totalPoints) / 30
            const size = baseSize + Math.min(pointsMultiplier, 8)

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
                ctx.font = `${fontSize}px Inter, system-ui, -apple-system, sans-serif`
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
        },
        [selectedUserId, showUsernames, showPoints]
    )

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
                                links: filteredGraphData.edges,
                            }}
                            nodeId="id"
                            nodeLabel={(node: any) =>
                                `<div style="background: white; padding: 10px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); font-family: Inter, system-ui, sans-serif;">
                                    <div style="font-weight: 600; margin-bottom: 6px; font-size: 14px;">${node.username}</div>
                                    <div style="font-size: 12px; color: #6b7280; line-height: 1.5;">
                                        ${node.hasAppAccess ? '<span style="color: #10b981;">✓ Has Access</span>' : '<span style="color: #ef4444;">⏳ No Access</span>'}<br/>
                                        <span style="color: #8b5cf6;">●</span> Total: ${node.totalPoints} pts<br/>
                                        <span style="opacity: 0.7;">Direct: ${node.directPoints} | Transitive: ${node.transitivePoints}</span>
                                    </div>
                                </div>`
                            }
                            nodeCanvasObject={nodeCanvasObject}
                            nodeCanvasObjectMode={() => 'replace'}
                            linkLabel={(link: any) => `${link.type} - ${new Date(link.createdAt).toLocaleDateString()}`}
                            linkColor={linkColor}
                            linkWidth={linkWidth}
                            linkDirectionalArrowLength={4}
                            linkDirectionalArrowRelPos={1}
                            linkDirectionalParticles={2}
                            linkDirectionalParticleWidth={1.5}
                            onNodeClick={handleNodeClick}
                            enableNodeDrag={true}
                            cooldownTicks={200}
                            d3VelocityDecay={0.4}
                            d3AlphaDecay={0.015}
                            d3AlphaMin={0.001}
                            warmupTicks={100}
                            linkDirectionalParticleSpeed={0.005}
                            backgroundColor="#f9fafb"
                            width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                            height={typeof window !== 'undefined' ? window.innerHeight - 65 : 800}
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
