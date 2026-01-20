'use client'

import { twMerge } from 'tailwind-merge'
import { getLimitColorClass } from '../utils'

interface LimitsProgressBarProps {
    total: number
    remaining: number
}

/**
 * progress bar for limits display
 *
 * note: not using Global/ProgressBar because that component is designed for
 * request pots goals with specific labels ("contributed", "remaining"), markers,
 * and goal-achieved states. this component serves a different purpose - showing
 * limit usage with color thresholds based on remaining percentage.
 */
const LimitsProgressBar = ({ total, remaining }: LimitsProgressBarProps) => {
    const remainingPercent = total > 0 ? (remaining / total) * 100 : 0
    const clampedPercent = Math.min(Math.max(remainingPercent, 0), 100)

    return (
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-grey-2">
            <div
                className={twMerge(
                    'absolute left-0 h-full rounded-full transition-all duration-300',
                    getLimitColorClass(remainingPercent, 'bg')
                )}
                style={{ width: `${clampedPercent}%` }}
            />
        </div>
    )
}

export default LimitsProgressBar
