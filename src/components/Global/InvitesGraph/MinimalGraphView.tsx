'use client'

import { useTranslations } from 'next-intl'
import type { MutableRefObject, ReactNode, RefObject } from 'react'
import { ForceGraph2D } from './ForceGraph2D'
import { type GraphData, type GraphMode, type GraphOverlayProps } from './types'

interface MinimalGraphViewProps {
    containerRef: RefObject<HTMLDivElement>
    graphRef: MutableRefObject<any>
    filteredGraphData: GraphData
    graphHeight: number
    containerWidth: number | null
    width?: number
    backgroundColor: string
    mode: GraphMode
    isMinimal: boolean
    selectedUserId: string | null
    nodeCanvasObject: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
    linkCanvasObject: (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
    handleNodeClick: (node: any) => void
    handleNodeRightClick: (node: any) => void
    handleNodeDragStart: (node: any, translate: any) => void
    handleNodeDrag: (node: any) => void
    handleNodeDragEnd: () => void
    handleEngineStop: () => void
    handleResetView: () => void
    renderOverlays?: (props: GraphOverlayProps) => ReactNode
    overlayProps: GraphOverlayProps
}

/** Minimal mode - just the graph canvas, no controls (points page / user graph) */
export function MinimalGraphView({
    containerRef,
    graphRef,
    filteredGraphData,
    graphHeight,
    containerWidth,
    width,
    backgroundColor,
    mode,
    isMinimal,
    selectedUserId,
    nodeCanvasObject,
    linkCanvasObject,
    handleNodeClick,
    handleNodeRightClick,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragEnd,
    handleEngineStop,
    handleResetView,
    renderOverlays,
    overlayProps,
}: MinimalGraphViewProps) {
    const t = useTranslations('global')
    const minimalWidth = containerWidth ?? width ?? 350
    return (
        <>
            <style jsx global>{`
                .graph-tooltip {
                    background: transparent !important;
                    border: none !important;
                    box-shadow: none !important;
                    padding: 0 !important;
                }
            `}</style>
            <div ref={containerRef} className="relative w-full" style={{ height: graphHeight, touchAction: 'none' }}>
                {containerWidth !== null && (
                    <ForceGraph2D
                        ref={graphRef}
                        graphData={{
                            nodes: filteredGraphData.nodes,
                            links: [
                                // Invite edges (reversed for arrow direction)
                                ...filteredGraphData.edges.map((edge) => ({
                                    ...edge,
                                    source: edge.target,
                                    target: edge.source,
                                    isP2P: false,
                                })),
                                // P2P payment edges (for clustering visualization)
                                // P2P payment edges (for clustering visualization)
                                // Include both full mode (count/totalUsd) and anonymized mode (frequency/volume) fields
                                ...(filteredGraphData.p2pEdges || []).map((edge, i) => ({
                                    id: `p2p-${i}`,
                                    source: edge.source,
                                    target: edge.target,
                                    type: edge.type,
                                    count: edge.count,
                                    totalUsd: edge.totalUsd,
                                    frequency: edge.frequency,
                                    volume: edge.volume,
                                    bidirectional: edge.bidirectional,
                                    isP2P: true,
                                })),
                            ],
                        }}
                        nodeId="id"
                        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                            // Draw hit detection area matching actual rendered node size
                            // In user mode (minimal): fixed size of 12
                            const nodeRadius = 12
                            ctx.fillStyle = color
                            ctx.beginPath()
                            ctx.arc(node.x, node.y, nodeRadius + 2, 0, 2 * Math.PI) // +2 for easier hover
                            ctx.fill()
                        }}
                        nodeCanvasObject={nodeCanvasObject}
                        nodeCanvasObjectMode={() => 'replace'}
                        linkCanvasObject={linkCanvasObject}
                        linkCanvasObjectMode={() => 'replace'}
                        onNodeClick={handleNodeClick}
                        onNodeRightClick={handleNodeRightClick}
                        onNodeDragStart={handleNodeDragStart}
                        onNodeDrag={handleNodeDrag}
                        onNodeDragEnd={handleNodeDragEnd}
                        enableNodeDrag={true}
                        enablePanInteraction={true}
                        enableZoomInteraction={true}
                        cooldownTicks={Infinity}
                        warmupTicks={0}
                        d3AlphaDecay={isMinimal ? 0.03 : 0.005}
                        d3VelocityDecay={isMinimal ? 0.8 : 0.6}
                        d3AlphaMin={0.001}
                        onEngineStop={handleEngineStop}
                        backgroundColor={backgroundColor}
                        width={minimalWidth}
                        height={graphHeight}
                        autoPauseRedraw={mode === 'user'}
                    />
                )}
                {/* Reset camera button when focused on a user */}
                {selectedUserId && (
                    <button
                        onClick={handleResetView}
                        className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-body-xs font-medium shadow-md transition-colors"
                    >
                        <span>←</span>
                        <span>{t('invitesGraph.resetView')}</span>
                    </button>
                )}
                {renderOverlays?.(overlayProps)}
            </div>
        </>
    )
}
