import { useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import { type GraphDisplaySettings, type GraphNode } from './types'
import { getUserActivityStatus } from './utils'

const NODE_RADIUS = 12
const LABEL_FONT_SIZE = 4

interface UseInvitesGraphRenderingParams {
    displaySettingsRef: MutableRefObject<GraphDisplaySettings>
    showUsernames: boolean
    selectedUserId: string | null
    inviterNodes: Set<string>
}

/**
 * Canvas rendering callbacks for ForceGraph2D (node + link painting) and the
 * effect that keeps displaySettingsRef in sync so the callbacks read fresh
 * values without re-creating (which would restart the simulation).
 */
export function useInvitesGraphRendering({
    displaySettingsRef,
    showUsernames,
    selectedUserId,
    inviterNodes,
}: UseInvitesGraphRenderingParams) {
    useEffect(() => {
        displaySettingsRef.current = { showUsernames, selectedUserId, inviterNodes }
    }, [showUsernames, selectedUserId, inviterNodes])

    // All nodes are the same size and pink; the outline and label carry the state
    const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
        const {
            selectedUserId: selId,
            showUsernames: showNames,
            inviterNodes: inviterNodesSet,
        } = displaySettingsRef.current

        const isSelected = node.id === selId
        const hasAccess = node.hasAppAccess
        const activityStatus = getUserActivityStatus(node)

        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_RADIUS, 0, 2 * Math.PI)
        ctx.fillStyle = 'rgb(255, 144, 232)' // primary-1
        ctx.fill()

        // Outline: golden when selected, black when jailed (no app access)
        ctx.globalAlpha = 1
        if (isSelected) {
            ctx.strokeStyle = '#FFC900'
            ctx.lineWidth = 3
            ctx.stroke()
        } else if (!hasAccess) {
            ctx.strokeStyle = '#000000'
            ctx.lineWidth = 2
            ctx.stroke()
        }

        if (!showNames) return

        const label = node.username
        const fontSize = LABEL_FONT_SIZE
        ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        // canvas cannot read classes: #000000 is the foreground-primary token
        ctx.fillStyle = activityStatus === 'inactive' ? 'rgba(0, 0, 0, 0.3)' : '#000000'

        const labelY = node.y + NODE_RADIUS + fontSize + 2
        ctx.fillText(label, node.x, labelY)

        // Heart after the username of each inviter
        if (inviterNodesSet.has(node.id)) {
            const textWidth = ctx.measureText(label).width
            const heartX = node.x + textWidth / 2 + fontSize * 0.6
            const heartY = labelY
            const heartSize = fontSize * 0.7

            ctx.save()
            ctx.fillStyle = '#FF90E8'
            ctx.beginPath()
            // Heart shape using two circles and a triangle
            const topY = heartY - heartSize * 0.3
            ctx.arc(heartX - heartSize * 0.25, topY, heartSize * 0.3, 0, Math.PI, true)
            ctx.arc(heartX + heartSize * 0.25, topY, heartSize * 0.3, 0, Math.PI, true)
            ctx.lineTo(heartX + heartSize * 0.5, topY)
            ctx.lineTo(heartX, heartY + heartSize * 0.3)
            ctx.lineTo(heartX - heartSize * 0.5, topY)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
    }, [])

    // Invite edge: a line with arrows from inviter to invitee, faded when either end is inactive
    const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
        const source = link.source
        const target = link.target

        if (!source.x || !target.x) return

        const inactive =
            getUserActivityStatus(source as GraphNode) === 'inactive' ||
            getUserActivityStatus(target as GraphNode) === 'inactive'

        const dx = target.x - source.x
        const dy = target.y - source.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len === 0) return

        const ux = dx / len
        const uy = dy / len

        const isDirect = link.type === 'DIRECT'
        const baseColor = isDirect ? [255, 144, 232] : [186, 139, 255]
        const alpha = inactive ? 0.12 : 0.35
        const arrowAlpha = inactive ? 0.2 : 0.6
        ctx.strokeStyle = `rgba(${baseColor.join(',')}, ${alpha})`
        ctx.lineWidth = isDirect ? 1 : 0.8
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()

        // Arrows every ~60px (minimum 2), skipping the one closest to the target to prevent bunching
        const arrowSpacing = 60
        const numArrows = Math.max(2, Math.floor(len / arrowSpacing))
        const arrowSize = inactive ? 3 : 5

        ctx.fillStyle = `rgba(${baseColor.join(',')}, ${arrowAlpha})`

        for (let i = 1; i < numArrows; i++) {
            const t = i / (numArrows + 1)
            const ax = source.x + dx * t
            const ay = source.y + dy * t

            ctx.beginPath()
            ctx.moveTo(ax + ux * arrowSize, ay + uy * arrowSize)
            ctx.lineTo(
                ax - ux * arrowSize * 0.5 - uy * arrowSize * 0.6,
                ay - uy * arrowSize * 0.5 + ux * arrowSize * 0.6
            )
            ctx.lineTo(
                ax - ux * arrowSize * 0.5 + uy * arrowSize * 0.6,
                ay - uy * arrowSize * 0.5 - ux * arrowSize * 0.6
            )
            ctx.closePath()
            ctx.fill()
        }
    }, [])

    return { nodeCanvasObject, linkCanvasObject }
}
