'use client'

import type { MutableRefObject, ReactNode } from 'react'
import { inferBankAccountType } from '@/utils/bridge.utils'
import { ForceGraph2D } from './ForceGraph2D'
import { type GraphDisplaySettings, type GraphOverlayProps } from './types'
import { getExternalNodeUsers, getNodePoints } from './utils'

interface FullGraphCanvasProps {
    graphRef: MutableRefObject<any>
    combinedGraphNodes: any[]
    combinedLinks: any[]
    displaySettingsRef: MutableRefObject<GraphDisplaySettings>
    inviterMap: Map<string, string>
    graphWidth: number
    graphHeight: number
    nodeCanvasObject: (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
    linkCanvasObject: (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => void
    handleNodeClick: (node: any) => void
    handleNodeRightClick: (node: any) => void
    handleNodeDragStart: (node: any, translate: any) => void
    handleNodeDrag: (node: any) => void
    handleNodeDragEnd: () => void
    handleEngineStop: () => void
    renderOverlays?: (props: GraphOverlayProps) => ReactNode
    overlayProps: GraphOverlayProps
}

/** Full-mode graph canvas: ForceGraph2D with rich tooltips plus the overlay render prop */
export function FullGraphCanvas({
    graphRef,
    combinedGraphNodes,
    combinedLinks,
    displaySettingsRef,
    inviterMap,
    graphWidth,
    graphHeight,
    nodeCanvasObject,
    linkCanvasObject,
    handleNodeClick,
    handleNodeRightClick,
    handleNodeDragStart,
    handleNodeDrag,
    handleNodeDragEnd,
    handleEngineStop,
    renderOverlays,
    overlayProps,
}: FullGraphCanvasProps) {
    return (
        <div className="relative flex-1" style={{ touchAction: 'none' }}>
            <ForceGraph2D
                ref={graphRef}
                graphData={{
                    nodes: combinedGraphNodes,
                    links: combinedLinks,
                }}
                nodeId="id"
                nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    // Draw hit detection area matching actual rendered node size
                    let size: number
                    if (node.isExternal) {
                        size = 4 + Math.log2(getExternalNodeUsers(node)) * 2
                    } else {
                        const hasAccess = node.hasAppAccess
                        const baseSize = hasAccess ? 6 : 3
                        const pointsMultiplier = Math.sqrt(getNodePoints(node)) / 10
                        size = baseSize + Math.min(pointsMultiplier, 25)
                    }
                    ctx.fillStyle = color
                    ctx.beginPath()
                    ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI) // +2 for easier hover
                    ctx.fill()
                }}
                nodeLabel={(node: any) => {
                    const currentMode = displaySettingsRef.current.mode
                    const isAnonymized = currentMode === 'payment'

                    // External node tooltip
                    if (node.isExternal) {
                        const fullId = node.id.replace('ext_', '')
                        const typeLabel =
                            node.externalType === 'WALLET'
                                ? '💳 Wallet'
                                : node.externalType === 'BANK'
                                  ? `🏦 ${inferBankAccountType(fullId)}`
                                  : '🏪 Merchant'

                        // Show only masked labels for all types
                        const displayLabel = node.externalType === 'BANK' ? 'Account' : 'ID'

                        // Anonymized mode: show qualitative labels instead of exact values
                        if (isAnonymized) {
                            // In payment mode, uniqueUsers is not sent - use size label or userIds count
                            const userCount = node.uniqueUsers ?? (node.userIds?.length || 0)
                            const userDisplay = node.size || userCount

                            return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 280px; padding: 12px 14px;">
                                <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${typeLabel}</div>
                                <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                    <div style="margin-bottom: 4px; word-break: break-all;">🏷️ ${displayLabel}: <span style="color: #374151; font-weight: 600;">${node.label}</span></div>
                                    <div style="margin-bottom: 4px;">👥 Users: <span style="color: #374151;">${userDisplay}</span></div>
                                    <div style="margin-bottom: 4px;">📊 Activity: <span style="color: #374151;">${node.frequency || 'N/A'}</span></div>
                                    <div>💵 Volume: <span style="color: #374151;">${node.volume || 'N/A'}</span></div>
                                </div>
                            </div>`
                        }

                        return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 280px; padding: 12px 14px;">
                            <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${typeLabel}</div>
                            <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                                <div style="margin-bottom: 4px; word-break: break-all;">🏷️ ${displayLabel}: <span style="color: #374151; font-weight: 600;">${node.label}</span></div>
                                <div style="margin-bottom: 4px;">👥 Users: <span style="color: #374151;">${node.uniqueUsers ?? (node.userIds?.length || 0)}</span></div>
                                <div style="margin-bottom: 4px;">📊 Transactions: <span style="color: #374151;">${node.txCount ?? 'N/A'}</span></div>
                                <div>💵 Volume: <span style="color: #374151;">$${(node.totalUsd || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                            </div>
                        </div>`
                    }

                    // User node tooltip - anonymized in payment mode (minimal, no status)
                    if (isAnonymized) {
                        return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 240px; padding: 12px 14px; box-shadow: none;">
                            <div style="font-weight: 700; font-size: 14px; color: #1f2937; font-family: monospace;">${node.username || 'User'}</div>
                        </div>`
                    }

                    // Full mode: show all details
                    const signupDate = node.createdAt ? new Date(node.createdAt).toLocaleDateString() : 'Unknown'
                    const lastActive = node.lastActiveAt ? new Date(node.lastActiveAt).toLocaleDateString() : 'Never'
                    const invitedBy = inviterMap.get(node.id)
                    // KYC region display with flags
                    const kycFlags: Record<string, string> = {
                        AR: '🇦🇷',
                        BR: '🇧🇷',
                        World: '🌍',
                    }
                    const kycDisplay = node.kycRegions?.length
                        ? node.kycRegions.map((r: string) => `${kycFlags[r] || ''}${r}`).join(', ')
                        : null
                    return `<div style="background: white; border-radius: 8px; border: 1px solid #e5e7eb; font-family: Inter, system-ui, sans-serif; max-width: 240px; padding: 12px 14px; box-shadow: none;">
                        <div style="font-weight: 700; margin-bottom: 8px; font-size: 14px; color: #1f2937;">${node.username}</div>
                        <div style="font-size: 12px; line-height: 1.6; color: #6b7280;">
                            <div style="margin-bottom: 4px;">📅 Signed up: <span style="color: #374151;">${signupDate}</span></div>
                            <div style="margin-bottom: 4px;">⚡ Last active: <span style="color: #374151;">${lastActive}</span></div>
                            ${invitedBy ? `<div style="margin-bottom: 4px;">👤 Invited by: <span style="color: #8b5cf6; font-weight: 500;">${invitedBy}</span></div>` : ''}
                            <div style="margin-bottom: 4px;">${node.hasAppAccess ? '<span style="color: #10b981;">✓ Has Access</span>' : '<span style="color: #f59e0b;">⏳ Jailed</span>'}</div>
                            ${kycDisplay ? `<div style="margin-bottom: 4px;">🪪 KYC: <span style="color: #374151;">${kycDisplay}</span></div>` : ''}
                            ${
                                node.totalPoints
                                    ? `<div style="margin-top: 6px; padding-top: 6px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px;">
                                ${node.totalPoints.toLocaleString()} pts (${node.directPoints} direct, ${node.transitivePoints} trans)
                            </div>`
                                    : ''
                            }
                        </div>
                    </div>`
                }}
                nodeCanvasObject={nodeCanvasObject}
                nodeCanvasObjectMode={() => 'replace'}
                linkLabel={(link: any) => {
                    if (link.isP2P) {
                        // Handle both full (count/totalUsd) and anonymized (frequency/volume) modes
                        if (link.frequency && link.volume) {
                            return `P2P: ${link.frequency} activity, ${link.volume} volume`
                        }
                        return `P2P: ${link.count} txs ($${link.totalUsd?.toFixed(2) ?? '0'})`
                    }
                    if (link.isExternal) {
                        // Handle both full and anonymized modes
                        if (link.frequency && link.volume) {
                            return `Merchant: ${link.frequency} activity, ${link.volume} volume`
                        }
                        return `External: ${link.txCount} txs ($${link.totalUsd?.toFixed(2) ?? '0'})`
                    }
                    return `${link.type} - ${new Date(link.createdAt).toLocaleDateString()}`
                }}
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
                d3AlphaDecay={0.005}
                d3VelocityDecay={0.6}
                d3AlphaMin={0.001}
                onEngineStop={handleEngineStop}
                backgroundColor="#FAF4F0"
                width={graphWidth}
                height={graphHeight}
                autoPauseRedraw={false}
            />

            {/* Render overlays (legend, mobile controls) via render prop */}
            {renderOverlays?.(overlayProps)}
        </div>
    )
}
