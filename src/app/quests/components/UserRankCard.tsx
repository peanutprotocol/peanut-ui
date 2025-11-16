'use client'

interface UserRankCardProps {
    metric: number
    metricLabel: string
    questTitle: string
    badgeColor: string
}

export function UserRankCard({ metric, metricLabel, questTitle, badgeColor }: UserRankCardProps) {
    const getBadgeColorClasses = (color: string) => {
        switch (color) {
            case 'YELLOW':
                return 'from-yellow-400 to-yellow-600'
            case 'PINK':
                return 'from-pink-400 to-pink-600'
            case 'BLUE':
                return 'from-blue-400 to-blue-600'
            default:
                return 'from-gray-400 to-gray-600'
        }
    }

    return (
        <div
            className={`mb-8 rounded-xl bg-gradient-to-r p-6 shadow-lg ${getBadgeColorClasses(badgeColor)} text-white`}
        >
            <div className="text-center">
                <p className="mb-2 text-lg font-semibold opacity-90">Your Status in {questTitle}</p>
                <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-black">{metric}</span>
                    <span className="text-xl font-medium opacity-90">{metricLabel}</span>
                </div>
                <p className="mt-3 text-sm opacity-80">Keep going to climb the leaderboard!</p>
            </div>
        </div>
    )
}

