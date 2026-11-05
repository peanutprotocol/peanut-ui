import { SetupDocLink } from '@/components/Setup/components/SetupDocsDrawer'
import { LinkButton, LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import PasskeyInfoDrawer from '@/components/Setup/components/PasskeyInfoDrawer'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import SetupFooter from '../components/SetupFooter'
import SetupTitleBlock from '../components/SetupTitleBlock'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { type ReactNode, useState, useEffect, useRef } from 'react'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { setupCountrySignalProperties } from '@/features/setup/country-signals'
import { attachSignupGeo } from '@/services/signup-geo'
import { saveSignupResidence } from '@/features/setup/saveSignupAnswers'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { readInviteCode } from '@/utils/invite-stash'
import {
    clearSignupAttribution,
    hasPendingSignupAttribution,
    readSignupAttributionAsync,
} from '@/utils/signup-attribution'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'
import type en from '@/i18n/app/messages/en.json'
import { signupAnalyticsContext } from '@/features/setup/signup-analytics'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { confettiPresets } from '@/utils/confetti'
import { getPasskeySetupKey } from '@/utils/webauthn.utils'
import { latestCeremony } from '@/utils/webauthn-ceremony-telemetry'
import { useSignupTestTransaction } from '@/features/setup/useSignupTestTransaction'
import { classifySignupTestTxFailure, type SignupTestTxFailure } from '@/features/setup/signup-test-tx-failure'
import {
    canDeferSignupTestTransaction,
    clearSignupTestTransaction,
    readSignupTestTransaction,
    updateSignupTestTransaction,
} from '@/features/setup/signup-test-transaction'
import { clearSignupProgress } from '@/features/setup/signup-progress'

/** A `setup` catalog key: the finish screen's own errors or the shared passkey copy. */
type FinishErrorKey =
    | `testTransaction.errors.${keyof typeof en.setup.testTransaction.errors}`
    | ReturnType<typeof getPasskeySetupKey>

function failureErrorKey({ mode, errorCode }: SignupTestTxFailure): FinishErrorKey {
    switch (mode) {
        case 'signature_invalid':
            return 'testTransaction.errors.passkeyProviderUnsupported'
        case 'bundler_transient':
            return 'testTransaction.errors.networkBusy'
        case 'needs_new_signature':
            return 'testTransaction.errors.confirmAgain'
        case 'passkey':
            return !errorCode || errorCode === 'LOGIN_ERROR' ? 'passkey.interrupted' : getPasskeySetupKey(errorCode)
        case 'unknown':
            return 'testTransaction.errors.supportNeeded'
        default: {
            const unhandled: never = mode
            return unhandled
        }
    }
}

export function SetupConfirmationView({
    onConfirm,
    isLoading = false,
    error,
    buttonText,
    showTitle = true,
    merged = false,
    secondary,
}: {
    onConfirm: () => void
    isLoading?: boolean
    error?: string | null
    buttonText?: string
    showTitle?: boolean
    merged?: boolean
    /** the tertiary link under the primary (finish without the confirmation, log out on the finish route) */
    secondary?: ReactNode
}) {
    const t = useTranslations('setup')
    const [isPasskeyInfoOpen, setIsPasskeyInfoOpen] = useState(false)
    const { track } = useSignupControl()
    const button = (
        <Button
            onClick={() => {
                track('finish', 'tap')
                onConfirm()
            }}
            loading={isLoading}
            disabled={isLoading}
            className="w-full"
        >
            {buttonText || t(merged ? 'cta.finish' : 'testTransaction.confirmAndFinish')}
        </Button>
    )
    // In the sign-up flow this is the "Only for you" step: the shared title block
    // at the top, the passkey confirmation on the pinned primary.
    if (merged) {
        return (
            <div className="flex flex-1 flex-col gap-6">
                <SetupTitleBlock
                    title={showTitle ? t('steps.advantage-control.title') : undefined}
                    description={t('steps.advantage-control.description')}
                />
                {error && <Callout priority="error">{error}</Callout>}
                <SetupFooter actions={button} secondary={secondary} />
            </div>
        )
    }
    return (
        <PageStack className="flex-1">
            <PageStack.Center>
                {showTitle && <h1 className="text-heading-s">{t('testTransaction.confirmTitle')}</h1>}
                {error && <Callout priority="error">{error}</Callout>}
            </PageStack.Center>
            <SetupFooter actions={button} secondary={secondary}>
                <p className="text-center text-body-xs text-foreground-secondary">
                    <LinkButton
                        onClick={() => {
                            track('passkey_info', 'open')
                            setIsPasskeyInfoOpen(true)
                        }}
                    >
                        <Icon name="info" size={16} className="shrink-0" />
                        {t('passkey.learnMore')}
                    </LinkButton>
                </p>
            </SetupFooter>
            <PasskeyInfoDrawer visible={isPasskeyInfoOpen} onClose={() => setIsPasskeyInfoOpen(false)} />
        </PageStack>
    )
}

const SignTestTransaction = ({
    onComplete,
    merged = false,
    showLogout = false,
}: {
    onComplete?: () => void
    merged?: boolean
    /** /setup/finish: a signed-in user whose passkey fails must still be able to leave */
    showLogout?: boolean
}) => {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const tProfile = useTranslations('profile')
    const { address } = useZeroDev()
    const { sendTestTransaction } = useSignupTestTransaction()
    const { finalizeAccountSetup, isProcessing, error: setupError, handleRedirect } = useAccountSetup()
    const { user, isFetchingUser, fetchUser, logoutUser, isLoggingOut } = useAuth()
    const { track } = useSignupControl()
    const {
        residenceCountry,
        nationalityCountry,
        setIsLoading: setSetupLoading,
        signupEntryFlow,
        fundingChannel,
        paymentChannel,
    } = useSetupFlowContext()
    // the key, not the text: translated at render, so the message follows a
    // language change made after it appeared (Release 164 smoke test)
    const [errorKey, setErrorKey] = useState<FinishErrorKey | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [testTransactionCompleted, setTestTransactionCompleted] = useState(false)
    const [canDefer, setCanDefer] = useState(false)
    const deferredRef = useRef(false)
    const creatingAccountRef = useRef(false)
    /*
     * handleRedirect CONSUMES the stored post-auth route, so it must fire once.
     * A second caller would find nothing stored, fall back to /home and race
     * the first redirect — a signup entered from /receipt would land on /home.
     */
    const redirectingRef = useRef(false)
    const completionCelebratedRef = useRef(false)

    const redirectToAccount = () => {
        if (redirectingRef.current) return
        redirectingRef.current = true
        // This terminal path only runs for an account created in this session,
        // so it inherits no earlier session's page — only a deep link the
        // person themselves asked for.
        handleRedirect({ isNewAccount: true })
    }

    const completeSignup = async () => {
        console.log('[SignTestTransaction] Account setup complete')
        if (user?.user?.userId) await attachSignupGeo(user.user.userId)
        // The final passkey confirmation has succeeded and the account exists.
        // The finish route redirects immediately; setup celebrates on its
        // dedicated final screen after the completion callback.
        if (!onComplete && !completionCelebratedRef.current) {
            completionCelebratedRef.current = true
            confettiPresets.celebration()
        }
        const inviteCode = readInviteCode()
        // Native Preferences can be the only surviving copy after a WebView
        // process restart, so load the durable context before emitting the
        // terminal event or deleting it.
        const signupAttribution = await readSignupAttributionAsync()
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
            ...setupCountrySignalProperties(),
            acquisition_source: inviteCode ? 'referred' : 'organic',
            invite_code: inviteCode || undefined,
            ...signupAnalyticsContext(signupEntryFlow),
            test_tx: deferredRef.current ? 'deferred' : 'confirmed',
            funding_methods: fundingChannel
                ? [fundingChannel === 'crypto' || fundingChannel === 'peanut' ? fundingChannel : 'bank']
                : [],
            ...(signupAttribution
                ? {
                      signup_journey_id: signupAttribution.journeyId,
                      signup_platform: signupAttribution.platform,
                      signup_attribution_capture_method: signupAttribution.captureMethod,
                  }
                : {}),
        })
        if (user) {
            clearSignupProgress(user.user.userId)
            // A deferred confirmation stays on the device for the retry after sign-in.
            if (!deferredRef.current) clearSignupTestTransaction(user.user.userId)
        }
        // The attachment clears its retry marker only after acknowledgement.
        // Keep failed deliveries user-bound and durable through completion so
        // the authenticated recovery path can retry after an app restart.
        if (user && !(await hasPendingSignupAttribution(user.user.userId))) {
            await clearSignupAttribution()
        }
        // Keep the independently observed hints on the identified analytics
        // profile, and retain them separately in the API geo observation model.
        try {
            posthog.setPersonProperties(setupCountrySignalProperties())
        } catch {
            // Country-signal analytics must never hold account completion.
        }

        // Persist the residence answer from the residence step, now that
        // the account exists. Fire-and-forget: prequalification data,
        // never a reason to fail or delay the redirect.
        if (residenceCountry) {
            // The nationality stays off analytics: only the API keeps it, for the ID check.
            posthog.setPersonProperties({ residence_country: residenceCountry })
            const userId = user?.user?.userId
            // Readers drop the device mirror once /users/me carries a residence, so fetch it once saved.
            if (userId)
                saveSignupResidence(userId, residenceCountry, nationalityCountry || residenceCountry, () => {
                    void fetchUser().catch(() => undefined)
                })
        }

        // Completion is terminal for this screen. Keep both loading states
        // active until navigation unmounts it so a slow route transition
        // cannot expose a second completion attempt.
        if (onComplete) {
            // Keep the account-exists effect from consuming the saved destination
            // before the user leaves the dedicated celebration screen.
            redirectingRef.current = true
            onComplete()
        } else redirectToAccount()
    }

    // ensure user is fetched when component mounts (important for new signups)
    useEffect(() => {
        console.log('[SignTestTransaction] Component mounted, user state:', {
            hasUser: !!user,
            isFetchingUser,
            userId: user?.user?.userId,
        })

        if (!user && !isFetchingUser) {
            console.log('[SignTestTransaction] User not loaded, fetching user data')
            fetchUser().catch((err) => {
                console.error('[SignTestTransaction] Failed to fetch user:', err)
                Sentry.captureException(err, {
                    tags: { feature: 'signup-test-transaction' },
                    extra: { context: 'user-fetch-on-mount' },
                })
                setErrorKey('testTransaction.errors.loadUserFailed')
            })
        } else if (user) {
            console.log('[SignTestTransaction] User loaded successfully:', {
                userId: user.user.userId,
                username: user.user.username,
                accountCount: user.accounts.length,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isFetchingUser])

    // check if account already exists (for login flow)
    const accountExists = user?.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)

    useEffect(() => {
        // Login flow only: an account that existed before this screen redirects
        // straight in. Signup completion owns its own redirect, guarded so the
        // account refetch cannot consume the stored destination a second time.
        // A wallet can already be saved by an earlier ambiguous signup request.
        // That is not proof of confirmation during this visit to the final step.
        if (onComplete || creatingAccountRef.current || redirectingRef.current) return
        if (accountExists) {
            console.log('[SignTestTransaction] Account exists, redirecting to the app')
            redirectingRef.current = true
            handleRedirect()
        }
    }, [accountExists, handleRedirect, onComplete])

    const handleTestTransaction = async ({ defer = false }: { defer?: boolean } = {}) => {
        if (redirectingRef.current) return
        const attemptStartedAt = Date.now()

        if (!address) {
            setErrorKey('testTransaction.errors.noWalletAddress')
            return
        }

        if (!user) {
            console.error('[SignTestTransaction] Cannot proceed without user data')
            setErrorKey('testTransaction.errors.userNotLoaded')
            return
        }
        const userId = user.user.userId

        setIsSigning(true)
        setErrorKey(null)
        setCanDefer(false)
        setSetupLoading(true)
        if (!defer) posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_STARTED)

        try {
            if (defer) {
                const record = readSignupTestTransaction(userId)
                // Re-checked at the tap: a stale button must not skip a signature the validator rejected.
                if (!canDeferSignupTestTransaction(record)) {
                    setIsSigning(false)
                    setSetupLoading(false)
                    return
                }
                updateSignupTestTransaction(userId, { deferred: true })
                deferredRef.current = true
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_DEFERRED, {
                    transient_failures: record?.transientFailures,
                    signature_check: record?.signatureCheck,
                })
                setTestTransactionCompleted(true)
            } else if (!testTransactionCompleted) {
                const result = await sendTestTransaction()
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_SIGNED, {
                    reused_signature: result.reusedSignature,
                    sends: result.sends,
                    recovered: result.recovered,
                })
                setTestTransactionCompleted(true)
            }

            // A retry must also confirm the current choices: a prior request may
            // have committed before the user returned and changed their plan.
            if (onComplete || !accountExists || (creatingAccountRef.current && fundingChannel && paymentChannel)) {
                creatingAccountRef.current = true
                const success = await finalizeAccountSetup(
                    address,
                    fundingChannel && paymentChannel ? { fundingChannel, paymentChannel } : undefined
                )
                if (!success) {
                    // The request layer already recorded the concrete failure;
                    // avoid another console-captured wrapper event here.
                    console.info('[SignTestTransaction] Account setup remains retryable')
                    setErrorKey('testTransaction.errors.setupFailed')
                    setIsSigning(false)
                    setSetupLoading(false)
                    return
                }

                // addAccount() already fetched and verified user data.
                await completeSignup()
            } else if (creatingAccountRef.current) {
                // A prior ambiguous request can commit after both immediate
                // profile reconciliations fail. Retry consumes that signup
                // marker and presents the same success state as the direct
                // response instead of leaving the button loading forever.
                await completeSignup()
            }
            // Otherwise the login flow's account-exists effect owns navigation; loading stays on until it redirects.
        } catch (e) {
            /*
             * console.info, not error: captureConsoleIntegration turned an error log into an
             * "unhandled" event without this step's tags, and Sentry's dedupe then dropped
             * the tagged capture below as its duplicate.
             */
            console.info('[SignTestTransaction] Test transaction failed:', e)

            // Browser capability probes must not delay recovery from a failed signature.
            void capturePasskeyDebugInfo('test-transaction-failed').catch((debugError) => {
                console.warn('[SignTestTransaction] Diagnostics failed:', debugError)
            })

            // classify first: it renames the capgo shim's plain `Error('User cancelled the selector')`
            // to NotAllowedError in place, so read error_name after it
            const failure = classifySignupTestTxFailure(e)
            const record = readSignupTestTransaction(userId)
            // A failed passkey prompt was already reported, rate-limited, by the signing hook.
            if (!(failure.mode === 'passkey' && failure.phase === 'sign')) {
                Sentry.captureException(e, {
                    tags: { feature: 'signup-test-transaction', failure_mode: failure.mode },
                    extra: {
                        address,
                        accountExists,
                        testTransactionCompleted,
                        phase: failure.phase,
                        submissionKind: failure.submissionKind,
                        errorMessage: failure.rootCause.message,
                        errorName: failure.rootCause.name,
                    },
                })
            }
            const assertion = latestCeremony('get', 'user_op', attemptStartedAt)
            const deferrable = failure.mode === 'bundler_transient' && canDeferSignupTestTransaction(record)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_FAILED, {
                error_name: failure.rootCause.name,
                error_code: failure.errorCode,
                is_aa24: failure.mode === 'signature_invalid',
                failure_mode: failure.mode,
                phase: failure.phase,
                submission_kind: failure.submissionKind,
                transient_failures: record?.transientFailures,
                signature_check: record?.signatureCheck,
                deferral_offered: deferrable,
                backup_eligible: assertion?.backupEligible,
                challenge_offset: assertion?.challengeOffset,
            })
            setErrorKey(failureErrorKey(failure))
            setCanDefer(deferrable)
            setIsSigning(false)
            setSetupLoading(false)
        }
    }

    const isLoading = isSigning || isProcessing || isFetchingUser || !user
    const displayError = (errorKey && t(errorKey)) || setupError

    // determine button text based on state
    const getButtonText = () => {
        if (isFetchingUser || !user) return tCommon('loading')
        if (testTransactionCompleted && displayError) return t('testTransaction.retryAccountSetup')
        return undefined
    }

    return (
        <SetupConfirmationView
            onConfirm={() => void handleTestTransaction()}
            isLoading={isLoading}
            error={displayError}
            buttonText={getButtonText()}
            merged={merged}
            showTitle={!!onComplete}
            secondary={
                (canDefer || showLogout) && (
                    <>
                        {canDefer && (
                            <LinkButton
                                onClick={() => {
                                    track('finish_later', 'tap')
                                    void handleTestTransaction({ defer: true })
                                }}
                                disabled={isLoading}
                            >
                                {t('testTransaction.finishLater')}
                            </LinkButton>
                        )}
                        {showLogout && (
                            <LinkButton
                                onClick={() => {
                                    track('log_out', 'tap')
                                    void logoutUser()
                                }}
                                disabled={isLoggingOut}
                            >
                                {tProfile('logOut')}
                            </LinkButton>
                        )}
                    </>
                )
            }
        />
    )
}

export const PasskeyDocsLink = ({ className }: { className?: string }) => {
    const t = useTranslations('setup')
    return (
        <p
            // ds text tokens stay outside twMerge — unconfigured twMerge groups
            // them as colors and deletes the size (see LinkButton.tsx:40)
            className={`text-body-xs text-foreground-secondary ${twMerge('border-t border-border-subtle pt-2 text-center', className)}`}
        >
            <SetupDocLink kind="passkeys" href="/en/help/passkeys" className={LINK_BUTTON_CLASSES}>
                <Icon name="info" size={16} className="shrink-0" />
                {t('passkey.learnMore')}
            </SetupDocLink>{' '}
        </p>
    )
}

export default SignTestTransaction
