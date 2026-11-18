'use client'

import { useEffect, useRef, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useAuth } from '@/context/authContext'
import { setupCountrySignalProperties } from '@/features/setup/country-signals'
import { saveSignupResidence } from '@/features/setup/saveSignupAnswers'
import { signupAnalyticsContext } from '@/features/setup/signup-analytics'
import { clearSignupProgress } from '@/features/setup/signup-progress'
import {
    canDeferSignupTestTransaction,
    clearSignupTestTransaction,
    readSignupTestTransaction,
    updateSignupTestTransaction,
} from '@/features/setup/signup-test-transaction'
import { SignupTestTxError } from '@/features/setup/signup-test-tx-error'
import { classifySignupTestTxFailure } from '@/features/setup/signup-test-tx-failure'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useSignupTestTransaction } from '@/features/setup/useSignupTestTransaction'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useZeroDev } from '@/hooks/useZeroDev'
import { AccountType } from '@/interfaces/interfaces'
import { attachSignupGeo } from '@/services/signup-geo'
import { confettiPresets } from '@/utils/confetti'
import { readInviteCode } from '@/utils/invite-stash'
import { passkeyFailureFields } from '@/utils/passkey-failure-fields'
import { passkeyFailureReason } from '@/utils/passkey-failure-reporting'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import {
    clearSignupAttribution,
    hasPendingSignupAttribution,
    readSignupAttributionAsync,
} from '@/utils/signup-attribution'
import { latestCeremony } from '@/utils/webauthn-ceremony-telemetry'
import { type FinishErrorKey, failureErrorKey } from './finishErrorKey'

/**
 * The final confirmation's state machine, moved unchanged from dev's `Views/SignTestTransaction.tsx`: sign the
 * test transaction with the passkey, finalize the account with the chosen channels, then complete sign-up.
 * With `onComplete` (the sign-up step) completion hands over to the celebration; without it (`/setup/finish`)
 * it fires confetti and redirects, and an account that already has a wallet redirects straight in.
 */
