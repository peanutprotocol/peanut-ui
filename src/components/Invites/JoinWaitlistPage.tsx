'use client'

import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { useEffect, useMemo, useState } from 'react'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from 'tailwind-merge'
import ValidatedInput from '../Global/ValidatedInput'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '../Global/ErrorAlert'
import peanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_02.gif'
import chillPeanutAnim from '@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_01.gif'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import PeanutLoading from '../Global/PeanutLoading'
import { useSetupStore } from '@/redux/hooks'
import { useNotifications } from '@/hooks/useNotifications'
import { updateUserById } from '@/app/actions/users'

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const JoinWaitlistPage = () => {
    const { fetchUser, isFetchingUser, logoutUser, user } = useAuth()
    const router = useRouter()
    const { inviteType, inviteCode: setupInviteCode } = useSetupStore()
    const { requestPermission, afterPermissionAttempt, isPermissionGranted } = useNotifications()

    // Determine initial step: skip email if already on file, skip notifications if already granted
    const initialStep = useMemo<1 | 2 | 3>(() => {
        if (user?.user.email) {
            return isPermissionGranted ? 3 : 2
        }
        return 1
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const [step, setStep] = useState<1 | 2 | 3>(initialStep)

    // Step 1: Email state
    const [emailValue, setEmailValue] = useState('')
    const [emailError, setEmailError] = useState('')
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)

    // Step 3: Invite code state
    const [inviteCode, setInviteCode] = useState(setupInviteCode)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const { data, isLoading: isLoadingWaitlistPosition } = useQuery({
        queryKey: ['waitlist-position'],
        queryFn: () => invitesApi.getWaitlistQueuePosition(),
        enabled: !!user?.user.userId,
    })

    // Step 1: Submit email via server action
    const handleEmailSubmit = async () => {
        if (!isValidEmail(emailValue) || !user?.user.userId) return

        setIsSubmittingEmail(true)
        setEmailError('')

        try {
            const result = await updateUserById({ userId: user.user.userId, email: emailValue })
            if (result.error) {
                setEmailError(result.error)
            } else {
                setStep(isPermissionGranted ? 3 : 2)
            }
        } catch {
            setEmailError('Something went wrong. Please try again.')
        } finally {
            setIsSubmittingEmail(false)
        }
    }

    // Step 2: Enable notifications (always advances regardless of outcome)
    const handleEnableNotifications = async () => {
        try {
            await requestPermission()
            await afterPermissionAttempt()
        } catch {
            // permission denied or error — that's fine
        }
        setStep(3)
    }

    // Step 3: Validate and accept invite code
    const validateInviteCode = async (code: string): Promise<boolean> => {
        setIsLoading(true)
        try {
            const res = await invitesApi.validateInviteCode(code)
            return res.success
        } finally {
            setIsLoading(false)
        }
    }

    const handleAcceptInvite = async () => {
        setIsLoading(true)
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
            setIsLoading(false)
        }
    }

    const handleLogout = async () => {
        setIsLoggingOut(true)
        try {
            await logoutUser()
            router.push('/setup')
        } finally {
            setIsLoggingOut(false)
        }
    }

    useEffect(() => {
        if (!isFetchingUser && !user) {
            router.push('/setup')
        }
    }, [isFetchingUser, user, router])

    if (isLoadingWaitlistPosition) {
        return <PeanutLoading coverFullScreen />
    }

    const stepImage = step === 3 ? peanutAnim.src : chillPeanutAnim.src

    return (
        <InvitesPageLayout image={stepImage}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-white px-6 pb-8 pt-6 md:h-[100dvh] md:justify-center md:space-y-4',
                    'flex flex-col items-end justify-center gap-5 pt-8'
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    {/* Step 1: Email Collection */}
                    {step === 1 && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                            <h1 className="text-xl font-extrabold">Stay in the loop</h1>
                            <p className="text-base font-medium">
                                Enter your email so we can reach you when you get access.
                            </p>

                            <input
                                type="email"
                                aria-label="Email address"
                                placeholder="you@example.com"
                                value={emailValue}
                                onChange={(e) => {
                                    setEmailValue(e.target.value)
                                    setEmailError('')
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && isValidEmail(emailValue)) handleEmailSubmit()
                                }}
                                className="h-12 w-full rounded-sm border border-n-2 px-4 text-base outline-none focus:border-black"
                            />

                            {emailError && <ErrorAlert description={emailError} />}

                            <Button
                                shadowSize="4"
                                onClick={handleEmailSubmit}
                                disabled={!isValidEmail(emailValue) || isSubmittingEmail}
                                loading={isSubmittingEmail}
                            >
                                Continue
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Enable Notifications (skippable) */}
                    {step === 2 && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                            <h1 className="text-xl font-extrabold">Want instant updates?</h1>
                            <p className="text-base font-medium">We&apos;ll notify you the moment you get access.</p>

                            <Button shadowSize="4" onClick={handleEnableNotifications}>
                                Enable notifications
                            </Button>

                            <button onClick={() => setStep(3)} className="text-sm underline">
                                Not now
                            </button>
                        </div>
                    )}

                    {/* Step 3: Jail Screen */}
                    {step === 3 && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                            {!isPermissionGranted && (
                                <div className="flex items-center justify-between rounded-sm border border-n-2 px-3 py-2">
                                    <span className="text-xs font-medium text-n-3">
                                        Enable notifications to get updates when you&apos;re unlocked
                                    </span>
                                    <button
                                        onClick={handleEnableNotifications}
                                        className="ml-2 shrink-0 text-xs font-bold underline"
                                    >
                                        Enable
                                    </button>
                                </div>
                            )}

                            <h1 className="text-xl font-extrabold">You&apos;re still in Peanut jail</h1>

                            <h2 className="text-xl font-bold">Prisoner #{data?.position}</h2>
                            <p className="text-base font-medium">
                                No bail without an invite. Got a code? Prove it below. No code? Back to the waitlist. Go
                                beg your friend!
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
                                <ErrorAlert description="This code won't take you out of jail. Try another one!" />
                            )}

                            {error && <ErrorAlert description={error} />}

                            <button onClick={handleLogout} className="text-sm underline">
                                {isLoggingOut ? 'Please wait...' : 'Log in with a different account'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </InvitesPageLayout>
    )
}

export default JoinWaitlistPage
