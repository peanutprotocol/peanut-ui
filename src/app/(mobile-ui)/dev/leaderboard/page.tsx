'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Card from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { pointsApi } from '@/services/points'
import { Icon } from '@/components/Global/Icons/Icon'

type TimeFilter = '1h' | '6h' | '24h' | 'custom'

// Mock data generator - creates realistic time-based data
const generateMockData = (sinceDate: Date) => {
    const now = new Date()
    const hoursAgo = (now.getTime() - sinceDate.getTime()) / (1000 * 60 * 60)

    // All users with their activity timestamps (hours ago) and base points per hour
    const allUsers = [
        { userId: '1', username: 'cryptoqueen', currentTier: 3, hoursAgo: 0.5, pointsPerHour: 280 },
        { userId: '2', username: 'defi_wizard', currentTier: 2, hoursAgo: 1, pointsPerHour: 240 },
        { userId: '3', username: 'hodler_max', currentTier: 3, hoursAgo: 2, pointsPerHour: 220 },
        { userId: '4', username: 'web3_warrior', currentTier: 2, hoursAgo: 3, pointsPerHour: 200 },
        { userId: '5', username: 'nft_collector', currentTier: 1, hoursAgo: 4, pointsPerHour: 180 },
        { userId: '6', username: 'blockchain_bob', currentTier: 2, hoursAgo: 5, pointsPerHour: 160 },
        { userId: '7', username: 'smart_contract', currentTier: 1, hoursAgo: 6, pointsPerHour: 150 },
        { userId: '8', username: 'eth_enthusiast', currentTier: 2, hoursAgo: 8, pointsPerHour: 140 },
        { userId: '9', username: 'token_trader', currentTier: 1, hoursAgo: 10, pointsPerHour: 120 },
        { userId: '10', username: 'meta_master', currentTier: 1, hoursAgo: 12, pointsPerHour: 100 },
        { userId: '11', username: 'crypto_surfer', currentTier: 1, hoursAgo: 14, pointsPerHour: 90 },
        { userId: '12', username: 'defi_degen', currentTier: 0, hoursAgo: 16, pointsPerHour: 80 },
        { userId: '13', username: 'web3_dev', currentTier: 1, hoursAgo: 18, pointsPerHour: 70 },
        { userId: '14', username: 'nft_flipper', currentTier: 0, hoursAgo: 19, pointsPerHour: 65 },
        { userId: '15', username: 'yield_farmer', currentTier: 1, hoursAgo: 20, pointsPerHour: 60 },
        { userId: '16', username: 'staking_pro', currentTier: 0, hoursAgo: 21, pointsPerHour: 55 },
        { userId: '17', username: 'dao_voter', currentTier: 0, hoursAgo: 22, pointsPerHour: 50 },
        { userId: '18', username: 'layer2_fan', currentTier: 0, hoursAgo: 22.5, pointsPerHour: 45 },
        { userId: '19', username: 'gas_optimizer', currentTier: 0, hoursAgo: 23, pointsPerHour: 40 },
        { userId: '20', username: 'wallet_ninja', currentTier: 0, hoursAgo: 23.5, pointsPerHour: 35 },
    ]

    // Filter users who have activity within the time window
    const activeUsers = allUsers
        .filter((user) => user.hoursAgo <= hoursAgo)
        .map((user) => ({
            userId: user.userId,
            username: user.username,
            currentTier: user.currentTier,
            // Calculate points based on how long they've been active
            pointsEarned: Math.floor(user.pointsPerHour * Math.min(hoursAgo - user.hoursAgo, 24)),
        }))
        .filter((user) => user.pointsEarned > 0)
        .sort((a, b) => b.pointsEarned - a.pointsEarned)
        .slice(0, 20)
        .map((user, index) => ({
            ...user,
            rank: index + 1,
        }))

    return {
        leaderboard: activeUsers,
        since: sinceDate.toISOString(),
        limit: 20,
    }
}

