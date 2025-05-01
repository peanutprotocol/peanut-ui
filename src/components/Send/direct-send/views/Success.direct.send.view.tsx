'use client'
import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { ApiUser } from '@/services/users'
import { getInitialsFromName } from '@/utils'

interface DirectSendSuccessViewProps {
    user: ApiUser
    amount: string
    message?: string
    onBack: () => void
}

const DirectSendSuccessView = ({ user, amount, message, onBack }: DirectSendSuccessViewProps) => {
    const initials = getInitialsFromName(user.fullName || user.username)

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4">
                <div className="flex items-center gap-3">
                    <AvatarWithBadge className="bg-success-3" initials={initials} />
                    <div className="space-y-1">
                        <h1 className="text-lg font-bold">You just sent {user.fullName || user.username}</h1>
                        <h2 className="text-3xl font-extrabold">${amount}</h2>
                        {message && <p className="text-sm font-medium text-grey-1">for {message}</p>}
                    </div>
                </div>
            </Card>

            <Button onClick={onBack} shadowSize="4" className="mx-auto w-38 rounded-full">
                <div className="flex size-7 items-center justify-center gap-0">
                    <Icon name="check" size={24} />
                </div>
                <div>Done!</div>
            </Button>
        </div>
    )
}

export default DirectSendSuccessView
