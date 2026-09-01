import COIN_ICON from '@/assets/icons/coin.svg'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import React from 'react'
import { twMerge } from '@/utils/tw'
import ProgressBar, { type ProgressBarMarker } from '@/components/0_Bruddle/ProgressBar'
import { formatExtendedNumber } from '@/utils/general.utils'

interface PotProgressProps {
    goal: number
    progress: number
    isClosed: boolean
}

/**
 * request-pot goal progress: status text + amount labels + goal/progress markers
 * over the ProgressBar primitive.
 */
const PotProgress: React.FC<PotProgressProps> = ({ goal, progress, isClosed }) => {
    const t = useTranslations('global')
    const isOverGoal = progress > goal && goal > 0
    const isGoalAchieved = progress >= goal && !isOverGoal && goal > 0

    // Calculate actual ratio and enforce minimum visual distance
    const MIN_VISUAL_DISTANCE = 30 // 30% minimum distance between markers
    let totalValue = isOverGoal ? progress : goal
    let visualGoalPercentage = 0
    let visualProgressPercentage = 0
    let useVisualDistance = false

    if (goal > 0) {
        const actualProgressPercentage = (progress / goal) * 100

        if (isOverGoal) {
            // When progress > goal and is not closed
            if (isClosed && actualProgressPercentage < 100 + MIN_VISUAL_DISTANCE) {
                // Progress is too close to goal, enforce minimum distance
                // Map goal to ~70% and progress to 100%
                visualGoalPercentage = 100 - MIN_VISUAL_DISTANCE
                visualProgressPercentage = 100
                useVisualDistance = true
            } else {
                // Progress is far enough, show actual ratio
                totalValue = progress
                visualGoalPercentage = (goal / totalValue) * 100
                visualProgressPercentage = 100
                useVisualDistance = true
            }
        } else {
            // When progress <= goal and is not closed
            if (isClosed && actualProgressPercentage > 100 - MIN_VISUAL_DISTANCE && actualProgressPercentage < 100) {
                // Progress is too close to goal, enforce minimum distance
                // Map progress to ~70% and goal to 100%
                visualProgressPercentage = 100 - MIN_VISUAL_DISTANCE
                visualGoalPercentage = 100
                useVisualDistance = true
            }
        }
    }

    // Guard against division by zero and clamp percentages to valid ranges
    const goalPercentage = useVisualDistance
        ? visualGoalPercentage
        : totalValue > 0
          ? Math.min(Math.max((goal / totalValue) * 100, 0), 100)
          : 0
    const progressPercentage = useVisualDistance
        ? visualProgressPercentage
        : totalValue > 0
          ? Math.min(Math.max((progress / totalValue) * 100, 0), 100)
          : 0
    const percentage = goal > 0 ? Math.min(Math.max(Math.round((progress / goal) * 100), 0), 100) : 0

    const formatCurrency = (value: number) => `$${formatExtendedNumber(value, 4)}`

    const getStatusText = () => {
        if (isOverGoal) return t('progressBar.goalExceeded')
        if (isGoalAchieved) return t('progressBar.goalAchieved')
        return t('progressBar.belowGoal', { percentage: 100 - percentage })
    }

    const getTrackColor = () => {
        if (isOverGoal) return 'bg-action-secondary'
        if (!isClosed) return 'bg-background-disabled'
        return isGoalAchieved ? 'bg-green-500' : 'bg-red-200'
    }

    const renderStatusText = () => {
        if (!isClosed) return null
        return (
            <div className="flex items-center gap-1 text-body-m">
                <Image src={COIN_ICON} alt="coin" width={18} height={18} />
                <p>{getStatusText()}</p>
            </div>
        )
    }

    const renderLabels = () => {
        if (!isClosed) {
            return (
                <div className="flex w-full items-center justify-between text-body-s">
                    <p>{t('progressBar.contributed', { amount: formatCurrency(progress) })}</p>
                    <p>{t('progressBar.remaining', { amount: formatCurrency(Math.max(goal - progress, 0)) })}</p>
                </div>
            )
        }

        if (isOverGoal) {
            return (
                <div className="relative flex w-full items-center pb-2">
                    <p className="absolute -translate-x-1/2 text-body-s" style={{ left: `${goalPercentage}%` }}>
                        100%
                    </p>
                    <p className="absolute right-0 text-body-s">{formatCurrency(progress)}</p>
                </div>
            )
        }

        if (isGoalAchieved) return null

        // Check if progress percentage is too close to 100% to prevent overlap
        const isTooCloseToGoal = progressPercentage > 90

        return (
            <div className="relative flex w-full items-center pb-2">
                <p
                    className={twMerge(
                        'absolute text-body-s',
                        progressPercentage < 10 ? 'left-0' : isTooCloseToGoal ? 'left-0' : '-translate-x-1/2'
                    )}
                    style={progressPercentage < 10 || isTooCloseToGoal ? {} : { left: `${progressPercentage}%` }}
                >
                    {formatCurrency(progress)}
                </p>
                <div className="absolute right-0 flex flex-col items-end">
                    <p className="text-body-s">100%</p>
                </div>
            </div>
        )
    }

    const getMarkers = (): ProgressBarMarker[] => {
        if (!isClosed) return []

        if (isOverGoal) {
            return [
                { position: goalPercentage, className: 'bg-green-500' },
                { position: 'end', className: 'bg-action-secondary' },
            ]
        }

        const markers: ProgressBarMarker[] = []
        if (!isGoalAchieved) markers.push({ position: progressPercentage, className: 'bg-green-500' })
        markers.push(
            isGoalAchieved
                ? {
                      position: 'end',
                      className: 'bg-green-500',
                      label: <p className="absolute right-0 bottom-full mb-2 text-body-s whitespace-nowrap">100%</p>,
                  }
                : { position: 100, className: 'bg-red-200' }
        )
        return markers
    }

    return (
        <div className="relative flex w-full flex-col gap-2">
            {renderStatusText()}
            {renderLabels()}

            <ProgressBar
                value={isOverGoal ? goalPercentage : progressPercentage}
                trackClassName={getTrackColor()}
                fillClassName="bg-green-500"
                markers={getMarkers()}
            />
        </div>
    )
}

export default PotProgress
