import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import SetupFooter from '../components/SetupFooter'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import { PasskeySetupHelpDrawer } from './PasskeySetupHelpDrawer'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useQueryClient } from '@tanstack/react-query'
import { USER } from '@/constants/query.consts'
import { DEMO_USER } from '@/constants/demo-data'
import { enableDemoMode, isDemoUsername } from '@/utils/demo'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupPasskey } from '@/features/setup/useSignupPasskey'
import { apiFetch } from '@/utils/api-fetch'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'

// Valid username-shaped ideas, so the joke can double as inspiration.
const USERNAME_IDEAS = [
    'batman?',
    'moonpickle?',
    'tinywizard?',
    'pizzaninja?',
    'sleepytoast?',
    'cosmicbean?',
    'sneakywalnut?',
    'jellycaptain?',
    'waffleking?',
    'peanutpirate?',
] as const

/** Claim username: validates the handle, then "Claim" creates the passkey and the account. */
const SignupStep = () => {
    const t = useTranslations('setup')
    const {
        username,
        setUsername,
        setResidenceCountry,
        setSecondResidenceCountry,
        setSignupCompleted,
        setNoBackLockScreenId,
    } = useSetupFlowContext()
    const queryClient = useQueryClient()
    const [error, setError] = useState('')
    const { isLoading, setScreenId } = useSetupFlow()
    const passkey = useSignupPasskey(username)
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const prefersReducedMotion = useReducedMotion()
    const [suggestionIndex, setSuggestionIndex] = useState(-1)
    const [placeholderStopped, setPlaceholderStopped] = useState(false)

    useEffect(() => {
        if (username || placeholderStopped || prefersReducedMotion) return
        let interval: ReturnType<typeof setInterval> | undefined
        let next = 0
        const start = setTimeout(() => {
            setSuggestionIndex(0)
            interval = setInterval(() => {
                next += 1
                setSuggestionIndex(next < USERNAME_IDEAS.length ? next : -1)
                if (next >= USERNAME_IDEAS.length) clearInterval(interval)
            }, 2000)
        }, 4000)
        return () => {
            clearTimeout(start)
            clearInterval(interval)
        }
    }, [username, placeholderStopped, prefersReducedMotion])

    const busy = passkey.isClaiming || isLoading

    const onClaim = async () => {
        if (!isValid || isChanging || busy) return
        if (isDemoUsername(username)) {
            enableDemoMode()
            // Retire any pre-demo user request before seeding the synthetic session.
            await queryClient.cancelQueries({ queryKey: [USER] })
            queryClient.setQueryData([USER], DEMO_USER)
            setResidenceCountry('BR')
            setSecondResidenceCountry('')
            setNoBackLockScreenId('advantage-control')
            setSignupCompleted(true)
            setScreenId('advantage-control')
            return
        }
        await passkey.claim()
    }

    const checkUsernameValidity = async (username: string): Promise<boolean> => {
        // clear error when starting a new validation
        setError('')

        // Reserved local demo entry: typing validates it, but only submission activates the session.
        if (isDemoUsername(username)) return true

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
        setPlaceholderStopped(true)
        setSuggestionIndex(-1)
        setUsername(value.toLowerCase())
        setIsValid(isValid)
        setIsChanging(isChanging)

        // Clear error when input is being changed
        if (isChanging) {
            setError('')
        }
    }

    const passkeyMessage = passkey.inlineError ?? passkey.preflightWarning

    return (
        <>
            <div className="flex h-full flex-1 flex-col justify-between gap-6">
                <div className="flex w-full flex-1 flex-col justify-center gap-4">
                    <div className="flex flex-col gap-1">
                        <div
                            className="relative"
                            onFocusCapture={() => {
                                setPlaceholderStopped(true)
                                setSuggestionIndex(-1)
                            }}
                        >
                            <ValidatedInput
                                aria-label={t('signupStep.usernamePlaceholder')}
                                placeholder={suggestionIndex < 0 ? t('signupStep.usernamePlaceholder') : ''}
                                value={username}
                                debounceTime={750}
                                validate={checkUsernameValidity}
                                shouldValidate={(v) => v.length >= USERNAME_MIN_LENGTH}
                                onUpdate={handleInputUpdate}
                                isSetupFlow
                                isInputChanging={isChanging}
                                prefix="@"
                                className="rounded-sm"
                            />
                            <AnimatePresence>
                                {suggestionIndex >= 0 && !username && !placeholderStopped && (
                                    <motion.span
                                        key={suggestionIndex}
                                        aria-hidden="true"
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -5 }}
                                        transition={{ duration: 0.18 }}
                                        className="pointer-events-none absolute inset-y-0 left-8 flex items-center text-body-s text-foreground-secondary"
                                    >
                                        {USERNAME_IDEAS[suggestionIndex]}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </div>
                        <div className="min-h-8">{error && <FieldError>{error}</FieldError>}</div>
                    </div>
                    {passkey.usernameTaken && (
                        <div className="flex flex-col gap-3">
                            <Callout priority="error">{t('passkey.usernameTaken')}</Callout>
                            <Button
                                loading={passkey.isLoggingIn}
                                disabled={passkey.isLoggingIn}
                                variant="secondary"
                                onClick={passkey.logIn}
                                shadowSize="4"
                            >
                                {t('logIn')}
                            </Button>
                        </div>
                    )}
                    {passkeyMessage && <Callout priority="error">{passkeyMessage}</Callout>}
                </div>
                <SetupFooter
                    actions={
                        <Button
                            size="medium"
                            className="w-full"
                            loading={busy}
                            shadowSize="4"
                            onClick={onClaim}
                            disabled={!isValid || isChanging || busy}
                        >
                            {t('cta.claimName')}
                        </Button>
                    }
                    secondary={
                        <p className="w-full border-t border-border-subtle pt-4 text-center text-body-xs text-foreground-secondary short:pt-2">
                            {t.rich('signupStep.termsAgreement', {
                                terms: (chunks) => (
                                    <SetupDocLink kind="terms" href="/terms" className="underline underline-offset-2">
                                        {chunks}
                                    </SetupDocLink>
                                ),
                                privacy: (chunks) => (
                                    <SetupDocLink
                                        kind="privacy"
                                        href="/privacy"
                                        className="underline underline-offset-2"
                                    >
                                        {chunks}
                                    </SetupDocLink>
                                ),
                            })}
                        </p>
                    }
                />
            </div>
            {passkey.helpErrorName && (
                <PasskeySetupHelpDrawer
                    visible={passkey.isHelpOpen}
                    onClose={passkey.closeHelp}
                    onRetry={passkey.retryFromHelp}
                    errorName={passkey.helpErrorName}
                    platform={passkey.deviceType}
                />
            )}
        </>
    )
}

export default SignupStep
