'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { formatExtendedNumber } from '@/utils/general.utils'
import { PRIZE_TIERS } from '../constants'
import type { LeaderboardEntry } from '../types'

interface QuestLeaderboardProps {
    entries: LeaderboardEntry[]
    metricLabel: string
    badgeColor: string
    isCurrency?: boolean
}

export function QuestLeaderboard({ entries, metricLabel, badgeColor, isCurrency = false }: QuestLeaderboardProps) {
    const router = useRouter()
    const getBadgeColorClasses = (color: string) => {
        switch (color) {
            case 'YELLOW':
                return 'bg-yellow-100 text-yellow-700'
            case 'PINK':
                return 'bg-pink-100 text-pink-700'
            case 'BLUE':
                return 'bg-blue-100 text-blue-700'
            default:
                return 'bg-gray-100 text-gray-700'
        }
    }

    return (
        <div className="w-full space-y-3">
            {entries.map((entry, index) => (
                <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => router.push(`/${entry.username}`)}
                    className="flex cursor-pointer items-center justify-between border-2 border-black bg-white p-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none md:p-3"
                >
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Rank Badge */}
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center md:h-8 md:w-8">
                            {entry.rank === 1 && <span className="text-xl md:text-2xl">🥇</span>}
                            {entry.rank === 2 && <span className="text-xl md:text-2xl">🥈</span>}
                            {entry.rank === 3 && <span className="text-xl md:text-2xl">🥉</span>}
                            {entry.rank > 3 && (
                                <span className="text-base font-bold text-gray-400 md:text-lg">#{entry.rank}</span>
                            )}
                        </div>

                        {/* Username */}
                        <div className="flex min-w-0 flex-col">
                            <div className="flex items-center gap-1.5 md:gap-2">
                                <span className="truncate text-sm font-bold text-gray-900 md:text-base">
                                    {entry.username}
                                </span>
                                {entry.rank <= 3 && (
                                    <span
                                        className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold md:px-2 md:text-xs ${getBadgeColorClasses(badgeColor)}`}
                                    >
                                        {PRIZE_TIERS[entry.rank as keyof typeof PRIZE_TIERS]}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Metric */}
                    <span className="ml-2 flex-shrink-0 font-mono text-base font-bold text-black md:text-lg">
                        {isCurrency && '$'}
                        {formatExtendedNumber(Math.round(entry.metric), 6)}
                    </span>
                </motion.div>
            ))}
        </div>
    )
}
