'use client'
import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { ApiUser } from '@/services/users'
import { getExplorerUrl, getInitialsFromName } from '@/utils'
import Link from 'next/link'

interface DirectSendSuccessViewProps {
    user: ApiUser
    amount: string
    txHash: string
    chainId: string
    message?: string
    onBack: () => void
}

const DirectSendSuccessView = ({ user, amount, txHash, chainId, message, onBack }: DirectSendSuccessViewProps) => {
    const explorerUrl = `${getExplorerUrl(chainId)}/tx/${txHash}`
    const initials = getInitialsFromName(user.fullName || user.username)

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4">
                <div className="flex items-center gap-3">
                    <AvatarWithBadge className="bg-success-3" initials={initials} />
                    <div className="space-y-1">
                        <h1 className="text-xl">You just sent {user.fullName || user.username}</h1>
                        <h2 className="text-4xl font-bold">${amount}</h2>
                        {message && <p className="text-grey-1">for {message}</p>}
                        <Link
                            href={explorerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-center text-sm text-gray-500 underline"
                        >
                            View transaction
                        </Link>
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
