import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { profileUrl } from '@/utils/native-routes'
import { type GraphData } from './types'
import { CLICK_MAX_DISTANCE_PX, CLICK_MAX_DURATION_MS } from './utils'

interface UseInvitesGraphInteractionsParams {
    graphRef: React.MutableRefObject<any>
    filteredGraphData: GraphData | null
}

/**
 * Owns user interaction state and handlers: node selection (click/right-click,
 * drag-vs-click detection), the reset action, and container width measurement.
 */
export function useInvitesGraphInteractions({ graphRef, filteredGraphData }: UseInvitesGraphInteractionsParams) {
    const router = useRouter()

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState<number | null>(null)

    // Drag vs click detection
    const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
    const isDraggingRef = useRef(false)

    useEffect(() => {
        if (!containerRef.current) return

        const measureWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth)
            }
        }

        measureWidth()
        window.addEventListener('resize', measureWidth)
        return () => window.removeEventListener('resize', measureWidth)
    }, [])

    // Clear selection if selected node is filtered out
    useEffect(() => {
        if (selectedUserId && filteredGraphData) {
            const nodeExists = filteredGraphData.nodes.some((n) => n.id === selectedUserId)
            if (!nodeExists) {
                setSelectedUserId(null)
            }
        }
    }, [selectedUserId, filteredGraphData])

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

    // Click opens the user's profile; a node with no username is selected instead
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

            // window.open('/<user>','_blank') was dead on iOS (no popup support)
            // and a full app reset on Android.
            if (node.username) {
                router.push(profileUrl(node.username))
                return
            }

            setSelectedUserId(node.id)
        },
        [router]
    )

    // Right-click selects the node (camera follows)
    const handleNodeRightClick = useCallback((node: any) => {
        setSelectedUserId((prev) => (prev === node.id ? null : node.id))
    }, [])

    const handleResetView = useCallback(() => {
        setSelectedUserId(null)
        graphRef.current?.zoomToFit(400)
    }, [])

    return {
        selectedUserId,
        containerRef,
        containerWidth,
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragEnd,
        handleNodeClick,
        handleNodeRightClick,
        handleResetView,
    }
}
