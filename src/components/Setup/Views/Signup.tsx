import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import ValidatedInput from '@/components/Global/ValidatedInput'
import DocsLink from '@/components/Global/DocsLink'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { apiFetch } from '@/utils/api-fetch'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useTranslations } from 'next-intl'

const SignupStep = () => {
    const t = useTranslations('setup')
    const dispatch = useAppDispatch()
    const { username } = useSetupStore()
    const [error, setError] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)

    const checkUsernameValidity = async (username: string): Promise<boolean> => {
        // clear error when starting a new validation
        setError('')

        // handle empty input
        if (!username) {
            setError(t('signupStep.errors.required'))
            return false
        }

        // check length requirement
        if (username.length < USERNAME_MIN_LENGTH) {
            setError(t('signupStep.errors.tooShort'))
            return false
        }
        if (username.length > 12) {
            setError(t('signupStep.errors.tooLong'))
            return false
        }

        // check character requirement
        if (!username.match(/^[a-z][a-z0-9]{3,11}$/)) {
            setError(t('signupStep.errors.invalidFormat'))
            return false
        }

        try {
            // public pre-auth availability check — includeAuth: false so it never
            // waits on (or sends) a session token. 404/400 are expected statuses.
            // capacitorHttp doesn't support HEAD — use GET in native
            const res = await apiFetch(`/users/username/${username}`, {
                method: isCapacitor() ? 'GET' : 'HEAD',
                includeAuth: false,
            })
            switch (res.status) {
                case 200:
                    setError(t('signupStep.errors.taken'))
                    posthog.capture(ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED, {
                        is_valid: false,
                        error_type: 'taken',
                        username,
                    })
                    return false
                case 400:
                    setError(t('signupStep.errors.invalid'))
                    posthog.capture(ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED, {
                        is_valid: false,
                        error_type: 'invalid',
                        username,
                    })
                    return false
                case 404:
                    // handle is available
                    setError('')
                    posthog.capture(ANALYTICS_EVENTS.SIGNUP_USERNAME_VALIDATED, { is_valid: true, username })
                    return true
                default:
                    // we dont expect any other status code
                    console.error('Unexpected status code when checking handle availability:', res.status)
                    setError(t('signupStep.errors.checkFailed'))
                    Sentry.captureMessage('Unexpected status code when checking handle availability', {
                        level: 'error',
                        extra: {
                            url: res.url,
                            status: res.status,
                            method: 'HEAD',
                        },
                    })
                    return false
            }
        } catch {
            setError(t('signupStep.errors.checkFailedSupport'))
            return false
        }
    }

    const handleInputUpdate = ({
        value,
        isChanging,
        isValid,
    }: {
        value: string
        isChanging: boolean
        isValid: boolean
    }) => {
        dispatch(setupActions.setUsername(value.toLowerCase()))
        setIsValid(isValid)
        setIsChanging(isChanging)

        // Clear error when input is being changed
        if (isChanging) {
            setError('')
        }
    }

    return (
        <>
            <div className="flex h-full flex-col justify-between gap-11 md:pt-5">
                <div className="space-y-2.5 mb-auto w-full">
                    <div className="flex items-center gap-2">
                        <ValidatedInput
                            placeholder={t('signupStep.usernamePlaceholder')}
                            value={username}
                            debounceTime={750}
                            validate={checkUsernameValidity}
                            shouldValidate={(v) => v.length >= USERNAME_MIN_LENGTH}
                            onUpdate={handleInputUpdate}
                            isSetupFlow
                            isInputChanging={isChanging}
                            className={twMerge(
                                !isValid && !isChanging && !!username && 'border-error dark:border-error',
                                isValid && !isChanging && !!username && 'border-secondary-8 dark:border-secondary-8',
                                'rounded-sm'
                            )}
                        />
                        <Button
                            className="h-12 w-4/12"
                            loading={isLoading}
                            shadowSize="4"
                            onClick={() => handleNext(async () => isValid)}
                            disabled={!isValid || isChanging || isLoading}
                        >
                            {t('next')}
                        </Button>
                    </div>
                    {error && (
                        <div className="pb-1">
                            <ErrorAlert description={error} className="gap-2" iconSize={14} />
                        </div>
                    )}
                </div>
                <div>
                    <p className="border-t border-border-subtle pt-2 text-center text-body-xs text-foreground-secondary">
                        {t.rich('signupStep.termsAgreement', {
                            terms: (chunks) => (
                                <DocsLink href="/terms" className="underline underline-offset-2">
                                    {chunks}
                                </DocsLink>
                            ),
                            privacy: (chunks) => (
                                <DocsLink href="/privacy" className="underline underline-offset-2">
                                    {chunks}
                                </DocsLink>
                            ),
                        })}
                    </p>
                </div>
            </div>
        </>
    )
}

export default SignupStep