const USE_MOCK_DATA = false // Set to false to use real backend data

export default function LeaderboardPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
    const isManualInputRef = useRef(false) // Track if user is manually typing

    const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h')
    const [customTime, setCustomTime] = useState('')
    const [leaderboard, setLeaderboard] = useState<
        Array<{
            rank: number
            userId: string
            username: string
            pointsEarned: number
            currentTier: number
        }>
    >([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sinceDate, setSinceDate] = useState('')
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

    // Helper: Convert UTC ISO string to local datetime-local format
    const utcToLocal = useCallback((utcIso: string): string => {
        const date = new Date(utcIso)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        return `${year}-${month}-${day}T${hours}:${minutes}`
    }, [])

    // Helper: Convert local datetime-local format to UTC ISO string
    const localToUtc = useCallback((localDateTime: string): string => {
        return new Date(localDateTime).toISOString()
    }, [])

    const updateURL = useCallback(
        (timestamp: string) => {
            const params = new URLSearchParams()
            params.set('since', timestamp)
            router.push(`/dev/leaderboard?${params.toString()}`, { scroll: false })
        },
        [router]
    )

    const fetchLeaderboard = useCallback(async (since: string) => {
        setLoading(true)
        setError(null)

        // Use mock data if enabled
        if (USE_MOCK_DATA) {
            setTimeout(() => {
                const mockData = generateMockData(new Date(since))
                setLeaderboard(mockData.leaderboard)
                setSinceDate(mockData.since)
                setLastUpdate(new Date())
                setLoading(false)
            }, 300) // Simulate network delay
            return
        }

        const result = await pointsApi.getTimeLeaderboard({ limit: 20, since })

        if (result.success && result.data) {
            setLeaderboard(result.data.leaderboard)
            setSinceDate(result.data.since)
            setLastUpdate(new Date())
        } else {
            setError('Failed to load leaderboard')
        }
        setLoading(false)
    }, [])

    // Debounced fetch function
    const debouncedFetch = useCallback(
        (since: string) => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
            debounceTimerRef.current = setTimeout(() => {
                fetchLeaderboard(since)
            }, 500)
        },
        [fetchLeaderboard]
    )

    const handleTimeFilterChange = useCallback(
        (filter: TimeFilter) => {
            isManualInputRef.current = false // Reset flag for preset filters
            setTimeFilter(filter)

            if (filter === 'custom') {
                return
            }

            const now = new Date()
            let since: Date

            switch (filter) {
                case '1h':
                    since = new Date(now.getTime() - 60 * 60 * 1000)
                    break
                case '6h':
                    since = new Date(now.getTime() - 6 * 60 * 60 * 1000)
                    break
                case '24h':
                    since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
                    break
            }

            const timestamp = since.toISOString()
            updateURL(timestamp)
            // Fetch immediately for preset filters (no debounce)
            fetchLeaderboard(timestamp)
        },
        [updateURL, fetchLeaderboard]
    )

    const handleCustomTimeChange = useCallback(
        (value: string) => {
            // Mark as manual input to prevent sync effect from overwriting
            isManualInputRef.current = true

            // Update the input value immediately for responsive typing
            setCustomTime(value)
            if (!value) return

            setTimeFilter('custom')
            try {
                const timestamp = localToUtc(value)
                updateURL(timestamp)
                debouncedFetch(timestamp)
            } catch (e) {
                // Invalid date format while typing, ignore
            }
        },
        [localToUtc, updateURL, debouncedFetch]
    )

    const handleCustomTimeSubmit = useCallback(() => {
        if (!customTime) return
        isManualInputRef.current = false // Reset flag after explicit submit
        const timestamp = localToUtc(customTime)
        updateURL(timestamp)
        // Apply button fetches immediately (user explicitly clicked)
        fetchLeaderboard(timestamp)
    }, [customTime, localToUtc, updateURL, fetchLeaderboard])

    const handleSetNow = useCallback(() => {
        isManualInputRef.current = false // Not manual typing, it's a button click
        const now = new Date()
        const localDateTime = utcToLocal(now.toISOString())
        setCustomTime(localDateTime)
        setTimeFilter('custom')

        // Also trigger fetch with the current time
        const timestamp = now.toISOString()
        updateURL(timestamp)
        fetchLeaderboard(timestamp)
    }, [utcToLocal, updateURL, fetchLeaderboard])

    // Initialize from URL params
    useEffect(() => {
        const sinceParam = searchParams.get('since')
        if (sinceParam) {
            fetchLeaderboard(sinceParam)
        } else {
            // Load 24h by default
            handleTimeFilterChange('24h')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync custom time input with sinceDate (but not during manual input)
    useEffect(() => {
        if (sinceDate && !isManualInputRef.current) {
            // Convert UTC ISO string to local datetime-local format
            const localDateTime = utcToLocal(sinceDate)
            setCustomTime(localDateTime)
        }
        // After data loads, reset manual input flag
        if (sinceDate && isManualInputRef.current) {
            // Give it a moment for the debounced fetch to complete
            setTimeout(() => {
                isManualInputRef.current = false
            }, 1000)
        }
    }, [sinceDate, utcToLocal])

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (!sinceDate) return

        const interval = setInterval(() => {
            fetchLeaderboard(sinceDate)
        }, 30000) // Refresh every 30 seconds

        return () => clearInterval(interval)
    }, [sinceDate, fetchLeaderboard])

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    const getTierBadgeColor = (tier: number) => {
        switch (tier) {
            case 0:
                return 'bg-gray-100 text-gray-700'
            case 1:
                return 'bg-blue-100 text-blue-700'
            case 2:
                return 'bg-purple-100 text-purple-700'
            case 3:
                return 'bg-yellow-100 text-yellow-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    const getTrophyColor = (rank: number) => {
        if (rank === 1) return 'text-yellow-500' // Gold
        if (rank === 2) return 'text-gray-400' // Silver
        if (rank === 3) return 'text-orange-600' // Bronze
        return 'text-gray-300'
    }

    const formatDate = (isoString: string) => {
        const date = new Date(isoString)
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return (
        <div className="flex min-h-screen flex-col">
            <NavHeader title="🏆 Points Leaderboard" href="/dev" />

            {/* Main Content - Full Width Container */}
            <div className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-6 md:px-8">
                {/* Header with Prize */}
                <div className="text-center">
                    <h1 className="mb-2 text-4xl font-bold">Event Leaderboard</h1>
                    <div className="mb-4">
                        <span className="text-sm text-gray-500">Last update: {lastUpdate.toLocaleTimeString()}</span>
                    </div>
                    <div className="mx-auto max-w-2xl rounded-xl bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 p-6 shadow-lg">
                        <div className="flex items-center justify-center gap-3">
                            <span className="text-5xl">💰</span>
                            <div className="text-left">
                                <p className="text-3xl font-black text-white">$50 PRIZE</p>
                                <p className="text-lg font-semibold text-yellow-100">for the top scorer!</p>
                            </div>
                            <span className="text-5xl">🏆</span>
                        </div>
                    </div>
                </div>

                {/* Leaderboard */}
                {loading ? (
                    <Card className="p-12">
                        <div className="flex items-center justify-center">
                            <Icon name="pending" size={32} className="animate-spin text-primary-1" />
                            <span className="ml-3 text-lg text-gray-600">Loading leaderboard...</span>
                        </div>
                    </Card>
                ) : error ? (
                    <Card className="bg-red-50 p-8">
                        <p className="text-red-800 text-center text-lg">{error}</p>
                    </Card>
                ) : leaderboard.length === 0 ? (
                    <Card className="p-12">
                        <p className="text-center text-lg text-gray-600">No points earned in this time period yet.</p>
                    </Card>
                ) : (
                    <Card className="divide-y divide-gray-100">
                        {leaderboard.map((entry) => (
                            <div
                                key={entry.userId}
                                className={`flex items-center justify-between p-6 transition-colors hover:bg-gray-50 ${
                                    entry.rank <= 3 ? 'bg-yellow-50/40' : ''
                                }`}
                            >
                                <div className="flex items-center gap-6">
                                    {/* Rank */}
                                    <div className="flex w-12 items-center justify-center">
                                        {entry.rank <= 3 ? (
                                            <Icon name="star" size={32} className={getTrophyColor(entry.rank)} />
                                        ) : (
                                            <span className="text-2xl font-bold text-gray-400">#{entry.rank}</span>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xl font-bold text-gray-900">{entry.username}</span>
                                            <span
                                                className={`rounded-full px-3 py-1 text-sm font-medium ${getTierBadgeColor(entry.currentTier)}`}
                                            >
                                                Tier {entry.currentTier}
                                            </span>
                                        </div>
                                        <span className="text-base text-gray-500">
                                            {entry.pointsEarned.toLocaleString()} points
                                        </span>
                                    </div>
                                </div>

                                {/* Rank Badge for Top 3 */}
                                <div className="flex items-center gap-4">
                                    {entry.rank === 1 && (
                                        <span className="rounded-full bg-yellow-100 px-4 py-2 text-sm font-bold text-yellow-800">
                                            🥇 1st Place
                                        </span>
                                    )}
                                    {entry.rank === 2 && (
                                        <span className="rounded-full bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700">
                                            🥈 2nd Place
                                        </span>
                                    )}
                                    {entry.rank === 3 && (
                                        <span className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-700">
                                            🥉 3rd Place
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </Card>
                )}
            </div>

            {/* Compact Filter Bar at Bottom */}
            <div className="sticky bottom-0 border-t border-gray-200 bg-white shadow-lg">
                <div className="mx-auto max-w-7xl px-4 py-4 md:px-8">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        {/* Quick Filters */}
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-700">Time Period:</span>
                            <div className="flex gap-2">
                                <Button
                                    size="small"
                                    variant={timeFilter === '24h' ? 'purple' : 'stroke'}
                                    onClick={() => handleTimeFilterChange('24h')}
                                    className="px-3 py-1"
                                >
                                    24H
                                </Button>
                                <Button
                                    size="small"
                                    variant={timeFilter === '6h' ? 'purple' : 'stroke'}
                                    onClick={() => handleTimeFilterChange('6h')}
                                    className="px-3 py-1"
                                >
                                    6H
                                </Button>
                                <Button
                                    size="small"
                                    variant={timeFilter === '1h' ? 'purple' : 'stroke'}
                                    onClick={() => handleTimeFilterChange('1h')}
                                    className="px-3 py-1"
                                >
                                    1H
                                </Button>
                            </div>
                        </div>

                        {/* Custom Time */}
                        <div className="flex items-center gap-2">
                            <Button
                                size="small"
                                variant="stroke"
                                onClick={handleSetNow}
                                className="whitespace-nowrap px-3 py-1"
                            >
                                SINCE NOW
                            </Button>
                            <input
                                type="datetime-local"
                                value={customTime}
                                onChange={(e) => handleCustomTimeChange(e.target.value)}
                                className="w-48 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-primary-1 focus:outline-none focus:ring-1 focus:ring-primary-1"
                            />
                            <Button
                                size="small"
                                variant={timeFilter === 'custom' ? 'purple' : 'stroke'}
                                onClick={handleCustomTimeSubmit}
                                disabled={!customTime}
                                className="px-3 py-1"
                            >
                                Apply
                            </Button>
                        </div>

                        {/* Since Info */}
                        {sinceDate && (
                            <div className="text-xs text-gray-500">
                                Since: <span className="font-medium">{formatDate(sinceDate)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
