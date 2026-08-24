'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type Ref } from 'react'
import type { ForceGraphMethods, ForceGraphProps } from 'react-force-graph-2d'
import InfoTooltip from './InfoTooltip'
import {
    buildGraphLinkProjections,
    buildGraphNodeProjections,
    edgeTypesPresent,
    EDGE_TYPE_LABELS,
    rankDenseGraphOverview,
    type GraphLinkProjection,
    type Reciprocity,
    type GraphNodeProjection,
} from './selectors'
import type { ExplorerNode, ExplorerRelationship, P2PEdgeType } from './types'
import { useReducedMotion } from './useReducedMotion'

type PaymentForceGraphProps = ForceGraphProps<GraphNodeProjection, GraphLinkProjection> & {
    ref?: Ref<ForceGraphMethods<GraphNodeProjection, GraphLinkProjection>>
}

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false,
}) as unknown as ComponentType<PaymentForceGraphProps>

const TYPE_COLOR: Record<P2PEdgeType, string> = {
    SEND_LINK: '#1f6f50',
    REQUEST_PAYMENT: '#7c57c2',
    DIRECT_TRANSFER: '#c17a00',
}

const NODE_COLOR = '#ffde59'
const NODE_COLOR_NO_ACCESS = '#e5ddd0'

const DENSE_LINK_LIMITS = [320, 1600, Number.POSITIVE_INFINITY] as const

interface NetworkCanvasProps {
    nodes: readonly ExplorerNode[]
    /** Everything the response carried — the simulation's fixed input. */
    allRelationships: readonly ExplorerRelationship[]
    /** What the current filters keep — drives visibility, legend and ranking. */
    relationships: readonly ExplorerRelationship[]
    reciprocity: ReadonlyMap<string, Reciprocity>
    selected: ExplorerNode | ExplorerRelationship | null
    focusNodeId: string | null
    onSelectNode: (node: ExplorerNode) => void
    onSelectRelationship: (relationship: ExplorerRelationship) => void
}

