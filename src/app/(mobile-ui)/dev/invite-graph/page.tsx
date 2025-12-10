'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import InvitesGraph from '@/components/Global/InvitesGraph'

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
                        <p className="mt-2 text-xs text-gray-500">
                            ⚠️ Restricted access: Only authorized users (kkonrad, hugo, squirrel)
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
                renderOverlays={({ showUsernames, setShowUsernames, showPoints, setShowPoints }) => (
                    <>
                        {/* Legend - Bottom Left */}
                        <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm">
                            <h3 className="mb-3 text-sm font-bold text-gray-900">Legend</h3>
                            <div className="space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                                    <span className="text-gray-700">User with access</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-gray-400"></div>
                                    <span className="text-gray-700">Orphan (no access)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full border-2 border-yellow-500 bg-yellow-400"></div>
                                    <span className="text-gray-700">Selected user</span>
                                </div>
                                <div className="my-2 border-t border-gray-200"></div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-semibold text-gray-700">Invite Types:</div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-0.5 w-6 bg-purple-500/40"></div>
                                        <span className="text-gray-700">Direct invite</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="h-0.5 w-6 bg-pink-500/40"></div>
                                        <span className="text-gray-700">Payment link</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mobile Controls - Bottom Right */}
                        <div className="absolute bottom-4 right-4 flex flex-col gap-2 sm:hidden">
                            <button
                                onClick={() => setShowUsernames(!showUsernames)}
                                className={`rounded-full p-3 shadow-lg transition-colors ${
                                    showUsernames ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
                                }`}
                            >
                                👤
                            </button>
                            <button
                                onClick={() => setShowPoints(!showPoints)}
                                className={`rounded-full p-3 shadow-lg transition-colors ${
                                    showPoints ? 'bg-purple-600 text-white' : 'bg-white text-gray-700'
                                }`}
                            >
                                🎯
                            </button>
                        </div>
                    </>
                )}
            />
        </div>
    )
}
