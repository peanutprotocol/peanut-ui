'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import InvitesGraph, { 
    DEFAULT_FORCE_CONFIG, 
    DEFAULT_VISIBILITY_CONFIG,
    DEFAULT_EXTERNAL_NODES_CONFIG,
} from '@/components/Global/InvitesGraph'

export default function InviteGraphPage() {
    const [apiKey, setApiKey] = useState('')
    const [apiKeySubmitted, setApiKeySubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleApiKeySubmit = useCallback(() => {
        if (!apiKey.trim()) {
            setError('Please enter an API key')
            return
        }
        setError(null)
        setApiKeySubmitted(true)
    }, [apiKey])

    const handleClose = useCallback(() => {
        window.location.href = '/dev'
    }, [])

    // API key input screen
    if (!apiKeySubmitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🕸️</div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Invite Graph</h2>
                        <p className="text-sm text-gray-600">
                            Admin tool - Enter your API key to visualize the network
                        </p>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-800 rounded-lg p-3 text-sm">
                            <div className="font-semibold">Error</div>
                            <div>{error}</div>
                        </div>
                    )}
                    <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleApiKeySubmit()}
                        placeholder="Admin API Key"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <Button onClick={handleApiKeySubmit} className="w-full">
                        Enter Graph
                    </Button>
                    <button
                        onClick={() => (window.location.href = '/dev')}
                        className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                        ← Back to Dev Tools
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
            <InvitesGraph
                apiKey={apiKey}
                onClose={handleClose}
                width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                height={typeof window !== 'undefined' ? window.innerHeight - 120 : 800}
                renderOverlays={({ 
                    showUsernames, setShowUsernames, 
                    showAllNodes, setShowAllNodes, 
                    activityFilter, setActivityFilter, 
                    forceConfig, setForceConfig, 
                    visibilityConfig, setVisibilityConfig,
                    externalNodesConfig, setExternalNodesConfig,
                    externalNodes, externalNodesLoading, externalNodesError,
                    handleReset, handleRecalculate,
                }) => (
                    <>
                        {/* Controls Panel - Top Right */}
                        <div className="absolute right-4 top-4 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm w-[200px] max-h-[calc(100vh-140px)] overflow-y-auto">
                            {/* FORCES + VISIBILITY merged */}
                            <h3 className="text-xs font-bold text-gray-900 mb-2">Display & Forces</h3>
                            
                            <div className="space-y-2 text-[11px]">
                                {/* Scale indicator */}
                                <div className="flex justify-between text-[8px] text-gray-400 -mb-1">
                                    <span>0.1×</span>
                                    <span>1×</span>
                                    <span>10×</span>
                                </div>

                                {/* Repulsion Force */}
                                <div className="space-y-0.5">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={forceConfig.charge.enabled}
                                                onChange={(e) => setForceConfig({ ...forceConfig, charge: { ...forceConfig.charge, enabled: e.target.checked } })}
                                                className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                            />
                                            <span className="text-gray-700">Repulsion Force</span>
                                        </div>
                                        {forceConfig.charge.enabled && (
                                            <span className="text-[9px] text-gray-500">
                                                {(forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength).toFixed(1)}x
                                            </span>
                                        )}
                                    </label>
                                    {forceConfig.charge.enabled && (
                                        <input
                                            type="range" min="-1" max="1" step="0.05"
                                            value={Math.log10(forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength)}
                                            onChange={(e) => setForceConfig({ ...forceConfig, charge: { ...forceConfig.charge, strength: DEFAULT_FORCE_CONFIG.charge.strength * Math.pow(10, parseFloat(e.target.value)) } })}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                    )}
                                </div>

                                {/* Invite Force + Edges (merged) */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="checkbox"
                                            checked={forceConfig.inviteLinks.enabled}
                                            onChange={(e) => {
                                                setForceConfig({ ...forceConfig, inviteLinks: { ...forceConfig.inviteLinks, enabled: e.target.checked } })
                                                setVisibilityConfig({ ...visibilityConfig, inviteEdges: e.target.checked })
                                            }}
                                            className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                        />
                                        <span className="text-gray-700">Invite Force</span>
                                        <span className="text-[9px] text-gray-400 ml-auto">+ edges</span>
                                    </div>
                                    {forceConfig.inviteLinks.enabled && (
                                        <input
                                            type="range" min="-1" max="1" step="0.05"
                                            value={Math.log10(forceConfig.inviteLinks.strength / DEFAULT_FORCE_CONFIG.inviteLinks.strength)}
                                            onChange={(e) => setForceConfig({ ...forceConfig, inviteLinks: { ...forceConfig.inviteLinks, strength: Math.min(1, DEFAULT_FORCE_CONFIG.inviteLinks.strength * Math.pow(10, parseFloat(e.target.value))) } })}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                    )}
                                </div>

                                {/* P2P Force + Edges (merged) */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="checkbox"
                                            checked={forceConfig.p2pLinks.enabled}
                                            onChange={(e) => {
                                                setForceConfig({ ...forceConfig, p2pLinks: { ...forceConfig.p2pLinks, enabled: e.target.checked } })
                                                setVisibilityConfig({ ...visibilityConfig, p2pEdges: e.target.checked })
                                            }}
                                            className="h-3 w-3 rounded border-gray-300 text-cyan-600"
                                        />
                                        <span className="text-gray-700">P2P Force</span>
                                        <span className="text-[9px] text-gray-400 ml-auto">+ edges</span>
                                    </div>
                                    {forceConfig.p2pLinks.enabled && (
                                        <input
                                            type="range" min="-1" max="1" step="0.05"
                                            value={Math.log10(forceConfig.p2pLinks.strength / DEFAULT_FORCE_CONFIG.p2pLinks.strength)}
                                            onChange={(e) => setForceConfig({ ...forceConfig, p2pLinks: { ...forceConfig.p2pLinks, strength: DEFAULT_FORCE_CONFIG.p2pLinks.strength * Math.pow(10, parseFloat(e.target.value)) } })}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-cyan-600"
                                        />
                                    )}
                                </div>

                                {/* Center Force */}
                                <div className="space-y-0.5">
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={forceConfig.centerGravity.enabled}
                                            onChange={(e) => setForceConfig({ ...forceConfig, centerGravity: { ...forceConfig.centerGravity, enabled: e.target.checked } })}
                                            className="h-3 w-3 rounded border-gray-300 text-amber-600"
                                        />
                                        <span className="text-gray-700">Center Force</span>
                                    </label>
                                    {forceConfig.centerGravity.enabled && (
                                        <input
                                            type="range" min="-1" max="1" step="0.05"
                                            value={Math.log10(forceConfig.centerGravity.strength / DEFAULT_FORCE_CONFIG.centerGravity.strength)}
                                            onChange={(e) => setForceConfig({ ...forceConfig, centerGravity: { ...forceConfig.centerGravity, strength: DEFAULT_FORCE_CONFIG.centerGravity.strength * Math.pow(10, parseFloat(e.target.value)) } })}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                                        />
                                    )}
                                </div>

                                {/* Size-Based Center (big → center) */}
                                <div className="space-y-0.5">
                                    <label className="flex items-center justify-between cursor-pointer">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={forceConfig.sizeBasedCenter?.enabled ?? DEFAULT_FORCE_CONFIG.sizeBasedCenter.enabled}
                                                onChange={(e) => setForceConfig({ ...forceConfig, sizeBasedCenter: { ...(forceConfig.sizeBasedCenter || DEFAULT_FORCE_CONFIG.sizeBasedCenter), enabled: e.target.checked } })}
                                                className="h-3 w-3 rounded border-gray-300 text-green-600"
                                            />
                                            <span className="text-gray-700">Size Hierarchy</span>
                                            <span className="text-[9px] text-gray-400">big→center</span>
                                        </div>
                                        {(forceConfig.sizeBasedCenter?.enabled ?? DEFAULT_FORCE_CONFIG.sizeBasedCenter.enabled) && (
                                            <span className="text-[9px] text-gray-500">
                                                {((forceConfig.sizeBasedCenter?.strength ?? DEFAULT_FORCE_CONFIG.sizeBasedCenter.strength) / DEFAULT_FORCE_CONFIG.sizeBasedCenter.strength).toFixed(1)}x
                                            </span>
                                        )}
                                    </label>
                                    {(forceConfig.sizeBasedCenter?.enabled ?? DEFAULT_FORCE_CONFIG.sizeBasedCenter.enabled) && (
                                        <input
                                            type="range" min="-1" max="1" step="0.05"
                                            value={Math.log10((forceConfig.sizeBasedCenter?.strength ?? DEFAULT_FORCE_CONFIG.sizeBasedCenter.strength) / DEFAULT_FORCE_CONFIG.sizeBasedCenter.strength)}
                                            onChange={(e) => setForceConfig({ ...forceConfig, sizeBasedCenter: { ...(forceConfig.sizeBasedCenter || DEFAULT_FORCE_CONFIG.sizeBasedCenter), strength: DEFAULT_FORCE_CONFIG.sizeBasedCenter.strength * Math.pow(10, parseFloat(e.target.value)) } })}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                                        />
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-200 my-1"></div>

                                {/* External Nodes Section */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="checkbox"
                                            checked={externalNodesConfig.enabled}
                                            onChange={(e) => setExternalNodesConfig({ ...externalNodesConfig, enabled: e.target.checked })}
                                            className="h-3 w-3 rounded border-gray-300 text-orange-600"
                                        />
                                        <span className="text-gray-700">External Nodes</span>
                                        <span className="text-[9px]" title="Experimental feature">⚠️</span>
                                        {externalNodesLoading && <span className="text-[9px] text-orange-500 animate-pulse ml-auto">loading...</span>}
                                        {externalNodesError && <span className="text-[9px] text-red-500 ml-auto" title={externalNodesError}>❌</span>}
                                        {!externalNodesLoading && !externalNodesError && externalNodesConfig.enabled && (
                                            <span className="text-[9px] text-gray-400 ml-auto">{externalNodes.length}</span>
                                        )}
                                    </div>
                                    {externalNodesError && externalNodesConfig.enabled && (
                                        <div className="pl-4 text-[10px] text-red-600">
                                            Failed to load. Check console.
                                        </div>
                                    )}
                                    {!externalNodesError && externalNodesConfig.enabled && (
                                        <div className="pl-4 space-y-1.5">
                                            {/* Min connections slider - show only external addresses used by N+ users */}
                                            <div className="space-y-0.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] text-gray-500">Show if ≥{externalNodesConfig.minConnections} users</span>
                                                </div>
                                                <input
                                                    type="range" min="2" max="20" step="1"
                                                    value={externalNodesConfig.minConnections}
                                                    onChange={(e) => setExternalNodesConfig({ ...externalNodesConfig, minConnections: parseInt(e.target.value) })}
                                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                                                />
                                            </div>
                                            {/* Type filters */}
                                            <div className="flex gap-2 text-[9px]">
                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.WALLET}
                                                        onChange={(e) => setExternalNodesConfig({ 
                                                            ...externalNodesConfig, 
                                                            types: { ...externalNodesConfig.types, WALLET: e.target.checked } 
                                                        })}
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-orange-500"
                                                    />
                                                    <span className="text-orange-600">💳</span>
                                                </label>
                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.BANK}
                                                        onChange={(e) => setExternalNodesConfig({ 
                                                            ...externalNodesConfig, 
                                                            types: { ...externalNodesConfig.types, BANK: e.target.checked } 
                                                        })}
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-blue-500"
                                                    />
                                                    <span className="text-blue-600">🏦</span>
                                                </label>
                                                <label className="flex items-center gap-0.5 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.MERCHANT}
                                                        onChange={(e) => setExternalNodesConfig({ 
                                                            ...externalNodesConfig, 
                                                            types: { ...externalNodesConfig.types, MERCHANT: e.target.checked } 
                                                        })}
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-green-500"
                                                    />
                                                    <span className="text-green-600">🏪</span>
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-gray-200 my-1"></div>

                                {/* Node visibility */}
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={visibilityConfig.activeNodes}
                                            onChange={(e) => setVisibilityConfig({ ...visibilityConfig, activeNodes: e.target.checked })}
                                            className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                        />
                                        <span className="text-gray-600">Active</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={visibilityConfig.inactiveNodes}
                                            onChange={(e) => setVisibilityConfig({ ...visibilityConfig, inactiveNodes: e.target.checked })}
                                            className="h-3 w-3 rounded border-gray-300 text-gray-400"
                                        />
                                        <span className="text-gray-600">Inactive</span>
                                    </label>
                                </div>

                                {/* Other options */}
                                <div className="flex gap-3">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showUsernames}
                                            onChange={(e) => setShowUsernames(e.target.checked)}
                                            className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                        />
                                        <span className="text-gray-600">Names</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={showAllNodes}
                                            onChange={(e) => setShowAllNodes(e.target.checked)}
                                            className="h-3 w-3 rounded border-gray-300 text-red-600"
                                        />
                                        <span className="text-gray-600">All nodes</span>
                                    </label>
                                </div>

                                {/* Activity window */}
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500">Active =</span>
                                    <select
                                        value={activityFilter.activityDays}
                                        onChange={(e) => setActivityFilter({ ...activityFilter, activityDays: parseInt(e.target.value), enabled: true })}
                                        className="flex-1 rounded border border-gray-200 px-1 py-0.5 text-[10px]"
                                    >
                                        <option value={7}>7d</option>
                                        <option value={14}>14d</option>
                                        <option value={30}>30d</option>
                                        <option value={60}>60d</option>
                                        <option value={90}>90d</option>
                                    </select>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleRecalculate}
                                        className="flex-1 px-2 py-0.5 text-[9px] text-purple-600 hover:text-purple-800 border border-purple-200 rounded hover:bg-purple-50"
                                        title="Recalculate layout with current settings"
                                    >
                                        🔄 Recalc
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="flex-1 px-2 py-0.5 text-[9px] text-gray-500 hover:text-gray-700 border border-gray-200 rounded hover:bg-gray-50"
                                        title="Reset all settings to defaults"
                                    >
                                        ↺ Defaults
                                    </button>
                                </div>
                            </div>

                            {/* Compact Legend */}
                            <div className="mt-3 pt-2 border-t border-gray-200">
                                <div className="space-y-1 text-[9px]">
                                    {/* Nodes */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full bg-purple-500"></span>Active</span>
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full bg-gray-400 opacity-40"></span>Inactive</span>
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rounded-full border border-black bg-gray-300"></span>Jailed</span>
                                    </div>
                                    {/* External nodes */}
                                    {externalNodesConfig.enabled && (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 rotate-45 bg-orange-500"></span>Wallet</span>
                                            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 bg-blue-500"></span>Bank</span>
                                            <span className="flex items-center gap-0.5"><span className="inline-block h-2 w-2 bg-green-500" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></span>Merchant</span>
                                        </div>
                                    )}
                                    {/* Edges */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-0.5 w-3 bg-purple-500/50"></span>Invite</span>
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-0.5 w-3 bg-pink-500/50"></span>Payment</span>
                                        <span className="flex items-center gap-0.5"><span className="inline-block h-0.5 w-3 bg-cyan-500/50"></span>P2P</span>
                                    </div>
                                    <p className="text-gray-400">Click → Grafana | Right-click → Focus</p>
                                    {!showAllNodes && <p className="text-gray-400">Showing top 5000 nodes</p>}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            />
        </div>
    )
}
