'use client'

import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import React, { useEffect, useState } from 'react'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from 'tailwind-merge'
import ValidatedInput from '../Global/ValidatedInput'
import { Button } from '../0_Bruddle'
import ErrorAlert from '../Global/ErrorAlert'
import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_02.gif'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import PeanutLoading from '../Global/PeanutLoading'
import { useSetupStore } from '@/redux/hooks'

const JoinWaitlistPage = () => {
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')
    const { fetchUser, isFetchingUser, logoutUser, user } = useAuth()
    const [isLoggingOut, setisLoggingOut] = useState(false)
    const router = useRouter()
    const { inviteType, inviteCode: setupInviteCode } = useSetupStore()
    const [inviteCode, setInviteCode] = useState(setupInviteCode)

    const { data, isLoading: isLoadingWaitlistPosition } = useQuery({
        queryKey: ['waitlist-position'],
        queryFn: () => invitesApi.getWaitlistQueuePosition(),
        enabled: !!user?.user.userId,
    })

    const validateInviteCode = async (inviteCode: string): Promise<boolean> => {
        setisLoading(true)
        const res = await invitesApi.validateInviteCode(inviteCode)
        setisLoading(false)
        return res.success
    }

    const handleAcceptInvite = async () => {
        setisLoading(true)
        try {
            const res = await invitesApi.acceptInvite(inviteCode, inviteType)
            if (res.success) {
                sessionStorage.setItem('showNoMoreJailModal', 'true')
                fetchUser()
            } else {
                setError('Something went wrong. Please try again or contact support.')
            }
        } catch {
            setError('Something went wrong. Please try again or contact support.')
        } finally {
            setisLoading(false)
        }
    }

    const handleLogout = async () => {
        setisLoggingOut(true)
        await logoutUser()
        router.push('/setup')
        setisLoggingOut(false)
    }

    useEffect(() => {
        if (!isFetchingUser && !user) {
            router.push('/setup')
        }
    }, [isFetchingUser, user, router])

    if (isLoadingWaitlistPosition) {
        return <PeanutLoading coverFullScreen />
    }

    return (
        <InvitesPageLayout image={peanutAnim.src}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-white px-6 pb-8 pt-6 md:h-[100dvh] md:justify-center md:space-y-4',
                    'flex flex-col items-end justify-center gap-5 pt-8 '
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                        <h1 className="text-xl font-extrabold">You&apos;re still in Peanut jail</h1>

                        <h2 className="text-xl font-bold">Prisoner #{data?.position}</h2>
                        <p className="text-base font-medium">
                            No bail without an invite. Got a code? Prove it below. No code? Back to the waitlist. Go beg
                            your friend!
                        </p>

                        <div className="flex items-center gap-2">
                            <ValidatedInput
                                placeholder="Enter an invite code"
                                value={inviteCode}
                                debounceTime={750}
                                validate={validateInviteCode}
                                onUpdate={({ value, isValid, isChanging }) => {
                                    setIsValid(isValid)
                                    setIsChanging(isChanging)
                                    setInviteCode(value)
                                }}
                                isSetupFlow
                                isInputChanging={isChanging}
                                className={twMerge(
                                    !isValid && !isChanging && !!inviteCode && 'border-error dark:border-error',
                                    isValid &&
                                        !isChanging &&
                                        !!inviteCode &&
                                        'border-secondary-8 dark:border-secondary-8',
                                    'rounded-sm'
                                )}
                            />

                            <Button
                                className="h-12 w-4/12"
                                loading={isLoading}
                                shadowSize="4"
                                onClick={() => {
                                    handleAcceptInvite()
                                }}
                                disabled={!isValid || isChanging || isLoading}
                            >
                                Next
                            </Button>
                        </div>

                        {!isValid && !isChanging && !!inviteCode && (
                            <ErrorAlert description="This code won’t take you out of jail. Try another one!" />
                        )}

                        {/* Show error from the API call */}
                        {error && <ErrorAlert description={error} />}

                        <button onClick={handleLogout} className="text-sm underline">
                            {isLoggingOut ? 'Please wait...' : 'Log in with a different account'}
                        </button>
                    </div>
                </div>
            </div>
        </InvitesPageLayout>
    )
}

export default JoinWaitlistPage
