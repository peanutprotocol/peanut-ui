import { Button } from '@/components/0_Bruddle/Button'
import { FieldError } from '@/components/0_Bruddle/FieldError'
import ValidatedInput from '@/components/Global/ValidatedInput'
import DocsLink from '@/components/Global/DocsLink'
import { USERNAME_MIN_LENGTH } from '@/constants/general.consts'
import { isCapacitor } from '@/utils/capacitor'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { invitesApi } from '@/services/invites'
import { toInviteCode } from '@/utils/invite-code.utils'
import { apiFetch } from '@/utils/api-fetch'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

const SignupStep = () => {
    const t = useTranslations('setup')
    const { username, setUsername, inviterUsername, setInviterUsername, applyManualInvite, clearManualInvite } =
        useSetupFlowContext()
    const [error, setError] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [showInviterInput, setShowInviterInput] = useState(Boolean(inviterUsername))
    const [inviterValid, setInviterValid] = useState(false)
    const [inviterChanging, setInviterChanging] = useState(false)
    const [inviterError, setInviterError] = useState('')
    const inviterValueRef = useRef(inviterUsername)
    const inviterInputId = useId()
    const prefersReducedMotion = useReducedMotion()

    const validateInviter = async (value: string): Promise<boolean> => {
        setInviterError('')
        const result = await invitesApi.validateInviteCode(value)
        const valid = result.success && result.attributionResolved
        if (inviterValueRef.current !== value) return valid
        posthog.capture(ANALYTICS_EVENTS.INVITE_CODE_VALIDATED, { valid, source: 'signup_optional_inviter' })
        if (!valid) setInviterError(t('signupStep.inviterNotFound'))
        return valid
    }

    const toggleInviterInput = () => {
        if (showInviterInput) {
            inviterValueRef.current = ''
            clearManualInvite()
            setInviterUsername('')
            setInviterValid(false)
            setInviterChanging(false)
            setInviterError('')
        } else {
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITER_PROMPT_OPENED)
        }
        setShowInviterInput(!showInviterInput)
    }

    const onNext = () =>
        handleNext(async () => {
            if (!isValid) return false
            const code = toInviteCode(inviterUsername)
            if (showInviterInput && code) {
                if (!inviterValid || inviterChanging) return false
                applyManualInvite(code)
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
            }
            return true
        })

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
        setUsername(value.toLowerCase())
        setIsValid(isValid)
        setIsChanging(isChanging)

        // Clear error when input is being changed
        if (isChanging) {
            setError('')
        }
    }

    return (
        <>
            <div className="flex h-full flex-col justify-between gap-10 md:pt-6">
                <div className="mb-auto flex w-full flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <ValidatedInput
                            placeholder={t('signupStep.usernamePlaceholder')}
                            value={username}
                            debounceTime={750}
                            validate={checkUsernameValidity}
                            shouldValidate={(v) => v.length >= USERNAME_MIN_LENGTH}
                            onUpdate={handleInputUpdate}
                            isSetupFlow
                            isInputChanging={isChanging}
                            className="rounded-sm"
                        />
                        <div className="min-h-8">{error && <FieldError>{error}</FieldError>}</div>
                    </div>

                    <button
                        type="button"
                        onClick={toggleInviterInput}
                        aria-expanded={showInviterInput}
                        aria-controls={inviterInputId}
                        className="self-start text-body-s text-foreground-primary underline underline-offset-2 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                    >
                        {t('signupStep.whoInvitedYou')}
                    </button>

                    <AnimatePresence initial={false}>
                        {showInviterInput && (
                            <motion.div
                                id={inviterInputId}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                                transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                                className="flex w-full flex-col gap-1"
                            >
                                <ValidatedInput
                                    aria-label={t('signupStep.inviterUsernameLabel')}
                                    placeholder={t('signupStep.inviterUsernamePlaceholder')}
                                    value={inviterUsername}
                                    debounceTime={750}
                                    validate={validateInviter}
                                    shouldValidate={(value) => toInviteCode(value).length >= USERNAME_MIN_LENGTH}
                                    onUpdate={({ value, isValid, isChanging }) => {
                                        inviterValueRef.current = value
                                        setInviterUsername(value)
                                        setInviterValid(isValid)
                                        setInviterChanging(isChanging)
                                        if (isChanging) {
                                            clearManualInvite()
                                            setInviterError('')
                                        }
                                    }}
                                    isSetupFlow
                                    isInputChanging={inviterChanging}
                                />
                                {inviterError ? (
                                    <FieldError>{inviterError}</FieldError>
                                ) : (
                                    <p className="text-body-xs text-foreground-secondary">
                                        {t('signupStep.inviterHelp')}
                                    </p>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Button
                        size="large"
                        className="w-full"
                        loading={isLoading}
                        shadowSize="4"
                        onClick={onNext}
                        disabled={
                            !isValid ||
                            isChanging ||
                            isLoading ||
                            (showInviterInput && !!toInviteCode(inviterUsername) && (!inviterValid || inviterChanging))
                        }
                    >
                        {t('next')}
                    </Button>
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
