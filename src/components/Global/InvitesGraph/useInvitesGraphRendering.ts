import { useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import {
    type ActivityFilter,
    type ExternalNodesConfig,
    type GraphDisplaySettings,
    type GraphMode,
    type GraphNode,
    type VisibilityConfig,
} from './types'
import { getExternalNodeUsers, getNodePoints } from './utils'

interface UseInvitesGraphRenderingParams {
    displaySettingsRef: MutableRefObject<GraphDisplaySettings>
    showUsernames: boolean
    selectedUserId: string | null
    isMinimal: boolean
    mode: GraphMode
    activityFilter: ActivityFilter
    visibilityConfig: VisibilityConfig
    externalNodesConfig: ExternalNodesConfig
    p2pActiveNodes: Set<string>
    inviterNodes: Set<string>
    hiddenStatuses: Set<string>
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
    isMinimal,
    mode,
    activityFilter,
    visibilityConfig,
    externalNodesConfig,
    p2pActiveNodes,
    inviterNodes,
    hiddenStatuses,
}: UseInvitesGraphRenderingParams) {
    // Track display settings with ref to avoid re-renders
    // NOTE: These settings only affect RENDERING, not force simulation
    // visibilityConfig changes will hide/show elements without recalculating forces
    useEffect(() => {
        displaySettingsRef.current = {
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
        }
    }, [
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
    ])

    // Helper to determine user activity status
    const getUserActivityStatus = useCallback(
        (node: GraphNode, filter: ActivityFilter): 'new' | 'active' | 'inactive' => {
            if (!filter.enabled) return 'active' // No filtering, show all as active

            // In payment mode, all nodes shown as active (no inactive differentiation)
            // Backend already sets lastActiveAt to now, but check mode to be safe
            if (mode === 'payment') return 'active'

            const now = Date.now()
            const activityCutoff = now - filter.activityDays * 24 * 60 * 60 * 1000

            // Check if signed up within activity window (NEW user)
            const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
            const isNewSignup = createdAtMs >= activityCutoff

            // Check if had tx within activity window
            const hasRecentActivity = node.lastActiveAt
                ? new Date(node.lastActiveAt).getTime() >= activityCutoff
                : false

            // Priority: New signup > Active > Inactive
            if (isNewSignup) return 'new'
            if (hasRecentActivity) return 'active'
            return 'inactive'
        },
        [mode]
    )

    // Node styling
    const nodeCanvasObject = useCallback(
        (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const {
                selectedUserId: selId,
                showUsernames: showNames,
                isMinimal: minimal,
                activityFilter: filter,
                externalNodesConfig: extConfig,
            } = displaySettingsRef.current

            // ============================================
            // EXTERNAL NODE RENDERING (different shapes)
            // ============================================
            if (node.isExternal) {
                if (!extConfig.enabled) return // Hidden

                const size = 4 + Math.log2(getExternalNodeUsers(node)) * 2

                // Colors by type
                const colors: Record<string, string> = {
                    WALLET: '#FFC900', // secondary-1 (yellow)
                    BANK: '#90A8ED', // secondary-3 (blue)
                    MERCHANT: '#BA8BFF', // primary-4 (purple)
                }
                const fillColor = colors[node.externalType] || '#9CA3AF'

                ctx.globalAlpha = 0.8
                ctx.fillStyle = fillColor
                ctx.strokeStyle = fillColor
                ctx.lineWidth = 1.5

                // Different shapes by type
                if (node.externalType === 'WALLET') {
                    // Diamond shape for wallets
                    ctx.beginPath()
                    ctx.moveTo(node.x, node.y - size)
                    ctx.lineTo(node.x + size, node.y)
                    ctx.lineTo(node.x, node.y + size)
                    ctx.lineTo(node.x - size, node.y)
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                } else if (node.externalType === 'BANK') {
                    // Square shape for banks
                    ctx.beginPath()
                    ctx.rect(node.x - size, node.y - size, size * 2, size * 2)
                    ctx.fill()
                    ctx.stroke()
                } else {
                    // Hexagon shape for merchants
                    ctx.beginPath()
                    for (let i = 0; i < 6; i++) {
                        const angle = (Math.PI / 3) * i - Math.PI / 6
                        const x = node.x + size * Math.cos(angle)
                        const y = node.y + size * Math.sin(angle)
                        if (i === 0) ctx.moveTo(x, y)
                        else ctx.lineTo(x, y)
                    }
                    ctx.closePath()
                    ctx.fill()
                    ctx.stroke()
                }

                // Label for external nodes (show at closer zoom)
                if (showNames && globalScale > 1.0) {
                    const fontSize = 10 / globalScale
                    ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'middle'
                    ctx.globalAlpha = 0.7
                    ctx.fillStyle = '#374151'
                    ctx.fillText(node.label, node.x, node.y + size + fontSize + 2)
                }

                ctx.globalAlpha = 1
                return
            }

            // ============================================
            // USER NODE RENDERING (circles)
            // ============================================
            const isSelected = node.id === selId
            const hasAccess = node.hasAppAccess
            const { mode: currentMode } = displaySettingsRef.current

            // Determine activity status for coloring
            // Note: Visibility filtering is done at data level, so hidden nodes never reach here
            const activityStatus = getUserActivityStatus(node, filter)

            // In user mode: all nodes same size (larger for cleaner display)
            // In other modes: size based on points
            let size: number
            if (currentMode === 'user') {
                size = 12 // Fixed size for user graph - all nodes equal
            } else {
                const baseSize = hasAccess ? 6 : 3
                const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                size = baseSize + Math.min(pointsMultiplier, 25)
            }

            // ===========================================
            // NODE STYLING: Fill + Outline are separate
            // ===========================================
            // In USER mode: All nodes same purple color (unified appearance)
            // In PAYMENT mode: Color by P2P activity (purple = has P2P, grey = no P2P)
            // In FULL mode: Color based on activity status
            // OUTLINE: Based on access/selection
            //   - Jailed (no app access): black (#000000)
            //   - Selected: golden (#fbbf24)
            //   - Normal: none
            // ===========================================

            let fillColor: string
            const { p2pActiveNodes: p2pNodes } = displaySettingsRef.current

            if (currentMode === 'user') {
                // User mode: all nodes same pink (primary-1 #FF90E8), fully opaque
                fillColor = 'rgb(255, 144, 232)' // primary-1
            } else if (currentMode === 'payment') {
                // Payment mode: color by P2P participation (sending or receiving)
                const hasP2PActivity = p2pNodes.has(node.id)
                fillColor = hasP2PActivity
                    ? 'rgba(255, 144, 232, 0.85)' // primary-1 for P2P active
                    : 'rgba(156, 163, 175, 0.5)' // Grey for no P2P
            } else if (!filter.enabled) {
                // No filter - simple active/inactive by access
                fillColor = hasAccess ? 'rgba(255, 144, 232, 0.85)' : 'rgba(156, 163, 175, 0.85)'
            } else {
                // Activity filter enabled - three states
                if (activityStatus === 'new') {
                    fillColor = 'rgba(74, 222, 128, 0.85)' // green-400 for new signups
                } else if (activityStatus === 'active') {
                    fillColor = 'rgba(255, 144, 232, 0.85)' // primary-1 for active
                } else {
                    // Inactive - exponential time bands with distinct shades
                    const now = Date.now()
                    const createdAtMs = node.createdAt ? new Date(node.createdAt).getTime() : 0
                    const lastActiveMs = node.lastActiveAt ? new Date(node.lastActiveAt).getTime() : 0
                    const lastActivityMs = Math.max(createdAtMs, lastActiveMs)
                    const daysSinceActivity = (now - lastActivityMs) / (24 * 60 * 60 * 1000)

                    // Exponential time bands: 1w, 2w, 4w, 8w, 16w, 32w, 64w+
                    // Each band gets progressively lighter gray
                    if (daysSinceActivity < 7) {
                        fillColor = 'rgba(80, 80, 80, 0.9)' // Very dark gray - <1 week
                    } else if (daysSinceActivity < 14) {
                        fillColor = 'rgba(100, 100, 100, 0.85)' // Dark gray - 1-2 weeks
                    } else if (daysSinceActivity < 28) {
                        fillColor = 'rgba(120, 120, 120, 0.8)' // Medium-dark - 2-4 weeks
                    } else if (daysSinceActivity < 56) {
                        fillColor = 'rgba(145, 145, 145, 0.7)' // Medium gray - 4-8 weeks
                    } else if (daysSinceActivity < 112) {
                        fillColor = 'rgba(170, 170, 170, 0.6)' // Medium-light - 8-16 weeks
                    } else if (daysSinceActivity < 224) {
                        fillColor = 'rgba(195, 195, 195, 0.5)' // Light gray - 16-32 weeks
                    } else if (daysSinceActivity < 448) {
                        fillColor = 'rgba(215, 215, 215, 0.4)' // Very light - 32-64 weeks
                    } else {
                        fillColor = 'rgba(235, 235, 235, 0.3)' // Almost invisible - 64+ weeks
                    }
                }
            }

            // Check if this node's status is hidden via legend toggle
            const { hiddenStatuses: hidden } = displaySettingsRef.current
            const isJailed = !hasAccess
            const isHidden = hidden.size > 0 && (hidden.has(activityStatus) || (isJailed && hidden.has('jailed')))
            if (isHidden) {
                ctx.globalAlpha = 0.03 // Nearly invisible but keeps layout stable
            }

            // Draw fill
            ctx.beginPath()
            ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
            ctx.fillStyle = fillColor
            ctx.fill()

            // Draw outline based on access/selection (skip if hidden)
            if (!isHidden) {
                ctx.globalAlpha = 1
                if (isSelected) {
                    // Selected: golden outline
                    ctx.strokeStyle = '#FFC900'
                    ctx.lineWidth = 3
                    ctx.stroke()
                } else if (!hasAccess) {
                    // Jailed (no app access): black outline
                    ctx.strokeStyle = '#000000'
                    ctx.lineWidth = 2
                    ctx.stroke()
                }
            }

            ctx.globalAlpha = 1 // Reset alpha

            // In minimal mode, always show labels; otherwise require closer zoom
            if (!isHidden && showNames && (minimal || globalScale > 1.2)) {
                const label = node.username
                const fontSize = minimal ? 4 : 12 / globalScale
                const { inviterNodes: inviterNodesSet } = displaySettingsRef.current
                const isInviter = inviterNodesSet && inviterNodesSet.has(node.id)

                ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillStyle = activityStatus === 'inactive' && filter.enabled ? 'rgba(17, 24, 39, 0.3)' : '#111827'

                const labelY = node.y + size + fontSize + 2

                // Render username
                ctx.fillText(label, node.x, labelY)

                // Add heart icon for inviters in minimal/user mode
                if (minimal && isInviter) {
                    // Measure text to position heart after it
                    const textWidth = ctx.measureText(label).width
                    const heartX = node.x + textWidth / 2 + fontSize * 0.6
                    const heartY = labelY
                    const heartSize = fontSize * 0.7

                    // Draw simple heart shape (pink/magenta)
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
            }

            // points particle arrival popups removed (rewards v2 separates points from rewards)
        },
        [getUserActivityStatus]
    )

    // Helper to check if link connects to inactive node (for faded coloring)
    const isLinkInactive = useCallback(
        (link: any) => {
            const { activityFilter } = displaySettingsRef.current
            const sourceNode = link.source as GraphNode
            const targetNode = link.target as GraphNode
            const sourceStatus = getUserActivityStatus(sourceNode, activityFilter)
            const targetStatus = getUserActivityStatus(targetNode, activityFilter)
            return sourceStatus === 'inactive' || targetStatus === 'inactive'
        },
        [getUserActivityStatus]
    )

    const _linkColor = useCallback(
        (link: any) => {
            // P2P edges: cyan/teal - solid line, particles show movement
            if (link.isP2P) {
                if (isLinkInactive(link)) {
                    return 'rgba(6, 182, 212, 0.08)' // Very faint cyan
                }
                return 'rgba(6, 182, 212, 0.25)' // Subtle cyan for P2P
            }
            // Invite edges - solid with arrows
            if (isLinkInactive(link)) {
                return 'rgba(156, 163, 175, 0.12)' // Grey, very transparent
            }
            return link.type === 'DIRECT' ? 'rgba(139, 92, 246, 0.35)' : 'rgba(236, 72, 153, 0.35)'
        },
        [isLinkInactive]
    )

    // Custom link rendering for arrows on invites and particles on P2P
    const linkCanvasObject = useCallback(
        (link: any, ctx: CanvasRenderingContext2D, _globalScale: number) => {
            const { externalNodesConfig: extConfig } = displaySettingsRef.current
            const source = link.source
            const target = link.target

            if (!source.x || !target.x) return

            // Check visibility for external nodes only (filtered at data level for edges)
            if (link.isExternal && !extConfig.enabled) return

            const inactive = isLinkInactive(link)

            // Calculate line geometry
            const dx = target.x - source.x
            const dy = target.y - source.y
            const len = Math.sqrt(dx * dx + dy * dy)
            if (len === 0) return

            const ux = dx / len // Unit vector x
            const uy = dy / len // Unit vector y

            // ============================================
            // EXTERNAL LINK RENDERING (with animated particles scaling by volume/count)
            // ============================================
            if (link.isExternal) {
                // Get target node type for color
                const extType = target.externalType || 'WALLET'
                const lineColors: Record<string, string> = {
                    WALLET: 'rgba(255, 201, 0, 0.25)', // secondary-1
                    BANK: 'rgba(144, 168, 237, 0.25)', // secondary-3
                    MERCHANT: 'rgba(186, 139, 255, 0.25)', // primary-4
                }
                const particleColors: Record<string, string> = {
                    WALLET: 'rgba(255, 201, 0, 0.8)', // secondary-1
                    BANK: 'rgba(144, 168, 237, 0.8)', // secondary-3
                    MERCHANT: 'rgba(186, 139, 255, 0.8)', // primary-4
                }

                // Convert frequency/volume labels to numeric values for rendering
                // Full mode: use actual values; Anonymized mode: map labels to ranges
                const frequencyMap = { rare: 1, occasional: 3, regular: 10, frequent: 30 }
                const volumeMap = { small: 50, medium: 500, large: 5000, whale: 50000 }

                const txCount = link.txCount ?? frequencyMap[link.frequency as keyof typeof frequencyMap] ?? 1
                const usdVolume = link.totalUsd ?? volumeMap[link.volume as keyof typeof volumeMap] ?? 50

                // Scale line width by transaction count (same formula as P2P)
                const lineWidth = Math.min(0.4 + txCount * 0.25, 3.0)

                // Draw base line
                ctx.strokeStyle = lineColors[extType] || 'rgba(156, 163, 175, 0.25)'
                ctx.lineWidth = lineWidth
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles with direction based on actual fund flow
                const time = performance.now()
                // Logarithmic scaling for better visual distinction
                const logTxCount = Math.log10(Math.max(txCount, 1) + 1)
                const logUsd = Math.log10(Math.max(usdVolume, 1) + 1)

                // Speed: 0.0002 (1tx) → 0.0008 (100tx) using log scale
                const baseSpeed = 0.0002 + logTxCount * 0.0003
                const speed = baseSpeed

                // Particle count: 1 → 4 particles, log-scaled
                const particleCount = Math.min(1 + Math.floor(logTxCount * 1.5), 4)
                // Size: 1.5 (small) → 6.0 (large), log-scaled by USD volume
                const particleSize = 1.5 + logUsd * 2.25

                ctx.fillStyle = particleColors[extType] || 'rgba(107, 114, 128, 0.8)'

                // Determine particle direction based on fund flow
                const isIncoming = link.direction === 'INCOMING'

                // Draw particles along the edge
                for (let i = 0; i < particleCount; i++) {
                    const t = (time * speed + i / particleCount) % 1
                    // OUTGOING: flow from source (user) to target (external) → t goes 0→1
                    // INCOMING: flow from target (external) to source (user) → t goes 1→0 (use 1-t)
                    const progress = isIncoming ? 1 - t : t
                    const px = source.x + dx * progress
                    const py = source.y + dy * progress
                    ctx.beginPath()
                    ctx.arc(px, py, particleSize, 0, 2 * Math.PI)
                    ctx.fill()
                }

                return
            }

            if (link.isP2P) {
                // P2P: Draw line with animated particles (scaled by activity & volume)
                // Supports both full mode (count/totalUsd) and anonymized mode (frequency/volume labels)
                const baseAlpha = inactive ? 0.08 : 0.25
                ctx.strokeStyle = `rgba(144, 168, 237, ${baseAlpha})`

                // Convert frequency/volume labels to numeric values for rendering
                // Full mode: use actual values; Anonymized mode: map labels to ranges
                const frequencyMap = { rare: 1, occasional: 3, regular: 10, frequent: 30 }
                const volumeMap = { small: 50, medium: 500, large: 5000, whale: 50000 }

                const txCount = link.count ?? frequencyMap[link.frequency as keyof typeof frequencyMap] ?? 1
                const usdVolume = link.totalUsd ?? volumeMap[link.volume as keyof typeof volumeMap] ?? 50

                // Line width: 0.4 (min) → 3.0 (max) based on tx count
                ctx.lineWidth = Math.min(0.4 + txCount * 0.25, 3.0)
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                // Animated particles for P2P
                if (!inactive) {
                    const time = performance.now()
                    // Logarithmic scaling for better visual distinction
                    const logTxCount = Math.log10(Math.max(txCount, 1) + 1)
                    const logUsd = Math.log10(Math.max(usdVolume, 1) + 1)

                    // Particle count: 1 → 5 particles, log-scaled
                    const particleCount = Math.min(1 + Math.floor(logTxCount * 2), 5)
                    // Speed: 0.0003 (1tx) → 0.001 (100tx) using log scale
                    const baseSpeed = 0.0003 + logTxCount * 0.00035
                    const speed = baseSpeed

                    // Size: 1.5 (small) → 6.0 (large), log-scaled by USD volume
                    const particleSize = 1.5 + logUsd * 2.25
                    const isBidirectional = link.bidirectional === true

                    ctx.fillStyle = 'rgba(144, 168, 237, 0.85)'

                    for (let i = 0; i < particleCount; i++) {
                        // Forward direction (source → target)
                        const t1 = (time * speed + i / particleCount) % 1
                        const px1 = source.x + dx * t1
                        const py1 = source.y + dy * t1
                        ctx.beginPath()
                        ctx.arc(px1, py1, particleSize, 0, 2 * Math.PI)
                        ctx.fill()

                        // Reverse direction only if bidirectional
                        if (isBidirectional) {
                            const t2 = (time * speed * 0.85 + (i + 0.5) / particleCount) % 1
                            const px2 = target.x - dx * t2
                            const py2 = target.y - dy * t2
                            ctx.beginPath()
                            ctx.arc(px2, py2, particleSize * 0.85, 0, 2 * Math.PI)
                            ctx.fill()
                        }
                    }
                }
            } else {
                // Invite: Draw line with multiple arrows along the edge
                const isDirect = link.type === 'DIRECT'
                const baseColor = isDirect ? [255, 144, 232] : [186, 139, 255]
                const alpha = inactive ? 0.12 : 0.35
                const arrowAlpha = inactive ? 0.2 : 0.6
                // Draw main line
                ctx.strokeStyle = `rgba(${baseColor.join(',')}, ${alpha})`
                ctx.lineWidth = isDirect ? 1 : 0.8
                ctx.beginPath()
                ctx.moveTo(source.x, source.y)
                ctx.lineTo(target.x, target.y)
                ctx.stroke()

                {
                    // Full/Payment mode: Draw arrows along the line (every ~60px, minimum 2)
                    // Skip the last arrow to prevent bunching near target node
                    const arrowSpacing = 60
                    const numArrows = Math.max(2, Math.floor(len / arrowSpacing))
                    const arrowSize = inactive ? 3 : 5

                    ctx.fillStyle = `rgba(${baseColor.join(',')}, ${arrowAlpha})`

                    // Draw arrows from source toward target, but skip the last one (closest to target)
                    for (let i = 1; i < numArrows; i++) {
                        // Changed: i < numArrows instead of i <= numArrows
                        const t = i / (numArrows + 1)
                        const ax = source.x + dx * t
                        const ay = source.y + dy * t

                        // Draw arrow head pointing in direction of edge
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
                }
            }
        },
        [isLinkInactive]
    )

    return { nodeCanvasObject, linkCanvasObject }
}
