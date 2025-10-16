'use client'
import { Button, Card } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import { useAuth } from '@/context/authContext'
import { useRouter } from 'next/navigation'
import { type FC } from 'react'

interface ClaimedViewProps {
    amount: number | bigint
    senderUsername: string
}

export const ClaimedView: FC<ClaimedViewProps> = ({ amount, senderUsername }) => {
    const { user } = useAuth()
    const router = useRouter()

    return (
        <Card className="shadow-none sm:shadow-4">
            <Card.Header className="space-y-2 border-0">
                <Card.Title className="mx-auto">
                    <div className="flex size-8 items-center justify-center rounded-full bg-[#FFCC00]">
                        <Icon name="info" size={16} />
                    </div>
                </Card.Title>
                <Card.Description className="mx-auto font-medium text-black">Link no longer available</Card.Description>
            </Card.Header>

            <Card.Content className="mx-auto flex flex-col gap-2 space-y-4 pb-8">
                <p className="text-center text-grey-1">
                    The <span className="font-bold">${amount}</span> sent by{' '}
                    <span className="font-bold"> {senderUsername}</span> has already been claimed.
                </p>

                {!user && <p className="text-center text-sm text-grey-1">Create a wallet to receive future links.</p>}

                <Button
                    onClick={() => {
                        if (user) {
                            router.push('/home')
                        } else {
                            router.push('/setup')
                        }
                    }}
                    shadowSize="4"
                    className="text-sm md:text-base"
                >
                    {user ? 'Back to Home' : 'Get Started'}
                </Button>
            </Card.Content>
        </Card>
    )
}