export function useFinalConfirm({ onComplete }: { onComplete?: () => void }) {
    const { address } = useZeroDev()
    const { sendTestTransaction } = useSignupTestTransaction()
    const { finalizeAccountSetup, isProcessing, error: setupError, handleRedirect } = useAccountSetup()
    const { user, isFetchingUser, fetchUser, logoutUser, isLoggingOut } = useAuth()
    const { trackError } = useSignupControl()
    const {
        residenceCountry,
        nationalityCountry,
        setIsLoading: setSetupLoading,
        signupEntryFlow,
        fundingChannel,
        paymentChannel,
    } = useSetupFlowContext()
    // the key, not the text: translated at render, so the message follows a language change made after it appeared
    const [errorKey, setErrorKey] = useState<FinishErrorKey | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [testTransactionCompleted, setTestTransactionCompleted] = useState(false)
    const [canDefer, setCanDefer] = useState(false)
    useEffect(() => {
        trackError('finish', errorKey ?? (setupError ? 'setup_failed' : null))
    }, [errorKey, setupError, trackError])
    const attemptInFlightRef = useRef(false)
    const deferredRef = useRef(false)
    const creatingAccountRef = useRef(false)
    // handleRedirect CONSUMES the stored post-auth route, so it must fire once. A second caller would find nothing
    // stored, fall back to /home and race the first redirect: a sign-up entered from /receipt would land on /home.
    const redirectingRef = useRef(false)
    const completionCelebratedRef = useRef(false)

    const redirectToAccount = () => {
        if (redirectingRef.current) return
        redirectingRef.current = true
        // Only an account created in this session gets here, so it inherits no earlier session's page.
        handleRedirect({ isNewAccount: true })
    }

    const completeSignup = async () => {
        if (user?.user?.userId) await attachSignupGeo(user.user.userId)
        // The finish route redirects at once; the sign-up step celebrates on its own screen after onComplete.
        if (!onComplete && !completionCelebratedRef.current) {
            completionCelebratedRef.current = true
            confettiPresets.celebration()
        }
        const inviteCode = readInviteCode()
        // Native Preferences can be the only surviving copy after a WebView process restart, so load the durable
        // context before emitting the terminal event or deleting it.
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
        // The attachment clears its retry marker only after acknowledgement. Keep failed deliveries user-bound and
        // durable through completion so the authenticated recovery path can retry after an app restart.
        if (user && !(await hasPendingSignupAttribution(user.user.userId))) {
            await clearSignupAttribution()
        }
        try {
            posthog.setPersonProperties(setupCountrySignalProperties())
        } catch {
            // Country-signal analytics must never hold account completion.
        }
        // Persist the residence answer now that the account exists. Fire-and-forget: prequalification data,
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
        // Completion is terminal for this screen: both loading states stay on until navigation unmounts it.
        if (onComplete) {
            // Keep the account-exists effect from consuming the saved destination before the celebration.
            redirectingRef.current = true
            onComplete()
        } else redirectToAccount()
    }

    // fetch the user on mount when it is missing (new sign-ups)
    useEffect(() => {
        if (!user && !isFetchingUser) {
            fetchUser().catch((err) => {
                Sentry.captureException(err, {
                    tags: { feature: 'signup-test-transaction' },
                    extra: { context: 'user-fetch-on-mount' },
                })
                setErrorKey('testTransaction.errors.loadUserFailed')
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isFetchingUser])

    const accountExists = user?.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)

    useEffect(() => {
        // Login flow only: an account that existed before this screen redirects straight in. A wallet can already be
        // saved by an earlier ambiguous sign-up request; that is not proof of confirmation during this visit.
        if (onComplete || creatingAccountRef.current || redirectingRef.current) return
        if (accountExists) {
            redirectingRef.current = true
            handleRedirect()
        }
    }, [accountExists, handleRedirect, onComplete])

    const confirm = async ({ defer = false }: { defer?: boolean } = {}) => {
        if (redirectingRef.current || attemptInFlightRef.current) return
        const attemptStartedAt = Date.now()

        if (!address) {
            setErrorKey('testTransaction.errors.noWalletAddress')
            return
        }
        if (!user) {
            setErrorKey('testTransaction.errors.userNotLoaded')
            return
        }
        const userId = user.user.userId

        attemptInFlightRef.current = true
        const allowRetry = () => {
            attemptInFlightRef.current = false
            setIsSigning(false)
            setSetupLoading(false)
        }
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
                    allowRetry()
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

            // A retry must also confirm the current choices: a prior request may have committed before the user
            // returned and changed their plan.
            if (onComplete || !accountExists || (creatingAccountRef.current && fundingChannel && paymentChannel)) {
                creatingAccountRef.current = true
                const success = await finalizeAccountSetup(
                    address,
                    fundingChannel && paymentChannel ? { fundingChannel, paymentChannel } : undefined
                )
                if (!success) {
                    // The request layer already recorded the concrete failure.
                    setErrorKey('testTransaction.errors.setupFailed')
                    allowRetry()
                    return
                }
                // addAccount() already fetched and verified user data.
                await completeSignup()
            } else if (creatingAccountRef.current) {
                // A prior ambiguous request can commit after both immediate profile reconciliations fail. Retry
                // consumes that sign-up marker and completes like the direct response.
                await completeSignup()
            }
            // Otherwise the login flow's account-exists effect owns navigation; loading stays on until it redirects.
        } catch (e) {
            // console.info, not error: captureConsoleIntegration would turn an error log into an untagged event that
            // dedupes away the tagged capture below.
            console.info('[FinalConfirm] Test transaction failed:', e)
            // Browser capability probes must not delay recovery from a failed signature.
            void capturePasskeyDebugInfo('test-transaction-failed').catch((debugError) => {
                console.warn('[FinalConfirm] Diagnostics failed:', debugError)
            })
            // Read before classifying, which renames shim errors in place: the signing hook decided on the original.
            const reportedBySigningHook =
                e instanceof SignupTestTxError && e.phase === 'sign' && passkeyFailureReason(e.cause) !== undefined
            const failure = classifySignupTestTxFailure(e)
            const record = readSignupTestTransaction(userId)
            if (!reportedBySigningHook) {
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
                ...passkeyFailureFields(failure.rootCause),
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
            allowRetry()
        }
    }

    const loadingUser = isFetchingUser || !user
    return {
        errorKey,
        setupError,
        canDefer,
        isSigning,
        testTransactionCompleted,
        loadingUser,
        isLoading: isSigning || isProcessing || loadingUser,
        confirm,
        logoutUser,
        isLoggingOut,
    }
}
