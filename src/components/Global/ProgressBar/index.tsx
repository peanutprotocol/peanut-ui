import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ProgressBarProps {
    goal: number
    progress: number
    isClosed: boolean
}

const ProgressBar: React.FC<ProgressBarProps> = ({ goal, progress, isClosed }) => {
    const isOverGoal = progress > goal
    const isGoalAchieved = progress >= goal && !isOverGoal
    const totalValue = isOverGoal ? progress : goal

    const goalPercentage = (goal / totalValue) * 100
    const progressPercentage = (progress / totalValue) * 100
    const percentage = Math.round((progress / goal) * 100)

    const formatCurrency = (value: number) => `$${value.toFixed(2)}`

    const getStatusText = () => {
        if (isOverGoal) return 'Goal exceeded!'
        if (isGoalAchieved) return 'Goal achieved!'
        return `${100 - percentage}% below goal`
    }

    const getBackgroundColor = () => {
        if (!isClosed) return 'bg-grey-2'
        return isGoalAchieved ? 'bg-success-3' : 'bg-error-4'
    }

    const renderStatusText = () => {
        if (!isClosed) return null
        return (
            <div className="flex items-center gap-1 text-base font-medium">
                <p>{getStatusText()}</p>
            </div>
        )
    }

    const renderLabels = () => {
        if (!isClosed) {
            return (
                <div className="flex w-full items-center justify-between text-sm">
                    <p className="text-grey-5">{formatCurrency(progress)} contributed</p>
                    <p className="text-grey-5">{formatCurrency(goal - progress)} remaining</p>
                </div>
            )
        }

        if (isOverGoal) {
            return (
                <div className="relative flex w-full items-center pb-2">
                    <p className="absolute -translate-x-1/2 text-sm font-medium" style={{ left: `${goalPercentage}%` }}>
                        100%
                    </p>
                    <p className="absolute right-0 text-sm font-medium">{formatCurrency(progress)}</p>
                </div>
            )
        }

        if (isGoalAchieved) return null

        return (
            <div className="relative flex w-full items-center pb-2">
                <p className="absolute -translate-x-1/2 text-sm" style={{ left: `${progressPercentage}%` }}>
                    {formatCurrency(progress)}
                </p>
                <div className="absolute right-0 flex flex-col items-end">
                    <p className="text-sm">{percentage}%</p>
                </div>
            </div>
        )
    }

    const renderMarker = (color: string, position: string | number, isPercentage = true) => {
        const positionStyle = typeof position === 'string' ? { left: position } : { left: `${position}%` }
        return (
            <div
                className="absolute top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                style={positionStyle}
            >
                <div className={twMerge('h-4 w-[3px] rounded-sm transition-all duration-300', color)} />
            </div>
        )
    }

    const renderGoalMarker = () => {
        const markerColor = isGoalAchieved ? 'bg-success-3' : 'bg-error-4'
        const containerClasses = twMerge(
            'absolute top-1/2 z-10 -translate-y-1/2 transition-all duration-300',
            isGoalAchieved ? 'right-0' : '-translate-x-1/2'
        )
        const containerStyle = isGoalAchieved ? {} : { left: '100%' }

        return (
            <div className={containerClasses} style={containerStyle}>
                {isGoalAchieved && <p className="absolute bottom-full right-0 mb-2 whitespace-nowrap text-sm">100%</p>}
                <div className={twMerge('h-4 w-[3px] rounded-sm transition-all duration-300', markerColor)} />
            </div>
        )
    }

    const renderProgressBar = () => {
        const barBaseClasses = 'absolute left-0 h-1.5 rounded-full transition-all duration-300 ease-in-out'

        if (isOverGoal) {
            return (
                <>
                    <div className={twMerge(barBaseClasses, 'w-full bg-yellow-1')} />
                    <div className={twMerge(barBaseClasses, 'bg-success-3')} style={{ width: `${goalPercentage}%` }} />
                    {isClosed && (
                        <>
                            {renderMarker('bg-success-3', goalPercentage)}
                            {renderMarker('bg-yellow-1', '100%', false)}
                        </>
                    )}
                </>
            )
        }

        return (
            <>
                <div className={twMerge(barBaseClasses, 'w-full', getBackgroundColor())} />
                <div className={twMerge(barBaseClasses, 'bg-success-3')} style={{ width: `${progressPercentage}%` }} />
                {isClosed && (
                    <>
                        {!isGoalAchieved && renderMarker('bg-success-3', progressPercentage)}
                        {renderGoalMarker()}
                    </>
                )}
            </>
        )
    }

    return (
        <div className="relative flex w-full flex-col gap-2">
            {renderStatusText()}
            {renderLabels()}

            <div className="relative flex h-1.5 w-full items-center">{renderProgressBar()}</div>
        </div>
    )
}

export default ProgressBar
