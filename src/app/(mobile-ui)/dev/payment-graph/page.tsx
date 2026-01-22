'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import InvitesGraph, { DEFAULT_FORCE_CONFIG } from '@/components/Global/InvitesGraph'

export default function PaymentGraphPage() {
    const searchParams = useSearchParams()
    const [password, setPassword] = useState('')
    const [passwordSubmitted, setPasswordSubmitted] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // Performance mode: limit to 1000 top nodes
    const [performanceMode, setPerformanceMode] = useState(false)

    // Check for password in URL on mount
    useEffect(() => {
        const urlPassword = searchParams.get('password')
        if (urlPassword) {
            setPassword(urlPassword)
            setPasswordSubmitted(true)
        }
    }, [searchParams])

    const handlePasswordSubmit = useCallback(() => {
        if (!password.trim()) {
            setError('Please enter a password')
            return
        }
        setError(null)
        setPasswordSubmitted(true)
    }, [password])

    const handleClose = useCallback(() => {
        window.location.href = '/dev'
    }, [])

    // Password input screen (only shown if not provided in URL)
    if (!passwordSubmitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">💸</div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Payment Graph</h2>
                        <p className="text-sm text-gray-600">P2P payment flow visualization</p>
                    </div>
                    {error && (
                        <div className="bg-red-50 text-red-800 rounded-lg p-3 text-sm">
                            <div className="font-semibold">Error</div>
                            <div>{error}</div>
                        </div>
                    )}
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
                        placeholder="Password"
                        className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                    />
                    <Button onClick={handlePasswordSubmit} className="w-full">
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
                apiKey=""
                password={password}
                mode="payment"
                topNodes={5000}
                performanceMode={performanceMode}
                onClose={handleClose}
                width={typeof window !== 'undefined' ? window.innerWidth : 1200}
                height={typeof window !== 'undefined' ? window.innerHeight - 120 : 800}
                renderOverlays={({
                    showUsernames,
                    setShowUsernames,
                    forceConfig,
                    setForceConfig,
                    externalNodesConfig,
                    setExternalNodesConfig,
                    externalNodes,
                    externalNodesLoading,
                    externalNodesError,
                    handleReset,
                    handleRecalculate,
                }) => (
                    <>
                        {/* Controls Panel - Top Right */}
                        <div className="absolute right-4 top-4 max-h-[calc(100vh-140px)] w-[200px] overflow-y-auto rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm">
                            <h3 className="mb-2 text-xs font-bold text-gray-900">Display & Forces</h3>

                            <div className="space-y-2 text-[11px]">
                                {/* Scale indicator */}
                                <div className="-mb-1 flex justify-between text-[8px] text-gray-400">
                                    <span>0.1×</span>
                                    <span>1×</span>
                                    <span>10×</span>
                                </div>

                                {/* Repulsion Force */}
                                <div className="space-y-0.5">
                                    <label className="flex cursor-pointer items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={forceConfig.charge.enabled}
                                                onChange={(e) =>
                                                    setForceConfig({
                                                        ...forceConfig,
                                                        charge: { ...forceConfig.charge, enabled: e.target.checked },
                                                    })
                                                }
                                                className="h-3 w-3 rounded border-gray-300 text-cyan-600"
                                            />
                                            <span className="text-gray-700">Repulsion Force</span>
                                        </div>
                                        {forceConfig.charge.enabled && (
                                            <span className="text-[9px] text-gray-500">
                                                {(
                                                    forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </label>
                                    {forceConfig.charge.enabled && (
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.charge.strength / DEFAULT_FORCE_CONFIG.charge.strength
                                            )}
                                            onChange={(e) =>
                                                setForceConfig({
                                                    ...forceConfig,
                                                    charge: {
                                                        ...forceConfig.charge,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.charge.strength *
                                                            Math.pow(10, parseFloat(e.target.value)),
                                                    },
                                                })
                                            }
                                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-600"
                                        />
                                    )}
                                </div>

                                {/* P2P Force */}
                                <div className="space-y-0.5">
                                    <label className="flex cursor-pointer items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={forceConfig.p2pLinks.enabled}
                                                onChange={(e) => {
                                                    setForceConfig({
                                                        ...forceConfig,
                                                        p2pLinks: {
                                                            ...forceConfig.p2pLinks,
                                                            enabled: e.target.checked,
                                                        },
                                                    })
                                                }}
                                                className="h-3 w-3 rounded border-gray-300 text-cyan-600"
                                            />
                                            <span className="text-gray-700">P2P Force</span>
                                        </div>
                                        {forceConfig.p2pLinks.enabled && (
                                            <span className="text-[9px] text-gray-500">
                                                {(
                                                    forceConfig.p2pLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.p2pLinks.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </label>
                                    {forceConfig.p2pLinks.enabled && (
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.p2pLinks.strength / DEFAULT_FORCE_CONFIG.p2pLinks.strength
                                            )}
                                            onChange={(e) =>
                                                setForceConfig({
                                                    ...forceConfig,
                                                    p2pLinks: {
                                                        ...forceConfig.p2pLinks,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.p2pLinks.strength *
                                                            Math.pow(10, parseFloat(e.target.value)),
                                                    },
                                                })
                                            }
                                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-cyan-600"
                                        />
                                    )}
                                </div>

                                {/* Center Force */}
                                <div className="space-y-1">
                                    <label className="flex cursor-pointer items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled
                                                }
                                                onChange={(e) =>
                                                    setForceConfig({
                                                        ...forceConfig,
                                                        center: {
                                                            ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                            enabled: e.target.checked,
                                                        },
                                                    })
                                                }
                                                className="h-3 w-3 rounded border-gray-300 text-amber-600"
                                            />
                                            <span className="text-gray-700">Center Force</span>
                                        </div>
                                        {(forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled) && (
                                            <span className="text-[9px] text-gray-500">
                                                {(
                                                    (forceConfig.center?.strength ??
                                                        DEFAULT_FORCE_CONFIG.center.strength) /
                                                    DEFAULT_FORCE_CONFIG.center.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </label>
                                    {(forceConfig.center?.enabled ?? DEFAULT_FORCE_CONFIG.center.enabled) && (
                                        <div className="space-y-0.5 pl-4">
                                            <input
                                                type="range"
                                                min="-1"
                                                max="1"
                                                step="0.05"
                                                value={Math.log10(
                                                    (forceConfig.center?.strength ??
                                                        DEFAULT_FORCE_CONFIG.center.strength) /
                                                        DEFAULT_FORCE_CONFIG.center.strength
                                                )}
                                                onChange={(e) =>
                                                    setForceConfig({
                                                        ...forceConfig,
                                                        center: {
                                                            ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                            strength:
                                                                DEFAULT_FORCE_CONFIG.center.strength *
                                                                Math.pow(10, parseFloat(e.target.value)),
                                                        },
                                                    })
                                                }
                                                className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-amber-600"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="my-1 border-t border-gray-200"></div>

                                {/* External Nodes Section */}
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="checkbox"
                                            checked={externalNodesConfig.enabled}
                                            onChange={(e) =>
                                                setExternalNodesConfig({
                                                    ...externalNodesConfig,
                                                    enabled: e.target.checked,
                                                    // When enabling, default to merchants only
                                                    types: e.target.checked
                                                        ? { WALLET: false, BANK: false, MERCHANT: true }
                                                        : externalNodesConfig.types,
                                                })
                                            }
                                            className="h-3 w-3 rounded border-gray-300 text-orange-600"
                                        />
                                        <span className="text-gray-700">External Nodes</span>
                                        {externalNodesLoading && (
                                            <span className="ml-auto animate-pulse text-[9px] text-orange-500">
                                                loading...
                                            </span>
                                        )}
                                        {externalNodesError && (
                                            <span
                                                className="text-red-500 ml-auto text-[9px]"
                                                title={externalNodesError}
                                            >
                                                ❌
                                            </span>
                                        )}
                                        {!externalNodesLoading &&
                                            !externalNodesError &&
                                            externalNodesConfig.enabled && (
                                                <span className="ml-auto text-[9px] text-gray-400">
                                                    {externalNodes.length}
                                                </span>
                                            )}
                                    </div>
                                    {externalNodesConfig.enabled && !externalNodesError && (
                                        <div className="space-y-1.5 pl-4">
                                            {/* Type filters - emoji only */}
                                            <div className="flex gap-2 text-[9px]">
                                                <label className="flex cursor-pointer items-center gap-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.WALLET}
                                                        onChange={(e) =>
                                                            setExternalNodesConfig({
                                                                ...externalNodesConfig,
                                                                types: {
                                                                    ...externalNodesConfig.types,
                                                                    WALLET: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-orange-500"
                                                    />
                                                    <span className="text-orange-600">₿</span>
                                                </label>
                                                <label className="flex cursor-pointer items-center gap-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.BANK}
                                                        onChange={(e) =>
                                                            setExternalNodesConfig({
                                                                ...externalNodesConfig,
                                                                types: {
                                                                    ...externalNodesConfig.types,
                                                                    BANK: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-blue-500"
                                                    />
                                                    <span className="text-blue-600">🏦</span>
                                                </label>
                                                <label className="flex cursor-pointer items-center gap-0.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={externalNodesConfig.types.MERCHANT}
                                                        onChange={(e) =>
                                                            setExternalNodesConfig({
                                                                ...externalNodesConfig,
                                                                types: {
                                                                    ...externalNodesConfig.types,
                                                                    MERCHANT: e.target.checked,
                                                                },
                                                            })
                                                        }
                                                        className="h-2.5 w-2.5 rounded border-gray-300 text-green-500"
                                                    />
                                                    <span className="text-green-600">🏪</span>
                                                </label>
                                            </div>
                                            {/* Min connections */}
                                            <div className="space-y-1">
                                                <span className="text-[9px] text-gray-500">Min users:</span>
                                                <div className="flex flex-wrap gap-0.5">
                                                    {[1, 2, 3, 5, 10, 20, 50].map((val) => (
                                                        <button
                                                            key={val}
                                                            onClick={() =>
                                                                setExternalNodesConfig({
                                                                    ...externalNodesConfig,
                                                                    minConnections: val,
                                                                })
                                                            }
                                                            className={`rounded px-1 py-0.5 text-[9px] transition-colors ${
                                                                externalNodesConfig.minConnections === val
                                                                    ? 'bg-orange-600 text-white'
                                                                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                            }`}
                                                        >
                                                            {val}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* External link force strength */}
                                            <div className="space-y-0.5">
                                                <label className="flex cursor-pointer items-center justify-between">
                                                    <div className="flex items-center gap-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                forceConfig.externalLinks?.enabled ??
                                                                DEFAULT_FORCE_CONFIG.externalLinks.enabled
                                                            }
                                                            onChange={(e) =>
                                                                setForceConfig({
                                                                    ...forceConfig,
                                                                    externalLinks: {
                                                                        ...(forceConfig.externalLinks ||
                                                                            DEFAULT_FORCE_CONFIG.externalLinks),
                                                                        enabled: e.target.checked,
                                                                    },
                                                                })
                                                            }
                                                            className="h-2.5 w-2.5 rounded border-gray-300 text-orange-500"
                                                        />
                                                        <span className="text-[9px] text-gray-600">Link Force</span>
                                                    </div>
                                                    {(forceConfig.externalLinks?.enabled ??
                                                        DEFAULT_FORCE_CONFIG.externalLinks.enabled) && (
                                                        <span className="text-[9px] text-gray-500">
                                                            {(
                                                                (forceConfig.externalLinks?.strength ??
                                                                    DEFAULT_FORCE_CONFIG.externalLinks.strength) /
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength
                                                            ).toFixed(1)}
                                                            x
                                                        </span>
                                                    )}
                                                </label>
                                                {(forceConfig.externalLinks?.enabled ??
                                                    DEFAULT_FORCE_CONFIG.externalLinks.enabled) && (
                                                    <input
                                                        type="range"
                                                        min="-1"
                                                        max="1"
                                                        step="0.05"
                                                        value={Math.log10(
                                                            (forceConfig.externalLinks?.strength ??
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength) /
                                                                DEFAULT_FORCE_CONFIG.externalLinks.strength
                                                        )}
                                                        onChange={(e) =>
                                                            setForceConfig({
                                                                ...forceConfig,
                                                                externalLinks: {
                                                                    ...(forceConfig.externalLinks ||
                                                                        DEFAULT_FORCE_CONFIG.externalLinks),
                                                                    strength:
                                                                        DEFAULT_FORCE_CONFIG.externalLinks.strength *
                                                                        Math.pow(10, parseFloat(e.target.value)),
                                                                },
                                                            })
                                                        }
                                                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-orange-500"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Divider */}
                                <div className="my-1 border-t border-gray-200"></div>

                                {/* Other options */}
                                <div className="flex gap-3">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={showUsernames}
                                            onChange={(e) => setShowUsernames(e.target.checked)}
                                            className="h-3 w-3 rounded border-gray-300 text-cyan-600"
                                        />
                                        <span className="text-gray-600">Names</span>
                                    </label>
                                </div>

                                {/* Performance mode toggle */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPerformanceMode(!performanceMode)}
                                        className={`flex-1 rounded border px-2 py-1 text-[10px] transition-colors ${
                                            performanceMode
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                        title="Limit to top 1000 nodes for better performance"
                                    >
                                        ⚡ Performance {performanceMode ? 'ON' : 'OFF'}
                                    </button>
                                </div>

                                {/* Action buttons */}
                                <div className="flex gap-1">
                                    <button
                                        onClick={handleRecalculate}
                                        className="flex-1 rounded border border-cyan-200 px-2 py-0.5 text-[9px] text-cyan-600 hover:bg-cyan-50 hover:text-cyan-800"
                                        title="Recalculate layout with current settings"
                                    >
                                        🔄 Recalc
                                    </button>
                                    <button
                                        onClick={handleReset}
                                        className="flex-1 rounded border border-gray-200 px-2 py-0.5 text-[9px] text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                                        title="Reset all settings to defaults"
                                    >
                                        ↺ Defaults
                                    </button>
                                </div>
                            </div>

                            {/* Compact Legend */}
                            <div className="mt-3 border-t border-gray-200 pt-2">
                                <div className="space-y-1 text-[9px]">
                                    {/* Nodes - by P2P activity */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full bg-purple-500"></span>
                                            P2P Active
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full bg-gray-400 opacity-50"></span>
                                            No P2P
                                        </span>
                                    </div>
                                    {/* External nodes */}
                                    {externalNodesConfig.enabled && (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                            {externalNodesConfig.types.WALLET && (
                                                <span className="flex items-center gap-0.5">
                                                    <span className="inline-block h-2 w-2 rotate-45 bg-orange-500"></span>
                                                    ₿
                                                </span>
                                            )}
                                            {externalNodesConfig.types.BANK && (
                                                <span className="flex items-center gap-0.5">
                                                    <span className="inline-block h-2 w-2 bg-blue-500"></span>
                                                    Bank
                                                </span>
                                            )}
                                            {externalNodesConfig.types.MERCHANT && (
                                                <span className="flex items-center gap-0.5">
                                                    <span
                                                        className="inline-block h-2 w-2 bg-green-500"
                                                        style={{
                                                            clipPath:
                                                                'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                                                        }}
                                                    ></span>
                                                    Merchant
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {/* Edges */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3 bg-cyan-500/50"></span>P2P
                                        </span>
                                    </div>
                                    <p className="text-gray-400">Click → Grafana | Right-click → Focus</p>
                                    <p className="text-gray-400">
                                        {performanceMode ? 'Limited to 1000 nodes' : 'Limited to 5000 nodes'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            />
        </div>
    )
}
