'use client'

import { motion } from 'framer-motion'
import { formatExtendedNumber } from '@/utils/general.utils'

interface UserRankCardProps {
    metric: number
    username: string
    isCurrency?: boolean
    backgroundColor?: string
}

export function UserRankCard({ metric, username, isCurrency = false, backgroundColor = 'white' }: UserRankCardProps) {
    const bgColorClass =
        backgroundColor === 'purple'
            ? 'bg-purple-200'
            : backgroundColor === 'pink'
              ? 'bg-pink-100'
              : backgroundColor === 'blue'
                ? 'bg-blue-100'
                : 'bg-white'

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`flex items-center justify-between border-2 border-black p-2.5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] md:p-3 ${bgColorClass}`}
        >
            <div className="flex items-center gap-2 md:gap-3">
                {/* Rank Badge - Question Mark for User */}
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center md:h-8 md:w-8">
                    <span className="text-xl font-bold text-gray-400 md:text-2xl">?</span>
                </div>

                {/* Username */}
                <div className="flex min-w-0 flex-col">
                    <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="truncate text-sm font-bold text-gray-900 md:text-base">{username}</span>
                        <span className="flex-shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 md:px-2 md:text-xs">
                            YOU
                        </span>
                    </div>
                </div>
            </div>

            {/* Metric */}
            <span className="ml-2 flex-shrink-0 font-mono text-base font-bold text-black md:text-lg">
                {isCurrency && '$'}
                {formatExtendedNumber(Math.round(metric), 6)}
            </span>
        </motion.div>
    )
}
