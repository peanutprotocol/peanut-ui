'use client'

/**
 * InvitesGraph - Interactive force-directed graph visualization
 *
 * ARCHITECTURE: Visual Settings vs Data Settings
 *
 * VISUAL ONLY (no recalculation, instant):
 *   - showUsernames: Show/hide labels
 *   - activityFilter.activityDays: Change activity threshold (affects coloring)
 *
 * DATA FILTERING (triggers recalculation, 2-3 sec):
 *   - forceConfig: Change force strengths
 *   - visibilityConfig: Remove nodes/edges from simulation
 *     - activeNodes / inactiveNodes: Filter by activity status
 *     - inviteEdges / p2pEdges: Filter edge types
 *   - topNodes: Limit to top N nodes by points (0 = all, default 5000)
 *   - externalNodesConfig: Add/remove external nodes
 *
 * REINSERTION STRATEGY (when toggling nodes/edges back ON):
 *   1. Nodes are added back to simulation with no fixed positions
 *   2. D3 force simulation calculates initial positions based on forces
 *   3. Nodes naturally settle near connected neighbors (2-3 seconds)
 *   4. No blocking warmup - smooth visual transition as they move into place
 *   5. Layout adapts to current graph state (better than cached positions)
 *
 * KEY FUNCTIONS:
 *   - handleResetView(): Clear selection + zoom out (keeps settings)
 *   - handleReset(): Reset all settings to defaults + zoom out
 *   - handleRecalculate(): Force full recalculation with current settings
 *
 * FILE LAYOUT (logic/UI separation):
 *   - useInvitesGraphData: data + config state, preferences, filtering pipeline
 *   - useInvitesGraphDerived: derived memos (maps/sets, combined nodes/links)
 *   - useInvitesGraphInteractions: selection, search, drag/click, deep-link focus
 *   - useInvitesGraphFetch: backend fetch effects
 *   - useInvitesGraphRendering: canvas draw callbacks + display-settings ref sync
 *   - useInvitesGraphForces: D3 force model + recalculation
 *   - useInvitesGraphCamera: zoom-to-fit + selected-node tracking
 *   - MinimalGraphView / GraphTopBar / FullGraphCanvas: the views
 */

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { FullGraphCanvas } from './FullGraphCanvas'
import { GraphTopBar } from './GraphTopBar'
import { MinimalGraphView } from './MinimalGraphView'
import {
    type GraphData,
    type GraphDisplaySettings,
    type GraphMode,
    type GraphOverlayProps,
    type InvitesGraphProps,
    DEFAULT_ACTIVITY_FILTER,
    DEFAULT_FORCE_CONFIG,
    DEFAULT_VISIBILITY_CONFIG,
} from './types'
import { useInvitesGraphCamera } from './useInvitesGraphCamera'
import { useInvitesGraphData } from './useInvitesGraphData'
import { useInvitesGraphDerived } from './useInvitesGraphDerived'
import { useInvitesGraphFetch } from './useInvitesGraphFetch'
import { useInvitesGraphForces } from './useInvitesGraphForces'
import { useInvitesGraphInteractions } from './useInvitesGraphInteractions'
import { useInvitesGraphRendering } from './useInvitesGraphRendering'
import { DEFAULT_TOP_NODES, getModeConfigs } from './utils'

export type { GraphMode }

// Hook for graph data pass-through (kept for backward compatibility)
// Note: Previously filtered tree data, now just returns graph data unchanged
// selectedUserId is only used for camera positioning and highlighting in rendering
function useGraphFiltering(graphData: GraphData | null) {
    return graphData
}

