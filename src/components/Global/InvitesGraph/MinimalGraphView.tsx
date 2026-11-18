'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import type { MutableRefObject, RefObject } from 'react'
import { ForceGraph2D } from './ForceGraph2D'
import { type GraphData } from './types'

interface MinimalGraphViewProps {
    containerRef: RefObject<HTMLDivElement>
    graphRef: MutableRefObject<any>
    filteredGraphData: GraphData
    graphHeight: number
    containerWidth: number | null
    width?: number
    backgroundColor: string
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
}

/** The graph canvas with no controls (rewards page) */
export function MinimalGraphView({
    containerRef,
    graphRef,
    filteredGraphData,
    graphHeight,
    containerWidth,
    width,
    backgroundColor,
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
                            // Invite edges (reversed for arrow direction)
                            links: filteredGraphData.edges.map((edge) => ({
                                ...edge,
                                source: edge.target,
                                target: edge.source,
                            })),
                        }}
                        nodeId="id"
                        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                            // Draw hit detection area matching actual rendered node size
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
                        d3AlphaDecay={0.03}
                        d3VelocityDecay={0.8}
                        d3AlphaMin={0.001}
                        onEngineStop={handleEngineStop}
                        backgroundColor={backgroundColor}
                        width={minimalWidth}
                        height={graphHeight}
                        autoPauseRedraw={true}
                    />
                )}
                {/* Reset camera button when focused on a user */}
                {selectedUserId && (
                    <Button
                        variant="secondary"
                        size="small"
                        icon="undo"
                        onClick={handleResetView}
                        className="absolute top-2 left-2 z-10"
                    >
                        {t('invitesGraph.resetView')}
                    </Button>
                )}
            </div>
        </>
    )
}
