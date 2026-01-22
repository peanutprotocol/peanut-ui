'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { useAuth } from '@/context/authContext'
import { IS_DEV } from '@/constants/general.consts'
import InvitesGraph, {
    DEFAULT_FORCE_CONFIG,
    DEFAULT_VISIBILITY_CONFIG,
    DEFAULT_EXTERNAL_NODES_CONFIG,
} from '@/components/Global/InvitesGraph'

// Allowed users for full graph access (frontend check - backend also validates)
const ALLOWED_USERNAMES = ['squirrel', 'kkonrad', 'hugo']

export default function FullGraphPage() {
    const { user, isFetchingUser } = useAuth()
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

    // Check if user is allowed (frontend defense - backend also validates)
    // In dev mode, allow all users; in prod, restrict to allowed usernames
    const isAllowedUser =
        IS_DEV || (user?.user?.username && ALLOWED_USERNAMES.includes(user.user.username.toLowerCase()))

    // Loading state
    if (isFetchingUser) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="text-white">Loading...</div>
            </div>
        )
    }

    // Access denied screen
    if (!isAllowedUser) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🔒</div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Access Restricted</h2>
                        <p className="text-sm text-gray-600">This tool is only available to authorized users.</p>
                        {user?.user?.username && (
                            <p className="mt-2 text-xs text-gray-400">Logged in as: {user.user.username}</p>
                        )}
                    </div>
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

    // API key input screen
    if (!apiKeySubmitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900">
                <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-2xl">
                    <div className="text-center">
                        <div className="mb-4 text-6xl">🕸️</div>
                        <h2 className="mb-2 text-2xl font-bold text-gray-900">Full Graph</h2>
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
                    externalNodes,
                    externalNodesLoading,
                    externalNodesError,
                    handleReset,
                    handleRecalculate,
                }) => (
                    <>
                        {/* Controls Panel - Top Right */}
                        <div className="absolute right-4 top-4 max-h-[calc(100vh-140px)] w-[200px] overflow-y-auto rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur-sm">
                            {/* FORCES + VISIBILITY merged */}
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
                                                className="h-3 w-3 rounded border-gray-300 text-purple-600"
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
                                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-600"
                                        />
                                    )}
                                </div>

                                {/* Invite Force + Edges (merged) */}
                                <div className="space-y-0.5">
                                    <label className="flex cursor-pointer items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="checkbox"
                                                checked={forceConfig.inviteLinks.enabled}
                                                onChange={(e) => {
                                                    setForceConfig({
                                                        ...forceConfig,
                                                        inviteLinks: {
                                                            ...forceConfig.inviteLinks,
                                                            enabled: e.target.checked,
                                                        },
                                                    })
                                                    setVisibilityConfig({
                                                        ...visibilityConfig,
                                                        inviteEdges: e.target.checked,
                                                    })
                                                }}
                                                className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                            />
                                            <span className="text-gray-700">Invite Force</span>
                                            <span className="text-[9px] text-gray-400">+ edges</span>
                                        </div>
                                        {forceConfig.inviteLinks.enabled && (
                                            <span className="text-[9px] text-gray-500">
                                                {(
                                                    forceConfig.inviteLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.inviteLinks.strength
                                                ).toFixed(1)}
                                                x
                                            </span>
                                        )}
                                    </label>
                                    {forceConfig.inviteLinks.enabled && (
                                        <input
                                            type="range"
                                            min="-1"
                                            max="1"
                                            step="0.05"
                                            value={Math.log10(
                                                forceConfig.inviteLinks.strength /
                                                    DEFAULT_FORCE_CONFIG.inviteLinks.strength
                                            )}
                                            onChange={(e) =>
                                                setForceConfig({
                                                    ...forceConfig,
                                                    inviteLinks: {
                                                        ...forceConfig.inviteLinks,
                                                        strength:
                                                            DEFAULT_FORCE_CONFIG.inviteLinks.strength *
                                                            Math.pow(10, parseFloat(e.target.value)),
                                                    },
                                                })
                                            }
                                            className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-600"
                                        />
                                    )}
                                </div>

                                {/* P2P Force + Edges (merged) */}
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
                                                    setVisibilityConfig({
                                                        ...visibilityConfig,
                                                        p2pEdges: e.target.checked,
                                                    })
                                                }}
                                                className="h-3 w-3 rounded border-gray-300 text-cyan-600"
                                            />
                                            <span className="text-gray-700">P2P Force</span>
                                            <span className="text-[9px] text-gray-400">+ edges</span>
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

                                {/* Center Force (unified) */}
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
                                        <>
                                            {/* Strength slider */}
                                            <div className="space-y-0.5 pl-4">
                                                <div className="flex justify-between text-[9px] text-gray-500">
                                                    <span>Strength</span>
                                                </div>
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
                                            {/* Size bias slider: 0=uniform, 9=big nodes get 10x pull */}
                                            <div className="space-y-0.5 pl-4">
                                                <div className="flex justify-between text-[9px] text-gray-500">
                                                    <span>Size Bias</span>
                                                    <span>
                                                        {(
                                                            1 +
                                                            (forceConfig.center?.sizeBias ??
                                                                DEFAULT_FORCE_CONFIG.center.sizeBias)
                                                        ).toFixed(1)}
                                                        x
                                                    </span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="9"
                                                    step="0.5"
                                                    value={
                                                        forceConfig.center?.sizeBias ??
                                                        DEFAULT_FORCE_CONFIG.center.sizeBias
                                                    }
                                                    onChange={(e) =>
                                                        setForceConfig({
                                                            ...forceConfig,
                                                            center: {
                                                                ...(forceConfig.center || DEFAULT_FORCE_CONFIG.center),
                                                                sizeBias: parseFloat(e.target.value),
                                                            },
                                                        })
                                                    }
                                                    className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-green-600"
                                                />
                                                <div className="flex justify-between text-[8px] text-gray-400">
                                                    <span>1x uniform</span>
                                                    <span>10x big→center</span>
                                                </div>
                                            </div>
                                        </>
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
                                                })
                                            }
                                            className="h-3 w-3 rounded border-gray-300 text-orange-600"
                                        />
                                        <span className="text-gray-700">External Nodes</span>
                                        <span className="text-[9px]" title="Experimental feature">
                                            ⚠️
                                        </span>
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
                                    {externalNodesError && externalNodesConfig.enabled && (
                                        <div className="text-red-600 pl-4 text-[10px]">
                                            Failed to load. Check console.
                                        </div>
                                    )}
                                    {!externalNodesError && externalNodesConfig.enabled && (
                                        <div className="space-y-1.5 pl-4">
                                            {/* Min connections - discrete options */}
                                            <div className="space-y-0.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] text-gray-500">Min users:</span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {[1, 2, 3, 5, 10, 20, 50].map((val) => (
                                                            <button
                                                                key={val}
                                                                onClick={() =>
                                                                    setExternalNodesConfig({
                                                                        ...externalNodesConfig,
                                                                        minConnections: val,
                                                                    })
                                                                }
                                                                className={`rounded px-1.5 py-0.5 text-[9px] transition-colors ${
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
                                            </div>
                                            {/* Type filters */}
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
                                                    <span className="text-orange-600">💳</span>
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

                                {/* Node visibility */}
                                <div className="flex gap-3">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={visibilityConfig.activeNodes}
                                            onChange={(e) =>
                                                setVisibilityConfig({
                                                    ...visibilityConfig,
                                                    activeNodes: e.target.checked,
                                                })
                                            }
                                            className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                        />
                                        <span className="text-gray-600">Active</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={visibilityConfig.inactiveNodes}
                                            onChange={(e) =>
                                                setVisibilityConfig({
                                                    ...visibilityConfig,
                                                    inactiveNodes: e.target.checked,
                                                })
                                            }
                                            className="h-3 w-3 rounded border-gray-300 text-gray-400"
                                        />
                                        <span className="text-gray-600">Inactive</span>
                                    </label>
                                </div>

                                {/* Other options */}
                                <div className="flex items-center gap-3">
                                    <label className="flex cursor-pointer items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={showUsernames}
                                            onChange={(e) => setShowUsernames(e.target.checked)}
                                            className="h-3 w-3 rounded border-gray-300 text-purple-600"
                                        />
                                        <span className="text-gray-600">Names</span>
                                    </label>
                                </div>

                                {/* Top nodes slider */}
                                <div className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-gray-500">Top nodes:</span>
                                        <span className="text-[9px] text-gray-500">
                                            {topNodes === 0 ? 'All' : topNodes.toLocaleString()}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="10000"
                                        step="500"
                                        value={topNodes}
                                        onChange={(e) => setTopNodes(parseInt(e.target.value))}
                                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-purple-600"
                                    />
                                    <div className="flex justify-between text-[8px] text-gray-400">
                                        <span>All</span>
                                        <span>5k</span>
                                        <span>10k</span>
                                    </div>
                                </div>

                                {/* Activity window */}
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-gray-500">Active =</span>
                                    <select
                                        value={activityFilter.activityDays}
                                        onChange={(e) =>
                                            setActivityFilter({
                                                ...activityFilter,
                                                activityDays: parseInt(e.target.value),
                                                enabled: true,
                                            })
                                        }
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
                                        className="flex-1 rounded border border-purple-200 px-2 py-0.5 text-[9px] text-purple-600 hover:bg-purple-50 hover:text-purple-800"
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
                                    {/* Nodes */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
                                            New
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full bg-purple-500"></span>
                                            Active
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full bg-gray-400 opacity-40"></span>
                                            Inactive
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-2 w-2 rounded-full border border-black bg-gray-300"></span>
                                            Jailed
                                        </span>
                                    </div>
                                    {/* External nodes */}
                                    {externalNodesConfig.enabled && (
                                        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                            <span className="flex items-center gap-0.5">
                                                <span className="inline-block h-2 w-2 rotate-45 bg-orange-500"></span>
                                                Wallet
                                            </span>
                                            <span className="flex items-center gap-0.5">
                                                <span className="inline-block h-2 w-2 bg-blue-500"></span>Bank
                                            </span>
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
                                        </div>
                                    )}
                                    {/* Edges */}
                                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-gray-500">
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3 bg-purple-500/50"></span>Invite
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3 bg-pink-500/50"></span>Payment
                                        </span>
                                        <span className="flex items-center gap-0.5">
                                            <span className="inline-block h-0.5 w-3 bg-cyan-500/50"></span>P2P
                                        </span>
                                    </div>
                                    <p className="text-gray-400">Click → Grafana | Right-click → Focus</p>
                                    {topNodes > 0 && (
                                        <p className="text-gray-400">Showing top {topNodes.toLocaleString()} nodes</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            />
        </div>
    )
}
