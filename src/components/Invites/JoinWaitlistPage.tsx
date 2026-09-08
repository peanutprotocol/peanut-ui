'use client'

import { useAuth } from '@/context/authContext'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import { Notification } from '@/components/0_Bruddle/Notification'
import { invitesApi } from '@/services/invites'
import { useEffect, useRef, useState } from 'react'
import InvitesPageLayout from './InvitesPageLayout'
import { twMerge } from '@/utils/tw'
import ValidatedInput from '../Global/ValidatedInput'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PeanutWavingHello, PeanutPointing } from '@/assets/mascot'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Loading from '../Global/Loading'
import { useSetupStore } from '@/redux/hooks'
import { useNotifications } from '@/hooks/useNotifications'
import { updateUserById } from '@/app/actions/users'
import { useQueryState, parseAsStringEnum } from 'nuqs'
import { isValidEmail } from '@/utils/format.utils'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import posthog from 'posthog-js'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getFromCookie, removeFromCookie, toInviteCode } from '@/utils/general.utils'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { settleAcceptedInviteAcquisition } from '@/services/invite-acquisition'
import { isConfirmedBadgeCampaignClaim } from '@/services/badge-campaigns'

type WaitlistStep = 'email' | 'notifications' | 'jail'
type InviteAcceptanceOutcome = 'onboarding_resolved' | 'campaign_only' | 'failed'

const nextStepAfterEmail = (isPermissionGranted: boolean): WaitlistStep =>
    isPermissionGranted ? 'jail' : 'notifications'

