'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useToast } from '@/components/0_Bruddle/Toast'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Sentry from '@sentry/nextjs'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { invitesApi } from '@/services/invites'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useLogin } from '@/hooks/useLogin'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { enableDemoMode, isDemoInviteCode } from '@/utils/demo'
import { useTranslations } from 'next-intl'
import { isCapacitor } from '@/utils/capacitor'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { userActions } from '@/redux/slices/user-slice'
import { DEMO_USER } from '@/constants/demo-data'
import { toInviteCode } from '@/utils/general.utils'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'

const JoinWaitlist = () => {
    const t = useTranslations('setup')
    const [inviteCode, setInviteCode] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')

    const toast = useToast()
    const { handleNext } = useSetupFlow()
    const dispatch = useAppDispatch()
    const { handleLoginClick } = useLogin()
    const router = useRouter()
    const queryClient = useQueryClient()

    useEffect(() => {
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_WAITLIST_VIEWED)
    }, [])

    const validateInviteCode = async (inviteCode: string): Promise<boolean> => {
        // Demo mode (native): `demo` is a client-only trigger — never hit the invite
        // API. Keeps it from creating accounts / bypassing the waitlist, and lets it
        // work even when the (prod) backend doesn't know the code.
        if (isCapacitor() && isDemoInviteCode(inviteCode)) {
            enableDemoMode()
            return true
        }
        try {
            setError('')
            setisLoading(true)
            const res = await invitesApi.validateInviteCode(inviteCode)
            const isValid = res.success
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
                valid: isValid,
                source: 'setup',
                invite_code: inviteCode,
            })
            if (!isValid) {
                setError(t('waitlist.inviterNotFound'))
            }
            return isValid
        } catch {
            posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, {
                valid: false,
                source: 'setup',
                invite_code: inviteCode,
            })
            setError(t('waitlist.inviterNotFound'))
            return false
        } finally {
            setisLoading(false)
        }
    }

    const handleError = (error: any) => {
        const errorMessage =
            error.code === 'LOGIN_CANCELED'
                ? t('waitlist.loginCanceled')
                : error.code === 'NO_PASSKEY'
                  ? t('waitlist.noPasskey')
                  : t('waitlist.loginUnexpectedError')
        toast.error(errorMessage)
        Sentry.captureException(error, { extra: { errorCode: error.code } })
    }

    const _onLoginClick = async () => {
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <ValidatedInput
                    placeholder={t('waitlist.inviterUsernamePlaceholder')}
                    value={inviteCode}
                    debounceTime={750}
                    validate={validateInviteCode}
                    shouldValidate={(v) => toInviteCode(v).length >= USERNAME_MIN_LENGTH}
                    onUpdate={({ value, isValid, isChanging }) => {
                        setIsValid(isValid)
                        setIsChanging(isChanging)
                        setInviteCode(value)
                        if (isChanging) setError('')
                    }}
                    isSetupFlow
                    isInputChanging={isChanging}
                    className={twMerge(
                        !isValid && !isChanging && !!inviteCode && 'border-error dark:border-error',
                        isValid && !isChanging && !!inviteCode && 'border-secondary-8 dark:border-secondary-8',
                        'rounded-sm'
                    )}
                />
                <Button
                    disabled={!isValid || isChanging || isLoading || inviteCode.length === 0}
                    onClick={() => {
                        // Demo mode: skip signup + passkey. Soft-nav (no reload) so the
                        // in-memory demo flag survives — a hard nav loses it and races the
                        // no-credential logout/redirect guards before localStorage is
                        // readable. Seed the user query so the app is logged-in instantly.
                        if (isCapacitor() && isDemoInviteCode(inviteCode)) {
                            enableDemoMode()
                            dispatch(userActions.setUser(DEMO_USER))
                            queryClient.setQueryData([USER], DEMO_USER)
                            router.push('/home')
                            return
                        }
                        dispatch(setupActions.setInviteCode(inviteCode))
                        handleNext()
                    }}
                    shadowSize="4"
                    className="h-12 w-4/12"
                >
                    {t('next')}
                </Button>
            </div>

            {error && (
                <div className="pb-1">
                    <ErrorAlert description={error} className="gap-2 text-xs" iconSize={14} />
                </div>
            )}

            <div className="flex items-center gap-4 py-2">
                <div className="h-px flex-1 bg-grey-1" />
                <span className="text-sm text-grey-1">{t('waitlist.or')}</span>
                <div className="h-px flex-1 bg-grey-1" />
            </div>

            <Button
                onClick={() => {
                    handleNext()
                }}
                shadowSize="4"
            >
                {t('waitlist.joinWaitlist')}
            </Button>
        </div>
    )
}

export default JoinWaitlist