export default function InvitesGraph(props: InvitesGraphProps) {
    const t = useTranslations('global')
    const {
        width,
        height,
        backgroundColor = '#FAF4F0',
        showUsernames: initialShowUsernames = true,
        topNodes: initialTopNodes = DEFAULT_TOP_NODES,
        activityFilter: initialActivityFilter = DEFAULT_ACTIVITY_FILTER,
        forceConfig: initialForceConfig = DEFAULT_FORCE_CONFIG,
        visibilityConfig: initialVisibilityConfig = DEFAULT_VISIBILITY_CONFIG,
        renderOverlays,
        initialFocusUsername,
    } = props

    const isMinimal = props.minimal === true
    // Get mode from props - defaults to 'full' for non-minimal, 'user' for minimal
    const mode: GraphMode = isMinimal ? 'user' : (props.mode ?? 'full')

    const { modeActivityFilter, modeVisibilityConfig, finalModeForceConfig, modeExternalNodesConfig } = getModeConfigs({
        mode,
        initialActivityFilter,
        initialForceConfig,
        initialVisibilityConfig,
    })

    const {
        setFetchedGraphData,
        loading,
        setLoading,
        error,
        setError,
        rawGraphData,
        graphData,
        showUsernames,
        setShowUsernames,
        topNodes,
        setTopNodes,
        hiddenStatuses,
        setHiddenStatuses,
        activityFilter,
        setActivityFilter,
        forceConfig,
        setForceConfig,
        visibilityConfig,
        setVisibilityConfig,
        externalNodesConfig,
        setExternalNodesConfig,
        externalNodesData,
        setExternalNodesData,
        externalNodesLoading,
        setExternalNodesLoading,
        externalNodesError,
        setExternalNodesError,
        externalNodesFetchedLimitRef,
    } = useInvitesGraphData({
        props,
        isMinimal,
        mode,
        initialShowUsernames,
        initialTopNodes,
        modeActivityFilter,
        finalModeForceConfig,
        modeVisibilityConfig,
        modeExternalNodesConfig,
    })

    const graphRef = useRef<any>(null)

    // Selection only affects camera positioning, not data
    // Always use the activity/visibility filtered data
    const filteredGraphData = useGraphFiltering(graphData)

    const {
        inviterMap,
        inviterNodes,
        p2pActiveNodes,
        filteredExternalNodes,
        combinedGraphNodes,
        externalLinks,
        combinedLinks,
    } = useInvitesGraphDerived({
        filteredGraphData,
        rawGraphData,
        externalNodesData,
        externalNodesConfig,
        activityFilter,
        mode,
    })

    const {
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
    } = useInvitesGraphInteractions({
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
    })

    // Display settings live in a ref so canvas callbacks read fresh values without re-renders
    // (kept in sync by useInvitesGraphRendering)
    const displaySettingsRef = useRef<GraphDisplaySettings>({
        showUsernames,
        selectedUserId,
        isMinimal,
        mode,
        activityFilter,
        visibilityConfig,
        externalNodesConfig,
        p2pActiveNodes,
        inviterNodes,
        hiddenStatuses,
    })

    useInvitesGraphFetch({
        props,
        mode,
        topNodes,
        displaySettingsRef,
        setLoading,
        setError,
        setFetchedGraphData,
        externalNodesConfig,
        externalNodesFetchedLimitRef,
        setExternalNodesData,
        setExternalNodesLoading,
        setExternalNodesError,
    })

    const { nodeCanvasObject, linkCanvasObject } = useInvitesGraphRendering({
        displaySettingsRef,
        showUsernames,
        selectedUserId,
        isMinimal,
        mode,
        activityFilter,
        visibilityConfig,
        externalNodesConfig,
        p2pActiveNodes,
        inviterNodes,
        hiddenStatuses,
    })

    const { handleRecalculate } = useInvitesGraphForces({ graphRef, forceConfig, filteredGraphData })

    const { handleEngineStop } = useInvitesGraphCamera({
        graphRef,
        filteredGraphData,
        isMinimal,
        selectedUserId,
        combinedGraphNodes,
    })

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Clear any pending search
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current)
            }
            // Clear graph ref
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
                    <Icon name="pending" size={24} className="animate-spin" />
                    <span className="text-body-l font-medium">{t('invitesGraph.loadingNetwork')}</span>
                </div>
            </div>
        )
    }

    // Error state (only for full mode)
    if (!isMinimal && error) {
        return (
            <div className="flex flex-1 items-center justify-center p-4">
                <div className="max-w-md rounded-2xl bg-red-50 p-8 text-center shadow-lg">
                    <div className="mb-4 text-heading-xl">⚠️</div>
                    <p className="mb-4 text-body-l font-medium text-red-600">{error}</p>
                    {props.onClose && (
                        <Button onClick={props.onClose} variant="stroke">
                            {t('invitesGraph.goBack')}
                        </Button>
                    )}
                </div>
            </div>
        )
    }

    if (!filteredGraphData) return null

    const graphWidth = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200)
    const graphHeight = height ?? (typeof window !== 'undefined' ? window.innerHeight - 120 : 800)

    const overlayProps: GraphOverlayProps = {
        showUsernames,
        setShowUsernames,
        topNodes,
        setTopNodes,
        activityFilter,
        setActivityFilter,
        forceConfig,
        setForceConfig,
        visibilityConfig,
        setVisibilityConfig,
        externalNodesConfig,
        setExternalNodesConfig,
        externalNodes: filteredExternalNodes,
        externalNodesLoading,
        externalNodesError,
        handleResetView,
        handleReset,
        handleRecalculate,
        hiddenStatuses,
        setHiddenStatuses,
    }

    // Minimal mode - just the graph canvas
    if (isMinimal) {
        return (
            <MinimalGraphView
                containerRef={containerRef}
                graphRef={graphRef}
                filteredGraphData={filteredGraphData}
                graphHeight={graphHeight}
                containerWidth={containerWidth}
                width={width}
                backgroundColor={backgroundColor}
                mode={mode}
                isMinimal={isMinimal}
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
                renderOverlays={renderOverlays}
                overlayProps={overlayProps}
            />
        )
    }

    // Full mode with controls
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
            <GraphTopBar
                onClose={props.onClose}
                mode={mode}
                combinedGraphNodes={combinedGraphNodes}
                externalNodesConfig={externalNodesConfig}
                filteredGraphData={filteredGraphData}
                externalLinks={externalLinks}
                searchQuery={searchQuery}
                searchResults={searchResults}
                selectedUserId={selectedUserId}
                setSelectedUserId={setSelectedUserId}
                filteredExternalNodes={filteredExternalNodes}
                handleSearch={handleSearch}
                handleClearSearch={handleClearSearch}
                handleResetView={handleResetView}
            />
            <FullGraphCanvas
                graphRef={graphRef}
                combinedGraphNodes={combinedGraphNodes}
                combinedLinks={combinedLinks}
                displaySettingsRef={displaySettingsRef}
                inviterMap={inviterMap}
                graphWidth={graphWidth}
                graphHeight={graphHeight}
                nodeCanvasObject={nodeCanvasObject}
                linkCanvasObject={linkCanvasObject}
                handleNodeClick={handleNodeClick}
                handleNodeRightClick={handleNodeRightClick}
                handleNodeDragStart={handleNodeDragStart}
                handleNodeDrag={handleNodeDrag}
                handleNodeDragEnd={handleNodeDragEnd}
                handleEngineStop={handleEngineStop}
                renderOverlays={renderOverlays}
                overlayProps={overlayProps}
            />
        </>
    )
}