const JoinWaitlistPage = () => {
    const t = useTranslations('invites')
    const tCommon = useTranslations('common')
    const tSetup = useTranslations('setup')
    const tNotifications = useTranslations('notifications')
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

    // Step 3: Invite code state. A pending code can also survive in the
    // inviteCode cookie when the register-time accept failed (useZeroDev keeps
    // it there so this page can retry after an app restart).
    const inviteCodeFromCookie = getFromCookie('inviteCode')
    const pendingInviteCode =
        setupInviteCode?.trim() || (typeof inviteCodeFromCookie === 'string' ? inviteCodeFromCookie.trim() : '')
    const [inviteCode, setInviteCode] = useState(pendingInviteCode)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isValidating, setIsValidating] = useState(false)
    const [isAccepting, setIsAccepting] = useState(false)
    const [error, setError] = useState('')
    const [isLoggingOut, setIsLoggingOut] = useState(false)
    const [isAutoAccepting, setIsAutoAccepting] = useState(!!pendingInviteCode)

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

    // Track waitlist step views — measures email-capture conversion + jail-stuck volume.
    // Skipped while auto-accepting: the user never sees the step, and counting
    // it would pollute the funnel.
    useEffect(() => {
        if (isAutoAccepting) return
        posthog.capture(ANALYTICS_EVENTS.WAITLIST_STEP_VIEWED, { step })
    }, [step, isAutoAccepting])

    // Step 1: Submit email via server action
    const handleEmailSubmit = async () => {
        if (!isValidEmail(emailValue) || isSubmittingEmail) return

        if (!user?.user.userId) {
            setEmailError(t('accountNotLoaded'))
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
                setEmailError(t('emailSavedProfileFailed'))
                return
            }

            // Mark email step as done BEFORE setStep to prevent the useEffect
            // from racing and resetting the step back to 'email'
            setEmailStepDone(true)
            setStep(nextStepAfterEmail(isPermissionGranted))
        } catch (e) {
            console.error('[JoinWaitlist] handleEmailSubmit failed:', e)
            setEmailError(t('emailSubmitFailed'))
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
            const onboardingResolved = res.success && res.onboardingResolved
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
                valid: onboardingResolved,
                source: 'waitlist_page',
            })
            return onboardingResolved
        } catch (e) {
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid: false, source: 'waitlist_page' })
            throw e
        } finally {
            setIsValidating(false)
        }
    }

    // Shared by the manual Next button and the automatic attempt below.
    // Campaign-only compatibility can settle without granting onboarding.
    const acceptInviteWithCode = async (
        code: string,
        source: 'waitlist_page' | 'waitlist_auto'
    ): Promise<InviteAcceptanceOutcome> => {
        const res = await invitesApi.acceptInvite(code, inviteType)
        if (!res.success) {
            posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                invite_code: code,
                error_message: 'API returned unsuccessful',
                source,
            })
            return 'failed'
        }
        if (!res.onboardingResolved) {
            if (!res.legacyAcquisition) {
                posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                    invite_code: code,
                    error_message: 'Campaign-only response omitted acquisition descriptor',
                    source,
                })
                return 'failed'
            }

            // The adapter has done all it can. Settle terminal claims and keep
            // only retryable campaign state; never retry the non-invite code.
            settleAcceptedInviteAcquisition(res.legacyAcquisition, res.claims)
            removeFromCookie('inviteCode')
            // Provenance is audit-only. Refresh every confirmed permanent award
            // so any badge-owned access/reward projection is visible immediately;
            // unavailable outcomes must not masquerade as a capability change.
            if (res.claims.some(isConfirmedBadgeCampaignClaim)) await fetchUser()
            return 'campaign_only'
        }
        posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPTED, { invite_code: code, source })
        sessionStorage.setItem('showNoMoreJailModal', 'true')
        removeFromCookie('inviteCode')
        await fetchUser()
        return 'onboarding_resolved'
    }

    const handleAcceptInvite = async () => {
        setIsAccepting(true)
        try {
            const outcome = await acceptInviteWithCode(inviteCode, 'waitlist_page')
            if (outcome === 'failed') {
                setError(tCommon('genericError'))
            }
        } catch {
            posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                invite_code: inviteCode,
                error_message: 'Exception during invite acceptance',
                source: 'waitlist_page',
            })
            setError(tCommon('genericError'))
        } finally {
            setIsAccepting(false)
        }
    }

    /*
     * Auto-redeem a pending invite before showing any waitlist UI. The
     * register-time accept in useZeroDev is fail-open (signup continues even
     * if it fails), so a user who provided an inviter can still land here
     * without access — one automatic attempt makes that recovery invisible.
     * Falls back to the manual flow silently on failure; runs at most once.
     */
    const autoAcceptRanRef = useRef(false)
    useEffect(() => {
        if (!isAutoAccepting || autoAcceptRanRef.current) return
        if (isFetchingUser || !user?.user.userId) return
        autoAcceptRanRef.current = true
        ;(async () => {
            try {
                // on success the refetched user has access and the layout
                // unmounts this page; the setState below is then a no-op
                await acceptInviteWithCode(pendingInviteCode, 'waitlist_auto')
            } catch {
                posthog.capture(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, {
                    invite_code: pendingInviteCode,
                    error_message: 'Exception during invite acceptance',
                    source: 'waitlist_auto',
                })
            }
            setIsAutoAccepting(false)
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutoAccepting, isFetchingUser, user?.user.userId])

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

    const stepImage = step === 'jail' ? PeanutPointing.src : PeanutWavingHello.src

    if (isAutoAccepting) return <Loading variant="mascot" coverFullScreen />

    return (
        <InvitesPageLayout image={stepImage} showRagdoll={step === 'jail'}>
            <div
                className={twMerge(
                    'flex flex-grow flex-col justify-between overflow-hidden bg-background-default px-6 pt-6 pb-8 md:space-y-4 md:h-dvh md:justify-center',
                    'flex flex-col items-end justify-center gap-6 pt-8'
                )}
            >
                <div className="mx-auto w-full md:max-w-xs">
                    {/* Step 1: Email Collection */}
                    {step === 'email' && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-6">
                            <h1 className="text-heading-xs text-foreground-primary">{t('emailTitle')}</h1>
                            <p className="text-body-m">{t('emailDescription')}</p>

                            {/* input + its field error form one column, 4px apart (form-field board 17788:19179) */}
                            <div className="flex flex-col gap-1">
                                <BaseInput
                                    type="email"
                                    variant="sm"
                                    aria-label={t('emailLabel')}
                                    placeholder={t('emailPlaceholder')}
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
                                {emailError && <FieldError>{emailError}</FieldError>}
                            </div>

                            <Button
                                shadowSize="4"
                                onClick={handleEmailSubmit}
                                disabled={!isValidEmail(emailValue) || isSubmittingEmail}
                                loading={isSubmittingEmail}
                            >
                                {tCommon('continue')}
                            </Button>

                            {emailError && (
                                <LinkButton onClick={handleSkipEmail} className="self-center">
                                    {tCommon('skipForNow')}
                                </LinkButton>
                            )}
                        </div>
                    )}

                    {/* Step 2: Enable Notifications (skippable) */}
                    {step === 'notifications' && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-6">
                            <h1 className="text-heading-xs text-foreground-primary">{t('notificationsTitle')}</h1>
                            <p className="text-body-m">{t('notificationsDescription')}</p>

                            <Button shadowSize="4" onClick={handleEnableNotifications}>
                                {tNotifications('enable')}
                            </Button>

                            <LinkButton onClick={() => setStep('jail')} className="self-center">
                                {tNotifications('notNow')}
                            </LinkButton>
                        </div>
                    )}

                    {/* Step 3: Jail Screen */}
                    {step === 'jail' && isLoadingWaitlistPosition && <Loading variant="mascot" coverFullScreen />}
                    {step === 'jail' && !isLoadingWaitlistPosition && (
                        <div className="flex h-full flex-col justify-between gap-4 md:gap-10 md:pt-6">
                            <h1 className="text-heading-xs text-foreground-primary">{t('inviteOnlyTitle')}</h1>

                            <h2 className="text-heading-xs text-foreground-primary">
                                {data?.position ? t('inLineWithPosition', { position: data.position }) : t('inLine')}
                            </h2>
                            <p className="text-body-m">{t('skipTheLine')}</p>

                            {/* input + its field error form one column, 4px apart (form-field board 17788:19179) */}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <ValidatedInput
                                        placeholder={tSetup('waitlist.inviterUsernamePlaceholder')}
                                        value={inviteCode}
                                        debounceTime={750}
                                        validate={validateInviteCode}
                                        shouldValidate={(v) => toInviteCode(v).length >= USERNAME_MIN_LENGTH}
                                        onUpdate={({ value, isValid, isChanging }) => {
                                            setIsValid(isValid)
                                            setIsChanging(isChanging)
                                            setInviteCode(value)
                                        }}
                                        isSetupFlow
                                        isInputChanging={isChanging}
                                        className="rounded-sm"
                                    />

                                    <Button
                                        className="h-12 w-4/12"
                                        loading={isAccepting}
                                        shadowSize="4"
                                        onClick={handleAcceptInvite}
                                        disabled={!isValid || isChanging || isValidating || isAccepting}
                                    >
                                        {tCommon('next')}
                                    </Button>
                                </div>

                                {!isValid && !isChanging && !!inviteCode && (
                                    <FieldError>{tSetup('waitlist.inviterNotFound')}</FieldError>
                                )}
                            </div>

                            {error && <Notification priority="error">{error}</Notification>}

                            <LinkButton onClick={handleLogout} className="self-center">
                                {isLoggingOut ? t('pleaseWait') : t('logInDifferentAccount')}
                            </LinkButton>
                        </div>
                    )}
                </div>
            </div>
        </InvitesPageLayout>
    )
}

export default JoinWaitlistPage
