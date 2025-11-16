'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { formatExtendedNumber } from '@/utils/general.utils'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { PRIZE_TIERS } from '../constants'
import type { LeaderboardEntry } from '../types'

export interface QuestCardProps {
    title: string
    description: string
    iconPath: string
    leaderboard: LeaderboardEntry[]
    badgeColor: string
    backgroundColor: string
    onClick?: () => void
    questStatus?: 'not_started' | 'active' | 'ended'
    isLoading?: boolean
    isCurrency?: boolean
}

export function QuestCard({
    title,
    description,
    iconPath,
    leaderboard,
    badgeColor,
    backgroundColor,
    onClick,
    questStatus = 'active',
    isLoading = false,
    isCurrency = false,
}: QuestCardProps) {
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

    const bgColorClass =
        backgroundColor === 'purple' ? 'bg-purple-200' : backgroundColor === 'pink' ? 'bg-pink-100' : 'bg-blue-100'

    return (
        <motion.div
            className={`flex h-full flex-col rounded-sm border-2 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:p-6 ${bgColorClass}`}
        >
            {/* Quest Icon and Title - Clickable Header */}
            <div
                onClick={onClick}
                className="mb-4 flex cursor-pointer items-center gap-3 transition-opacity duration-100 hover:opacity-80 active:opacity-60 md:gap-4"
            >
                <div className="relative h-12 w-12 flex-shrink-0 md:h-16 md:w-16">
                    <Image src={iconPath} alt={title} fill className="object-contain" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-black text-black md:text-xl">{title}</h3>
                    <p className="text-xs text-gray-600 md:text-sm">{description}</p>
                </div>
            </div>

            {/* Mini Leaderboard - Top 3 or Empty State */}
            <div className="flex-1 space-y-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                        <PeanutLoading />
                    </div>
                ) : leaderboard.length === 0 ? (
                    questStatus === 'not_started' ? (
                        <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="mb-3 text-4xl">⏰</div>
                            <p className="text-sm font-bold text-gray-700">Coming Soon!</p>
                            <p className="text-xs text-gray-500">Starts Nov 17th</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center rounded-sm border-2 border-black bg-white py-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <div className="mb-3 text-3xl">🏆</div>
                            <p className="text-sm font-bold text-gray-700">No entries yet</p>
                            <p className="text-xs text-gray-500">Be the first!</p>
                        </div>
                    )
                ) : (
                    leaderboard.slice(0, 3).map((entry, index) => (
                        <div
                            key={entry.userId}
                            onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/${entry.username}`)
                            }}
                            className="flex cursor-pointer items-center justify-between border-2 border-black bg-white p-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all duration-100 hover:-translate-y-0.5 hover:shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] active:translate-x-1 active:translate-y-1 active:shadow-none md:p-3"
                        >
                            <div className="flex items-center gap-2 md:gap-3">
                                {/* Rank Badge */}
                                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center md:h-8 md:w-8">
                                    {entry.rank === 1 && <span className="text-xl md:text-2xl">🥇</span>}
                                    {entry.rank === 2 && <span className="text-xl md:text-2xl">🥈</span>}
                                    {entry.rank === 3 && <span className="text-xl md:text-2xl">🥉</span>}
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
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    )
}
