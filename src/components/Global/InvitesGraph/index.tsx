'use client'

/**
 * InvitesGraph - the user's invite tree as a force-directed graph (rewards page)
 *
 * FILE LAYOUT (logic/UI separation):
 *   - utils: data preparation (node cap, activity status)
 *   - useInvitesGraphInteractions: selection, drag/click, container width
 *   - useInvitesGraphRendering: canvas draw callbacks + display-settings ref sync
 *   - useInvitesGraphForces: D3 force model
 *   - useInvitesGraphCamera: zoom-to-fit + selected-node tracking
 *   - MinimalGraphView: the view
 */

import { useEffect, useMemo, useRef } from 'react'
import { MinimalGraphView } from './MinimalGraphView'
import { type GraphDisplaySettings, type InvitesGraphProps } from './types'
import { useInvitesGraphCamera } from './useInvitesGraphCamera'
import { useInvitesGraphForces } from './useInvitesGraphForces'
import { useInvitesGraphInteractions } from './useInvitesGraphInteractions'
import { useInvitesGraphRendering } from './useInvitesGraphRendering'
import { toUserGraphData } from './utils'

export default function InvitesGraph({
    data,
    width,
    height,
    backgroundColor = '#FAF4F0',
    showUsernames = true,
}: InvitesGraphProps) {
    const graphRef = useRef<any>(null)

    const filteredGraphData = useMemo(() => toUserGraphData(data), [data])

    // Inviters (nodes with outgoing invite edges) get a heart after their username
    const inviterNodes = useMemo(() => new Set(filteredGraphData.edges.map((edge) => edge.source)), [filteredGraphData])

    const {
        selectedUserId,
        containerRef,
        containerWidth,
        handleNodeDragStart,
        handleNodeDrag,
        handleNodeDragEnd,
        handleNodeClick,
        handleNodeRightClick,
        handleResetView,
    } = useInvitesGraphInteractions({ graphRef, filteredGraphData })

    // Display settings live in a ref so canvas callbacks read fresh values without re-renders
    // (kept in sync by useInvitesGraphRendering)
    const displaySettingsRef = useRef<GraphDisplaySettings>({ showUsernames, selectedUserId, inviterNodes })

    const { nodeCanvasObject, linkCanvasObject } = useInvitesGraphRendering({
        displaySettingsRef,
        showUsernames,
        selectedUserId,
        inviterNodes,
    })

    useInvitesGraphForces({ graphRef, filteredGraphData })

    const { handleEngineStop } = useInvitesGraphCamera({ graphRef, filteredGraphData, selectedUserId })

    // Clear graph ref on unmount
    useEffect(() => {
        return () => {
            graphRef.current = null
        }
    }, [])

    const graphHeight = height ?? (typeof window !== 'undefined' ? window.innerHeight - 120 : 800)

    return (
        <MinimalGraphView
            containerRef={containerRef}
            graphRef={graphRef}
            filteredGraphData={filteredGraphData}
            graphHeight={graphHeight}
            containerWidth={containerWidth}
            width={width}
            backgroundColor={backgroundColor}
            selectedUserId={selectedUserId}
            nodeCanvasObject={nodeCanvasObject}
            linkCanvasObject={linkCanvasObject}
            handleNodeClick={handleNodeClick}
            handleNodeRightClick={handleNodeRightClick}
            handleNodeDragStart={handleNodeDragStart}
            handleNodeDrag={handleNodeDrag}
            handleNodeDragEnd={handleNodeDragEnd}
            handleEngineStop={handleEngineStop}
            handleResetView={handleResetView}
        />
    )
}
