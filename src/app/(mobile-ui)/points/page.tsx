'use client'

import Icon from '@/components/Global/Icon'
import { useAuth } from '@/context/authContext'
import peanutClub from '@/assets/peanut/peanut-club.png'

const PointsPage = () => {
    const { user } = useAuth()
    const points = user?.totalPoints ?? 0
    const invites = user?.referredUsers ?? 0

    return (
        <div className="flex h-full w-full flex-col items-center justify-between">
            <div className="flex flex-col gap-2">
                <div>
                    <div className="flex flex-row items-center">
                        <Icon name="arrow-next" className="h-8 w-8" />
                        {points} Points
                    </div>
                </div>
                <div>
                    <div className="flex flex-row items-center">
                        <Icon name="arrow-next" className="h-8 w-8" />
                        {invites} Invites
                    </div>
                </div>
            </div>
            <img src={peanutClub.src} className="h-[240px] w-[240px] object-contain" alt="logo" />
        </div>
    )
}

export default PointsPage