export default function NetworkCanvas({
    nodes,
    allRelationships,
    relationships,
    reciprocity,
    selected,
    focusNodeId,
    onSelectNode,
    onSelectRelationship,
}: NetworkCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const [graphInstance, setGraphInstance] = useState<ForceGraphMethods<
        GraphNodeProjection,
        GraphLinkProjection
    > | null>(null)
    const appliedFocusRef = useRef<{
        graph: ForceGraphMethods<GraphNodeProjection, GraphLinkProjection>
        nodeId: string
    } | null>(null)
    const [focusCameraApplied, setFocusCameraApplied] = useState(false)
    const reducedMotion = useReducedMotion()
    const [size, setSize] = useState({ width: 800, height: 600 })
    // Node wrappers are keyed on the node set alone: rebuilding them on a filter
    // change would drop the x/y d3 stores on them and restart the whole layout.
    const nodeProjections = useMemo(() => buildGraphNodeProjections(nodes), [nodes])
    // graphData is keyed on the response, never on the filters: force-graph re-runs
    // its synchronous warmup on every graphData identity change (40 ticks over 5k
    // nodes is ~1s of blocked main thread). Filters hide links via linkVisibility.
    const projection = useMemo(
        () => ({ nodes: nodeProjections, links: buildGraphLinkProjections(allRelationships) }),
        [nodeProjections, allRelationships]
    )
    const filteredRelationshipIds = useMemo(
        () => new Set(relationships.map((relationship) => relationship.id)),
        [relationships]
    )
    const [denseView, setDenseView] = useState<{ projection: typeof projection; level: 0 | 1 | 2 }>(() => ({
        projection,
        level: 0,
    }))
    const denseDetailLevel = denseView.projection === projection ? denseView.level : 0
    const [settledProjection, setSettledProjection] = useState<typeof projection | null>(null)
    const denseGraph = nodes.length >= 1000
    const layoutReady = settledProjection === projection
    const denseRanking = useMemo(
        () => (denseGraph ? rankDenseGraphOverview(nodes, relationships) : null),
        [denseGraph, nodes, relationships]
    )
    const selectedNodeId = selected && 'username' in selected ? selected.id : null
    const selectedRelationshipId = selected && 'source' in selected ? selected.id : null
    const visibleRelationshipIds = useMemo(() => {
        if (!denseRanking) return null
        const limit = DENSE_LINK_LIMITS[denseDetailLevel]
        const visible = new Set(denseRanking.relationshipIds.slice(0, limit))
        for (const relationship of relationships) {
            if (
                relationship.id === selectedRelationshipId ||
                relationship.source === selectedNodeId ||
                relationship.target === selectedNodeId ||
                relationship.source === focusNodeId ||
                relationship.target === focusNodeId
            ) {
                visible.add(relationship.id)
            }
        }
        return visible
    }, [denseDetailLevel, denseRanking, focusNodeId, relationships, selectedNodeId, selectedRelationshipId])
    const overviewLabelNodeIds = useMemo(() => new Set(denseRanking?.labelNodeIds ?? []), [denseRanking])
    const presentTypes = useMemo(() => edgeTypesPresent(relationships), [relationships])

    const handleZoom = useCallback(
        ({ k }: { k: number }) => {
            const nextLevel = k >= 4 ? 2 : k >= 1.8 ? 1 : 0
            setDenseView((current) =>
                current.projection === projection && current.level === nextLevel
                    ? current
                    : { projection, level: nextLevel }
            )
        },
        [projection]
    )

    useEffect(() => {
        const element = containerRef.current
        if (!element) return
        const update = () => setSize({ width: element.clientWidth, height: element.clientHeight })
        update()
        const observer = new ResizeObserver(update)
        observer.observe(element)
        return () => observer.disconnect()
    }, [])

    const applyFocusedCamera = useCallback(() => {
        if (!focusNodeId || !graphInstance) return
        const alreadyApplied =
            appliedFocusRef.current?.graph === graphInstance && appliedFocusRef.current.nodeId === focusNodeId
        if (alreadyApplied) return
        const node = projection.nodes.find((item) => item.id === focusNodeId)
        if (!node || typeof node.x !== 'number' || typeof node.y !== 'number') return
        graphInstance.centerAt(node.x, node.y, reducedMotion ? 0 : 500)
        graphInstance.zoom(3.2, reducedMotion ? 0 : 500)
        appliedFocusRef.current = { graph: graphInstance, nodeId: focusNodeId }
        setFocusCameraApplied(true)
    }, [focusNodeId, graphInstance, projection.nodes, reducedMotion])

    const handleEngineStop = useCallback(() => {
        applyFocusedCamera()
        setSettledProjection(projection)
    }, [applyFocusedCamera, projection])

    useEffect(() => {
        appliedFocusRef.current = null
        setFocusCameraApplied(false)
        applyFocusedCamera()
    }, [applyFocusedCamera])

    const paintNode = (node: GraphNodeProjection, ctx: CanvasRenderingContext2D, scale: number) => {
        const points = Math.max(0, node.canonical.totalPoints)
        const radius = denseGraph
            ? Math.min(3.2, 1.1 + Math.log2(points + 1) * 0.12)
            : Math.min(13, 3.5 + Math.log2(points + 1) * 0.45)
        const isSelected = node.id === selectedNodeId || node.id === focusNodeId
        ctx.beginPath()
        ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2)
        ctx.fillStyle = node.canonical.hasAppAccess ? NODE_COLOR : NODE_COLOR_NO_ACCESS
        ctx.fill()
        ctx.lineWidth = isSelected ? 2.5 / scale : 1 / scale
        ctx.strokeStyle = '#171717'
        ctx.stroke()

        const showOverviewLabel = denseGraph && denseDetailLevel === 0 && overviewLabelNodeIds.has(node.id)
        const label = node.canonical.username
        if (label && ((isSelected && scale > 0.7) || showOverviewLabel)) {
            const fontSize = 11 / scale
            ctx.font = `700 ${fontSize}px Inter, system-ui, sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            const labelWidth = ctx.measureText(label).width
            const labelY = (node.y ?? 0) + radius + 3 / scale
            ctx.fillStyle = 'rgba(247, 244, 239, 0.9)'
            ctx.fillRect(
                (node.x ?? 0) - labelWidth / 2 - 2 / scale,
                labelY - 1 / scale,
                labelWidth + 4 / scale,
                fontSize + 3 / scale
            )
            ctx.fillStyle = '#171717'
            ctx.fillText(label, node.x ?? 0, labelY)
        }
    }

    const paintPointerArea = (node: GraphNodeProjection, color: string, ctx: CanvasRenderingContext2D) => {
        const radius = denseGraph
            ? 4
            : Math.min(15, 5.5 + Math.log2(Math.max(0, node.canonical.totalPoints) + 1) * 0.45)
        ctx.beginPath()
        ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
    }

    return (
        <section
            ref={containerRef}
            className="relative h-full min-h-0 overflow-hidden bg-[#f7f4ef]"
            aria-label="Payment network graph"
            data-focus-camera-applied={focusNodeId ? String(focusCameraApplied) : undefined}
            data-reduced-motion={String(reducedMotion)}
            data-graph-layout-ready={String(layoutReady)}
        >
            <p className="sr-only">Use the relationship table for keyboard navigation and exact connection details.</p>
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2 text-[10px] font-semibold">
                {presentTypes.map((type) => (
                    <span
                        key={type}
                        className="inline-flex items-center gap-1 rounded-full border border-n-1 bg-white px-2 py-1"
                    >
                        <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: TYPE_COLOR[type] }}
                            aria-hidden="true"
                        />
                        {EDGE_TYPE_LABELS[type]}
                    </span>
                ))}
            </div>
            {denseGraph && visibleRelationshipIds ? (
                <div className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-n-1 bg-white px-2 py-1 text-[10px] font-semibold">
                    <span>Overview · {visibleRelationshipIds.size.toLocaleString()} links</span>
                    <InfoTooltip label="dense graph overview">
                        The overview emphasizes the strongest connections. Zoom in or select a node to reveal more; all{' '}
                        {relationships.length.toLocaleString()} relationships remain available in the table.
                    </InfoTooltip>
                </div>
            ) : null}
            <ForceGraph2D
                ref={setGraphInstance}
                width={size.width}
                height={size.height}
                graphData={projection}
                nodeId="id"
                linkSource="source"
                linkTarget="target"
                backgroundColor="#f7f4ef"
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={paintPointerArea}
                linkVisibility={(link: GraphLinkProjection) =>
                    filteredRelationshipIds.has(link.canonicalRelationshipId) &&
                    (visibleRelationshipIds?.has(link.canonicalRelationshipId) ?? true)
                }
                linkColor={(link: GraphLinkProjection) =>
                    link.canonicalRelationshipId === selectedRelationshipId ||
                    link.canonical.source === selectedNodeId ||
                    link.canonical.target === selectedNodeId ||
                    link.canonical.source === focusNodeId ||
                    link.canonical.target === focusNodeId
                        ? TYPE_COLOR[link.canonical.type]
                        : denseGraph
                          ? `${TYPE_COLOR[link.canonical.type]}70`
                          : TYPE_COLOR[link.canonical.type]
                }
                linkWidth={(link: GraphLinkProjection) =>
                    link.canonicalRelationshipId === selectedRelationshipId
                        ? 3
                        : denseGraph
                          ? Math.min(0.55, 0.12 + Math.log2(link.canonical.count + 1) * 0.05)
                          : Math.min(2.4, 0.6 + Math.log2(link.canonical.count + 1) * 0.22)
                }
                linkDirectionalArrowLength={(link: GraphLinkProjection) =>
                    // Only a same-type reverse edge makes this link's arrow redundant.
                    denseGraph || reciprocity.get(link.canonicalRelationshipId) === 'sameType' ? 0 : 3
                }
                linkDirectionalArrowRelPos={0.86}
                onNodeClick={(node: GraphNodeProjection) => onSelectNode(node.canonical)}
                onLinkClick={(link: GraphLinkProjection) => onSelectRelationship(link.canonical)}
                onZoom={denseGraph ? handleZoom : undefined}
                onEngineTick={focusNodeId ? applyFocusedCamera : undefined}
                onEngineStop={handleEngineStop}
                warmupTicks={denseGraph ? 40 : reducedMotion ? 20 : 0}
                cooldownTicks={denseGraph || reducedMotion ? 0 : 80}
                d3AlphaDecay={0.04}
                d3VelocityDecay={0.35}
                enableNodeDrag
                autoPauseRedraw
            />
        </section>
    )
}
