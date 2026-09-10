import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { type ForceConfig, type GraphData, DEFAULT_FORCE_CONFIG } from './types'
import { getExternalNodeUsers, getNodePoints } from './utils'

interface UseInvitesGraphForcesParams {
    graphRef: MutableRefObject<any>
    forceConfig: ForceConfig
    filteredGraphData: GraphData | null
}

/**
 * D3 force simulation configuration: applies the force model to the mounted
 * graph, reheats on config/data changes, and exposes manual recalculation.
 */
export function useInvitesGraphForces({ graphRef, forceConfig, filteredGraphData }: UseInvitesGraphForcesParams) {
    const forcesConfiguredRef = useRef(false)

    // Configure D3 forces - optimized based on analysis
    // Store forceConfig and graph data in refs for access in callbacks
    const forceConfigRef = useRef(forceConfig)
    const filteredGraphDataRef = useRef(filteredGraphData)
    useEffect(() => {
        forceConfigRef.current = forceConfig
        filteredGraphDataRef.current = filteredGraphData
    }, [forceConfig, filteredGraphData])

    const configureForces = useCallback(async () => {
        if (!graphRef.current) return

        const graph = graphRef.current
        const currentGraphData = filteredGraphDataRef.current
        const nodeCount = currentGraphData?.nodes?.length ?? 0
        const isLarge = nodeCount > 1000
        const fc = forceConfigRef.current

        const d3 = await import('d3-force')

        // ===========================================
        // SIMPLIFIED FORCE MODEL - Using D3 built-ins with O(n log n) Barnes-Hut
        // ===========================================

        const linkDistance = isLarge ? 80 : 100

        // CHARGE: D3's forceManyBody with Barnes-Hut approximation (O(n log n))
        // Keep it simple - just use strength, let D3 handle the falloff naturally
        if (fc.charge.enabled) {
            graph.d3Force(
                'charge',
                d3
                    .forceManyBody()
                    .strength((node: any) => {
                        // External nodes: fixed repulsion
                        if (node.isExternal) {
                            return -fc.charge.strength * 0.5
                        }
                        // User nodes: scale slightly with points (bigger nodes push more)
                        const base = -fc.charge.strength
                        const pointsMultiplier = 1 + Math.sqrt(getNodePoints(node)) / 100
                        return base * Math.min(pointsMultiplier, 2) // Cap at 2x
                    })
                    .distanceMin(10) // Prevent infinite force at very close range
                    .theta(isLarge ? 0.9 : 0.8) // Accuracy vs speed tradeoff
            )
            // NO distanceMax - let repulsion work at all distances
        } else {
            graph.d3Force('charge', null)
        }

        // COLLIDE: Prevents node overlap - use modest radius to avoid fighting with charge
        const collideForce = d3
            .forceCollide()
            .radius((node: any) => {
                // External nodes: size based on connections
                if (node.isExternal) {
                    const size = 4 + Math.log2(getExternalNodeUsers(node)) * 2
                    return size * 1.5
                }
                // User nodes: size based on points
                const baseSize = node.hasAppAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                const nodeRadius = baseSize + Math.min(pointsMultiplier, 25)
                return nodeRadius * 1.5 // 1.5x = slight padding, doesn't fight charge
            })
            .strength(0.7) // Slightly soft - allows some settling
            .iterations(2) // Fewer iterations needed with softer constraint
        graph.d3Force('collide', collideForce)

        // LINK: Invite, P2P, and External edges all use the same force (from graphData.links)
        // We configure different strengths based on link type
        const linkForce = graph.d3Force('link')
        if (linkForce) {
            // Distance: varies by link type
            linkForce.distance((link: any) => {
                if (link.isP2P) return linkDistance * 0.7 // P2P: tighter clustering
                if (link.isExternal) return linkDistance * 1.2 // External: looser (they're peripheral)
                return linkDistance // Invite: standard
            })

            // Strength: Different per link type, capped at 1.0 to prevent flying nodes
            const extConfig = fc.externalLinks || DEFAULT_FORCE_CONFIG.externalLinks
            linkForce.strength((link: any) => {
                if (link.isP2P) {
                    return fc.p2pLinks.enabled ? Math.min(fc.p2pLinks.strength, 1.0) : 0
                }
                if (link.isExternal) {
                    return extConfig.enabled ? Math.min(extConfig.strength, 1.0) : 0
                }
                return fc.inviteLinks.enabled ? Math.min(fc.inviteLinks.strength, 1.0) : 0
            })
        }

        // CENTER: Pulls nodes toward origin. sizeBias controls how much bigger nodes are pulled more
        const centerConfig = fc.center || DEFAULT_FORCE_CONFIG.center
        if (centerConfig.enabled) {
            graph.d3Force(
                'x',
                d3.forceX(0).strength((node: any) => {
                    if (node.isExternal) return centerConfig.strength * 0.5 // External nodes: half strength

                    // sizeBias: 0 = uniform, 1 = big nodes get 2x pull
                    // Formula: strength * (1 + sizeBias * pointsMultiplier)
                    const pointsMultiplier = Math.min(Math.sqrt(getNodePoints(node)) / 100, 1)
                    return centerConfig.strength * (1 + centerConfig.sizeBias * pointsMultiplier)
                })
            )
            graph.d3Force(
                'y',
                d3.forceY(0).strength((node: any) => {
                    if (node.isExternal) return centerConfig.strength * 0.5
                    const pointsMultiplier = Math.min(Math.sqrt(getNodePoints(node)) / 100, 1)
                    return centerConfig.strength * (1 + centerConfig.sizeBias * pointsMultiplier)
                })
            )
        } else {
            graph.d3Force('x', null)
            graph.d3Force('y', null)
        }
        graph.d3Force('center', null) // Remove default center (we use X/Y)

        // Note: P2P is handled by the link force above (different strength per link type)
        // No separate 'p2p' force needed - it's all in graphData.links with isP2P flag

        // Mark as configured (used by other effects)
        forcesConfiguredRef.current = true
    }, []) // Empty deps - uses refs for current data

    // Manual recalculation button - resets positions and reconfigures forces
    const handleRecalculate = useCallback(() => {
        if (!graphRef.current) {
            return
        }

        const graph = graphRef.current as any

        // Get nodes from graphData prop or via d3Force
        const linkForce = graph.d3Force?.('link')
        const nodes =
            linkForce?.links?.()?.flatMap?.((l: any) => [l.source, l.target]) ||
            filteredGraphDataRef.current?.nodes ||
            []
        const uniqueNodes = [...new Map(nodes.map((n: any) => [n.id || n, n])).values()]

        if (uniqueNodes.length > 0) {
            // Reset positions on actual node objects
            uniqueNodes.forEach((node: any) => {
                if (typeof node === 'object') {
                    node.x = (Math.random() - 0.5) * 200
                    node.y = (Math.random() - 0.5) * 200
                    node.vx = 0
                    node.vy = 0
                    delete node.fx
                    delete node.fy
                }
            })
        }

        // Reheat simulation
        graph.d3ReheatSimulation?.()

        // Also reconfigure forces
        configureForces()
    }, [configureForces])

    // Reconfigure forces when forceConfig changes - do a STRONG reheat
    // Also re-run when filteredGraphData changes (to catch initial mount and data changes)
    useEffect(() => {
        if (!filteredGraphData) return

        const applyForces = () => {
            if (!graphRef.current) return false

            // configureForces is async - must wait for it to complete before reheating
            configureForces().then(() => {
                if (!graphRef.current) return
                const internalGraph = graphRef.current as any
                if (internalGraph._simulation) {
                    internalGraph._simulation.alpha(1).restart()
                } else {
                    graphRef.current.d3ReheatSimulation()
                }
            })
            return true
        }

        // Try immediately
        if (applyForces()) return

        // If graph not ready yet, retry a few times (graph mounts async)
        const retries = [100, 200, 500]
        const timeouts = retries.map((delay) => setTimeout(() => applyForces(), delay))

        return () => timeouts.forEach(clearTimeout)
    }, [forceConfig, filteredGraphData, configureForces])

    return { handleRecalculate }
}
