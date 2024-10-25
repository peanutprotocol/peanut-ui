import { useAuth } from '@/context/authContext'
import Icon from '../Global/Icon'

const HomeNav = () => {
    const { user } = useAuth()
    const points = user?.totalPoints ?? 0
    const invites = user?.referredUsers ?? 0

    return (
        <div className="flex h-10 flex-row items-center justify-center gap-4 border-b-2 border-black bg-purple-1">
            <span className="">{points} Points</span>
            <Icon name="heart" />
            <span className="">{invites} Invites</span>
        </div>
    )
}

export default HomeNav
