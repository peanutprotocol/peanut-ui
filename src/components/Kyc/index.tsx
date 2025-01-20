'use client'
import * as assets from '@/assets'
import * as context from '@/context'
import { useAuth } from '@/context/authContext'
import Link from 'next/link'
import { useContext, useState } from 'react'
import { Button, Card } from '../0_Bruddle'
import Divider from '../0_Bruddle/Divider'
import { GlobalKYCComponent } from '../Global/KYCComponent'

export const KYCComponent = () => {
    const { user, logoutUser, isFetchingUser } = useAuth()
    const [errorState, setErrorState] = useState<{
        showError: boolean
        errorMessage: string
    }>({ showError: false, errorMessage: '' })
    const { setLoadingState, loadingState, isLoading } = useContext(context.loadingStateContext)
    const handleLogout = async () => {
        try {
            setLoadingState('Logging out')
            await logoutUser()
        } catch (error) {
            console.error('Error logging out', error)
            setErrorState({
                showError: true,
                errorMessage: 'Error logging out',
            })
        } finally {
            setLoadingState('Idle')
        }
    }

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

    if (user && user?.user?.kycStatus === 'verified') {
        return (
            <Card className="shadow-none sm:shadow-primary-4">
                <Card.Header className="mx-auto text-center">
                    <Card.Title className="text-center">
                        Welcome back, {user?.user?.username ?? user?.user?.email}
                    </Card.Title>
                    <Card.Description className="text-center">
                        You have already completed the KYC process!
                    </Card.Description>
                </Card.Header>
                <Card.Content className="col gap-4 py-4">
                    <Link href={'/profile'} className="w-full">
                        <Button>Go to profile</Button>
                    </Link>
                    <Divider text="OR" />
                    <Button variant="stroke" loading={isLoading} onClick={handleLogout}>
                        {isLoading ? loadingState : 'Logout'}
                    </Button>
                    {errorState.showError && (
                        <div className="text-center">
                            <label className=" text-h8 font-normal text-red ">{errorState.errorMessage}</label>
                        </div>
                    )}
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
