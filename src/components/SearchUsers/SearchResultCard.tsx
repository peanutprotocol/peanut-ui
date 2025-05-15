import Card, { CardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import AvatarWithBadge from '../Profile/AvatarWithBadge'

interface SearchResultCardProps {
    username: string
    fullName: string | null
    position?: CardPosition
    onClick?: (username: string) => void
}

export const SearchResultCard = ({ username, fullName, position = 'middle', onClick }: SearchResultCardProps) => {
    const router = useRouter()

    const handleClick = () => {
        if (onClick) {
            onClick(username)
        } else {
            router.push(`/${username}`)
        }
    }

    return (
        <Card onClick={handleClick} position={position} className="cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <AvatarWithBadge size="extra-small" name={fullName || username} />
                    <div className="flex flex-col">
                        <div className="font-medium">{fullName || username}</div>
                        <div className="text-sm text-grey-1">@{username}</div>
                    </div>
                </div>
                <div className="flex size-6 items-center justify-center rounded-full border border-black bg-primary-1 p-0 shadow-[0.12rem_0.12rem_0_#000000]">
                    <Icon name="chevron-up" size={20} className="rotate-90" />
                </div>
            </div>
        </Card>
    )
}
