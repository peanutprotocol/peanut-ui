'use client'
import { Button } from '@/components/0_Bruddle'
import Divider from '@/components/0_Bruddle/Divider'
import Attachment from '@/components/Global/Attachment'
import Card from '@/components/Global/Card'
import UserCard from '@/components/User/UserCard'
import { IAttachmentOptions } from '@/redux/types/send-flow.types'
import { ApiUser } from '@/services/users'
import { useRouter } from 'next/navigation'

interface DirectRequestConfirmViewProps {
    user: ApiUser
    amount: string
    attachmentOptions?: IAttachmentOptions
    onConfirm: () => void
    walletBalance?: string
}

const DirectRequestConfirmView = ({
    user,
    amount,
    attachmentOptions,
    onConfirm,
    walletBalance,
}: DirectRequestConfirmViewProps) => {
    const router = useRouter()
    return (
        <div className="flex flex-col gap-4">
            <UserCard type="request" username={user.username} fullName={user.fullName} />

            <Card className="p-4">
                <div className="space-y-1 text-center">
                    <h2 className="text-4xl font-extrabold">${amount}</h2>
                    {walletBalance && (
                        <div className="mt-0.5 text-center text-xs text-grey-1">Your balance: ${walletBalance}</div>
                    )}
                </div>
            </Card>

            <Attachment attachmentOptions={attachmentOptions} />

            <Button
                onClick={onConfirm}
                disabled // todo: disabled until direct req implemented, to be done in history project
                shadowSize="4"
                className="bg-primary-1"
            >
                <div className="flex items-center justify-center gap-2">Coming Soon</div>
            </Button>

            <Divider text="or" />

            <Button variant="primary-soft" onClick={() => router.push('/request/create')} shadowSize="4">
                Request via link instead
            </Button>
        </div>
    )
}

export default DirectRequestConfirmView
