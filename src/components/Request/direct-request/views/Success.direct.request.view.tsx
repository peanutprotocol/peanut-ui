'use client'
import { Button } from '@/components/0_Bruddle'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import Loading from '@/components/Global/Loading'
import { ApiUser } from '@/services/users'
import { getInitialsFromName } from '@/utils'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface DirectRequestSuccessViewProps {
    user: ApiUser
    amount: string
    message?: string
    onBack: () => void
}

const DirectRequestSuccessView = ({ user, amount, message, onBack }: DirectRequestSuccessViewProps) => {
    const initials = getInitialsFromName(user.fullName || user.username)
    const router = useRouter()
    const [showCheck, setShowCheck] = useState(false)

    useEffect(() => {
        // show loading for a brief moment, then show check mark
        const checkTimeout = setTimeout(() => {
            setShowCheck(true)
        }, 800)

        // redirect to home after 2 seconds
        const redirectTimeout = setTimeout(() => {
            router.push('/home')
        }, 2000)

        return () => {
            clearTimeout(checkTimeout)
            clearTimeout(redirectTimeout)
        }
    }, [router])

    return (
        <div className="flex flex-col gap-4">
            <Card className="p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success-3 text-2xl font-bold">
                        {initials}
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-xl">You just requested {user.fullName || user.username} for</h1>
                        <h2 className="text-4xl font-bold">${amount}</h2>
                        {message && <p className="text-grey-1">for {message}</p>}
                    </div>
                </div>
            </Card>

            <Button onClick={onBack} shadowSize="4" className="mx-auto w-38 rounded-full">
                <div className="flex size-7 items-center justify-center gap-0">
                    {showCheck ? <Icon name="check" size={24} className="animate-fadeIn" /> : <Loading />}
                </div>
                <div>Done!</div>
            </Button>
        </div>
    )
}

export default DirectRequestSuccessView
