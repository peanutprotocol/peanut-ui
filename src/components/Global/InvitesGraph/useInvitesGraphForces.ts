import { useCallback, useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { type GraphData } from './types'
import { getNodePoints } from './utils'

// Strong repulsion so a small graph does not overlap in the card
const CHARGE_STRENGTH = 240
const INVITE_LINK_STRENGTH = 0.4
const CENTER_STRENGTH = 0.03
/** 0 = uniform pull to the center, 1 = big nodes are pulled 2x as strongly */
const CENTER_SIZE_BIAS = 0.5

interface UseInvitesGraphForcesParams {
    graphRef: MutableRefObject<any>
    filteredGraphData: GraphData | null
}

/**
 * D3 force simulation configuration: applies the force model to the mounted
 * graph and reheats when the data changes.
 */
export function useInvitesGraphForces({ graphRef, filteredGraphData }: UseInvitesGraphForcesParams) {
    const filteredGraphDataRef = useRef(filteredGraphData)
    useEffect(() => {
        filteredGraphDataRef.current = filteredGraphData
    }, [filteredGraphData])

    const configureForces = useCallback(async () => {
        if (!graphRef.current) return

        const graph = graphRef.current
        const nodeCount = filteredGraphDataRef.current?.nodes?.length ?? 0
        const isLarge = nodeCount > 1000

        const d3 = await import('d3-force')

        const linkDistance = isLarge ? 80 : 100

        // CHARGE: D3's forceManyBody with Barnes-Hut approximation (O(n log n))
        graph.d3Force(
            'charge',
            d3
                .forceManyBody()
                .strength((node: any) => {
                    // Bigger nodes push slightly more, capped at 2x
                    const pointsMultiplier = 1 + Math.sqrt(getNodePoints(node)) / 100
                    return -CHARGE_STRENGTH * Math.min(pointsMultiplier, 2)
                })
                .distanceMin(10) // Prevent infinite force at very close range
                .theta(isLarge ? 0.9 : 0.8) // Accuracy vs speed tradeoff
        )

        // COLLIDE: Prevents node overlap - use modest radius to avoid fighting with charge
        const collideForce = d3
            .forceCollide()
            .radius((node: any) => {
                const baseSize = node.hasAppAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                const nodeRadius = baseSize + Math.min(pointsMultiplier, 25)
                return nodeRadius * 1.5 // 1.5x = slight padding, doesn't fight charge
            })
            .strength(0.7)
            .iterations(2)
        graph.d3Force('collide', collideForce)

        const linkForce = graph.d3Force('link')
        if (linkForce) {
            linkForce.distance(linkDistance)
            linkForce.strength(INVITE_LINK_STRENGTH)
        }

        // CENTER: Pulls nodes toward origin, bigger nodes more strongly
        const centerStrength = (node: any) => {
            const pointsMultiplier = Math.min(Math.sqrt(getNodePoints(node)) / 100, 1)
            return CENTER_STRENGTH * (1 + CENTER_SIZE_BIAS * pointsMultiplier)
        }
        graph.d3Force('x', d3.forceX(0).strength(centerStrength))
        graph.d3Force('y', d3.forceY(0).strength(centerStrength))
        graph.d3Force('center', null) // Remove default center (we use X/Y)
    }, [])

    // Apply forces and reheat when the data changes (also catches the initial mount)
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

        if (applyForces()) return

        // If graph not ready yet, retry a few times (graph mounts async)
        const retries = [100, 200, 500]
        const timeouts = retries.map((delay) => setTimeout(() => applyForces(), delay))

        return () => timeouts.forEach(clearTimeout)
    }, [filteredGraphData, configureForces])
}
