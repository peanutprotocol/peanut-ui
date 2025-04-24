import Card, { CardPosition } from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { getInitialsFromName } from '@/utils'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'

interface SearchResultCardProps {
    username: string
    fullName: string | null
    position?: CardPosition
}

export const SearchResultCard = ({ username, fullName, position = 'middle' }: SearchResultCardProps) => {
    const router = useRouter()
    const initials = useMemo(() => {
        if (fullName) {
            return getInitialsFromName(fullName)
        }
        return getInitialsFromName(username)
    }, [fullName, username])

    const handleClick = () => {
        router.push(`/${username}`)
    }

    return (
        <Card onClick={handleClick} position={position} className="cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success-3 text-sm font-bold">
                        {initials}
                    </div>
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
