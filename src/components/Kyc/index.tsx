'use client'
import * as assets from '@/assets'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'
import { Button, Card } from '../0_Bruddle'
import Divider from '../0_Bruddle/Divider'
import { GlobalKYCComponent } from '../Global/KYCComponent'

export const KYCComponent = () => {
    const { user, isFetchingUser } = useAuth()

    if (!user && isFetchingUser) {
        return (
            <div className="relative flex w-full items-center justify-center">
                <div className="animate-spin">
                    <img src={assets.PEANUTMAN_LOGO.src} alt="logo" className="h-6 sm:h-10" />
                    <span className="sr-only">Loading...</span>
                </div>
            </div>
        )
    }

    if (user && user?.user?.kycStatus === 'approved') {
        return (
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header>
                    <Card.Title>Welcome back, {user?.user?.username ?? user?.user?.email}</Card.Title>
                    <Card.Description>You have already completed the KYC process!</Card.Description>
                </Card.Header>
                <Card.Content className="col gap-4 py-4">
                    <Link href={'/cashout'} className="w-full">
                        <Button>Go to Cashout</Button>
                    </Link>
                    <Divider text="OR" />
                    <Link href={'/home'} className="w-full">
                        <Button variant="stroke">Go to Dashboard</Button>
                    </Link>
                </Card.Content>
            </Card>
        )
    }

    return (
        <GlobalKYCComponent
            intialStep={user?.user?.email ? 1 : 0}
            offrampForm={{
                email: user?.user?.email ?? '',
                name: user?.user?.full_name ?? '',
                password: '',
                recipient: '',
            }}
            setOfframpForm={() => {}}
            onCompleted={() => {}}
        />
    )
}
