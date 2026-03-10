'use client'

import { useAuth } from '@/context/authContext'
import { invitesApi } from '@/services/invites'
import { useEffect, useState } from 'react'
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
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { isValidEmail } from '@/utils/format.utils'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'

type WaitlistStep = 'email' | 'notifications' | 'jail'

const nextStepAfterEmail = (isPermissionGranted: boolean): WaitlistStep =>
    isPermissionGranted ? 'jail' : 'notifications'

const JoinWaitlistPage = () => {
    const { fetchUser, isFetchingUser, logoutUser, user } = useAuth()
    const router = useRouter()
    const { inviteType, inviteCode: setupInviteCode } = useSetupStore()
    const { requestPermission, afterPermissionAttempt, isPermissionGranted } = useNotifications()

    // URL-backed step state — survives refresh, enables deep-linking
    const [step, setStep] = useQueryState(
        'step',
        parseAsStringEnum<WaitlistStep>(['email', 'notifications', 'jail']).withDefault(
            (() => {
                if (user?.user.email) return nextStepAfterEmail(isPermissionGranted)
                return 'email'
            })()
        )
    )

    // Step 1: Email state
    const [emailValue, setEmailValue] = useState('')
    const [emailError, setEmailError] = useState('')
    const [isSubmittingEmail, setIsSubmittingEmail] = useState(false)

    // Step 3: Invite code state
    const [inviteCode, setInviteCode] = useState(setupInviteCode)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [error, setError] = useState('')
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const { data, isLoading: isLoadingWaitlistPosition } = useQuery({
        queryKey: ['waitlist-position', user?.user.userId],
        queryFn: () => invitesApi.getWaitlistQueuePosition(),
        enabled: !!user?.user.userId && step === 'jail',
    })

    // Track whether the email step has been completed or skipped this session,
    // so the step invariant useEffect doesn't race with react-query state updates
    const [emailStepDone, setEmailStepDone] = useState(!!user?.user.email)

    // Enforce step invariants: prevent URL bypass and fast-forward completed steps
    useEffect(() => {
        if (isFetchingUser) return
        if (step !== 'email' && !user?.user.email && !emailStepDone) {
            setStep('email')
        } else if (step === 'email' && (user?.user.email || emailStepDone)) {
            setStep(nextStepAfterEmail(isPermissionGranted))
        } else if (step === 'notifications' && isPermissionGranted) {
            setStep('jail')
        }
    }, [user?.user.email, isPermissionGranted, isFetchingUser, step, setStep, emailStepDone])

    // Sync emailStepDone when user data loads with an existing email
    useEffect(() => {
        if (user?.user.email) setEmailStepDone(true)
    }, [user?.user.email])

    // Step 1: Submit email via server action
    const handleEmailSubmit = async () => {
        if (!isValidEmail(emailValue) || isSubmittingEmail) return

        if (!user?.user.userId) {
            setEmailError('Account not loaded yet. Please wait a moment and try again.')
            return
        }

        setIsSubmittingEmail(true)
        setEmailError('')

        try {
            const result = await updateUserById({ userId: user.user.userId, email: emailValue })
            if (result.error) {
                setEmailError(result.error)
                return
            }

            const refreshedUser = await fetchUser()
            if (!refreshedUser?.user.email) {
                console.error('[JoinWaitlist] Email update succeeded but fetchUser did not return email')
                setEmailError('Email saved, but we had trouble loading your profile. Please try again.')
                return
            }

            // Mark email step as done BEFORE setStep to prevent the useEffect
            // from racing and resetting the step back to 'email'
            setEmailStepDone(true)
            setStep(nextStepAfterEmail(isPermissionGranted))
        } catch (e) {
            console.error('[JoinWaitlist] handleEmailSubmit failed:', e)
            setEmailError('Something went wrong. Please try again or skip this step.')
        } finally {
            setIsSubmittingEmail(false)
        }
    }

    const handleSkipEmail = () => {
        setEmailStepDone(true)
        setStep(nextStepAfterEmail(isPermissionGranted))
    }

    // Step 2: Enable notifications (always advances regardless of outcome)
    const handleEnableNotifications = async () => {
        try {
            await requestPermission()
            await afterPermissionAttempt()
        } catch {
            // permission denied or error — that's fine
        }
        setStep('jail')
    }

    // Step 3: Validate and accept invite code (separate loading states to avoid race)
    const validateInviteCode = async (code: string): Promise<boolean> => {
        setIsValidating(true)
        try {
            const res = await invitesApi.validateInviteCode(code)
            return res.success
        } finally {
            setIsValidating(false)
        }
    }

    const handleAcceptInvite = async () => {
        setIsAccepting(true)
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
            setIsAccepting(false)
        }
    }

    const handleLogout = async () => {
        setIsLoggingOut(true)
        try {
            await logoutUser()
            router.push('/setup')
        } finally {
            setIsLoggingOut(false)
            setError('')
        }
    }

    useEffect(() => {
        if (!isFetchingUser && !user) {
            router.push('/setup')
        }
    }, [isFetchingUser, user, router])

    const stepImage = step === 'jail' ? peanutAnim.src : chillPeanutAnim.src

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
                    {step === 'email' && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                            <h1 className="text-xl font-extrabold">Stay in the loop</h1>
                            <p className="text-base font-medium">
                                Enter your email so we can reach you when you get access.
                            </p>

                            <BaseInput
                                type="email"
                                variant="sm"
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
                                className="h-12"
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

                            {emailError && (
                                <button onClick={handleSkipEmail} className="text-sm underline">
                                    Skip for now
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 2: Enable Notifications (skippable) */}
                    {step === 'notifications' && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
                            <h1 className="text-xl font-extrabold">Want instant updates?</h1>
                            <p className="text-base font-medium">We&apos;ll notify you the moment you get access.</p>

                            <Button shadowSize="4" onClick={handleEnableNotifications}>
                                Enable notifications
                            </Button>

                            <button onClick={() => setStep('jail')} className="text-sm underline">
                                Not now
                            </button>
                        </div>
                    )}

                    {/* Step 3: Jail Screen */}
                    {step === 'jail' && isLoadingWaitlistPosition && <PeanutLoading coverFullScreen />}
                    {step === 'jail' && !isLoadingWaitlistPosition && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-5">
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
                                    loading={isAccepting}
                                    shadowSize="4"
                                    onClick={handleAcceptInvite}
                                    disabled={!isValid || isChanging || isValidating || isAccepting}
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
