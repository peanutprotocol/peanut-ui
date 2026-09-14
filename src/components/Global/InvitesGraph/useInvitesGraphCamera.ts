import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { type GraphData } from './types'

interface UseInvitesGraphCameraParams {
    graphRef: MutableRefObject<any>
    filteredGraphData: GraphData | null
    isMinimal: boolean
    selectedUserId: string | null
    combinedGraphNodes: any[]
}

/**
 * Camera behavior: initial zoom-to-fit after the simulation settles,
 * continuous zoom tracking in minimal mode, and following the selected node.
 */
export function useInvitesGraphCamera({
    graphRef,
    filteredGraphData,
    isMinimal,
    selectedUserId,
    combinedGraphNodes,
}: UseInvitesGraphCameraParams) {
    const initialZoomDoneRef = useRef(false)

    // Initial zoom to fit after graph stabilizes
    const handleEngineStop = useCallback(() => {
        if (!graphRef.current || initialZoomDoneRef.current) return
        // Zoom to fit with padding after initial simulation
        setTimeout(() => {
            graphRef.current?.zoomToFit(400, 40)
            initialZoomDoneRef.current = true
        }, 100)
    }, [])

    // Initial forces are configured by the forceConfig effect when graph mounts
    // This effect just handles the initial zoom after data arrives
    useEffect(() => {
        if (!filteredGraphData || !graphRef.current) return

        // Give the graph a moment to render, then zoom to fit
        const timeout = setTimeout(() => {
            if (graphRef.current && !initialZoomDoneRef.current) {
                graphRef.current.zoomToFit(400, 40)
                initialZoomDoneRef.current = true
            }
        }, 500)

        return () => clearTimeout(timeout)
    }, [filteredGraphData])

    // Continuous zoom tracking in minimal mode during simulation settling
    useEffect(() => {
        if (!isMinimal || !filteredGraphData || !graphRef.current) return

        let frameId: number | null = null
        const startTime = Date.now()
        const trackDuration = 4000 // Track for 4 seconds (simulation should settle by then)

        const continuousZoom = () => {
            const elapsed = Date.now() - startTime
            if (elapsed > trackDuration || !graphRef.current) return

            // Zoom to fit every frame during settling - fast animation
            graphRef.current.zoomToFit(100, 40)
            frameId = requestAnimationFrame(continuousZoom)
        }

        // Start tracking immediately after graph mounts
        const timeout = setTimeout(() => {
            frameId = requestAnimationFrame(continuousZoom)
        }, 100)

        return () => {
            if (frameId) cancelAnimationFrame(frameId)
            clearTimeout(timeout)
        }
    }, [isMinimal, filteredGraphData])

    // Center on selected node - track continuously as it moves
    useEffect(() => {
        if (!selectedUserId || !graphRef.current) return

        let animationFrameId: number | null = null
        let lastCenterTime = 0
        const centerThrottleMs = 50 // Update camera at most every 50ms

        const trackNode = () => {
            if (!graphRef.current) return

            // Find node in combinedGraphNodes (has live position updates from simulation)
            const node = combinedGraphNodes.find((n) => n.id === selectedUserId)
            if (!node || node.x === undefined || node.y === undefined) {
                // Node doesn't have position yet, keep trying
                animationFrameId = requestAnimationFrame(trackNode)
                return
            }

            const now = Date.now()
            if (now - lastCenterTime > centerThrottleMs) {
                // Smoothly follow the node as it moves
                graphRef.current.centerAt(node.x, node.y, 300)
                lastCenterTime = now
            }

            animationFrameId = requestAnimationFrame(trackNode)
        }

        // Initial zoom in
        setTimeout(() => {
            if (graphRef.current) {
                graphRef.current.zoom(3, 800)
            }
        }, 100)

        // Start tracking
        trackNode()

        return () => {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId)
            }
        }
    }, [selectedUserId, combinedGraphNodes])

    // P2P particle animation is handled by:
    // 1. autoPauseRedraw={false} on ForceGraph2D - keeps rendering after simulation stops
    // 2. performance.now() in linkCanvasObject - animates particles based on real time
    // No additional animation loop needed!

    return { handleEngineStop }
}
