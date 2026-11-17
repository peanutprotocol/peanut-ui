'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useAuth } from '@/context/authContext'
import { bindSignupDraft, saveSignupDraft, markSignupDraftInviteAccepted } from './signup-draft'
import { settlePendingInviteAttribution } from '@/services/pending-invite-attribution'
import { readInviteCode } from '@/utils/invite-stash'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useLogin } from '@/hooks/useLogin'
import { postRegistrationScreen, useSetupFlow } from '@/hooks/useSetupFlow'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { isAndroidNativeBridge, isCapacitor, isIOSNativeBridge, openExternalUrl } from '@/utils/capacitor'
import { keepWebSignupUrl } from '@/features/setup/keep-web-signup-url'
import type { PasskeyProviderUnsupportedError } from '@/utils/passkey-registration-compatibility'
import { apiFetch } from '@/utils/api-fetch'
import { checkPasskeySupport, openPasskeySettings, type PasskeyPreflightResult } from '@/utils/passkeyPreflight'
import { passkeyFailureFields } from '@/utils/passkey-failure-fields'
import { nativeErrorCode, nativePasskeyFailure } from '@/utils/native-passkey-errors'
import { reportPasskeyFailure } from '@/utils/passkey-failure-reporting'
import { isCeremonyGuardError } from '@/utils/passkeyCeremony.utils'
import { latestCeremony } from '@/utils/webauthn-ceremony-telemetry'
import { useSignupControl } from './useSignupControl'
import {
    PASSKEY_NOT_SAVED_HELP,
    WebAuthnErrorName,
    classifyPasskeyError,
    getPasskeyErrorCode,
    getPasskeyErrorSetupKey,
    getPasskeySetupKey,
    withWebAuthnRetry,
} from '@/utils/webauthn.utils'

// A signup that failed client-side AFTER the server verified may have already
// registered this username (user + passkey exist server-side, so login works).
// Fail-open on network errors — the server's 409 is the backstop.
const isUsernameTaken = async (username: string): Promise<boolean | null> => {
    try {
        // capacitorHttp doesn't support HEAD — use GET in native.
        // includeAuth: false — public pre-auth check, no session token involved.
        const res = await apiFetch(`/users/username/${username}`, {
            method: isCapacitor() ? 'GET' : 'HEAD',
            includeAuth: false,
        })
        return res.status === 200 ? true : res.status === 404 ? false : null
    } catch {
        return null
    }
}

/**
 * Which help case opened: Android app setup, iOS not saving, a second Android-app cancel, a sheet that took too
 * long, a person who left the app mid-sheet, a pre-check that found no screen lock or no passkey provider, private
 * mode, or one keyed by the error name.
 */
export type PasskeyHelpReason =
    | 'android-setup'
    | 'ios-not-saved'
    | 'android-cancel'
    | 'took-too-long'
    | 'left-app'
    | 'screen-lock'
    | 'no-provider'
    | 'private-mode'
    | 'error-name'

// The first cancel is usually deliberate; the second on the same step usually means the phone refused to save:
// iOS with iCloud Passwords off, Android with Samsung Pass or another provider in front of Google's.
const CANCELS_BEFORE_HELP = 2
// A sheet that closes this fast was never answered by a person: iOS refused
// (no passcode, iCloud Passwords off, a wedged credential provider). Over 30
// days of ceremonies a 1 s rule caught 1 of the 8 people who never recovered,
// 2 s caught 4 (TASK-24017). `ceremony_ms` on the failure event recalibrates it.
const IOS_FAST_CANCEL_MS = 2000

/** The pre-check result the person can fix in the phone's security settings, as its help reason. */
const settingsHelpReason = (result: PasskeyPreflightResult): PasskeyHelpReason | null => {
    if (result.isSupported || result.fix !== 'security-settings') return null
    if (result.warningKey === 'nativeScreenLock') return 'screen-lock'
    if (result.warningKey === 'nativeNoProvider') return 'no-provider'
    return null
}

const isProbablyPrivateMode = () => {
    try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return false
    } catch {
        return true
    }
}

/** The passkey screen's state and actions, as useSignupPasskey returns them. */
export type SignupPasskey = ReturnType<typeof useSignupPasskey>

/** Registration and device recovery for the passkey screen. */
export function useSignupPasskey(username: string) {
    const t = useTranslations('setup')
    const tPreflight = useTranslations('setupRedesign.passkey.preflight')
    const preflightText = (result: PasskeyPreflightResult) =>
        result.warningKey ? tPreflight(result.warningKey) : result.warning
    // The mount check reads the current language without re-running when it changes.
    const preflightTextRef = useRef(preflightText)
    preflightTextRef.current = preflightText
    const context = useSetupFlowContext()
    const { setNoBackLockScreenId, setRegistrationInProgress, setInviterAccepted, setRefusedUsername, steps } = context
    const { handleNext, setScreenId } = useSetupFlow()
    const { trackError } = useSignupControl()
    const { user, fetchUser } = useAuth()
    const userRef = useRef(user)
    userRef.current = user
    const referred = useRef(false)
    const draftSnapshot = () => ({
        screenId: 'passkey' as const,
        featureScreenIds: context.featureScreenIds ?? undefined,
        answers: {
            username,
            inviteSelection: context.inviteSelection,
            residenceCountry: context.residenceCountry,
            nationalityCountry: context.nationalityCountry,
            fundingChannel: context.fundingChannel,
            paymentChannel: context.paymentChannel,
            notificationChoices: context.notificationChoices,
            inviterAccepted: context.inviterAccepted,
            sellScreensCountry: context.sellScreensCountry,
        },
    })
    const snapshotRef = useRef(draftSnapshot())
    snapshotRef.current = draftSnapshot()
    const { handleRegister, address, isRegistering } = useZeroDev()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const { deviceType } = useDeviceType()
    const [helpErrorName, setHelpErrorName] = useState<string | null>(null)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    // Set when signup refuses the passkey's layout; the platform picks the drawer's guidance.
    const [providerUnsupportedPlatform, setProviderUnsupportedPlatform] = useState<'android-app' | 'other' | null>(null)
    const [preflightWarning, setPreflightWarning] = useState<string | null>(null)
    const [inlineError, setInlineError] = useState<string | null>(null)
    // Why the inline error shows, for a view that words a cancel its own way (the redesign's 03).
    const [inlineErrorCode, setInlineErrorCode] = useState<'cancelled' | null>(null)
    // Which help case opened: the redesign's 03 draws Android setup and iOS not-saved as full screens.
    const [helpReason, setHelpReason] = useState<PasskeyHelpReason | null>(null)
    const [usernameTaken, setUsernameTaken] = useState(false)
    // True only once the user starts a registration on THIS step. The advance
    // below keys off it, so a wallet address that hydrates asynchronously from a
    // stale web-authn-key cookie (native cookie jar) can never pass for a fresh
    // registration and skip ahead.
    const registrationInitiatedRef = useRef(false)
    const completedRef = useRef(false)
    const uncertainRegistration = useRef(false)
    const [isFinishing, setIsFinishing] = useState(false)
    /*
     * Synchronous latch around the WHOLE handler. `isRegistering` only flips once
     * handleRegister runs, and two awaits precede it (the live support re-check
     * and the username lookup), so on a phone the button stayed enabled for a
     * second or more after the first tap. Every extra tap started its own
     * registration, and the losers surfaced CeremonyConflictError while the real
     * ceremony was still coming up (PEANUT-UI-T09). A ref, not state: the help
     * drawer's retry re-enters the handler directly.
     */
    const inFlightRef = useRef(false)
    const iosCancelsRef = useRef(0)
    const androidCancelsRef = useRef(0)
    const attemptsRef = useRef(0)
    // Covers those same awaits in the UI, so the button reads as busy, not dead.
    const [isPreparing, setIsPreparing] = useState(false)

    useEffect(() => {
        let active = true
        void checkPasskeySupport().then((result) => {
            if (active && !result.isSupported && result.warning) {
                setPreflightWarning(preflightTextRef.current(result))
                trackError('create_passkey', 'PASSKEY_UNSUPPORTED')
                const reason = settingsHelpReason(result)
                if (reason) {
                    setHelpReason(reason)
                    setIsHelpOpen(true)
                }
            }
        })
        return () => {
            active = false
        }
    }, [trackError])

    useEffect(() => {
        trackError('username', usernameTaken ? 'taken' : null)
    }, [usernameTaken, trackError])

    const register = async () => {
        trackError('create_passkey', null)
        trackError('username', null)
        setInlineError(null)
        setInlineErrorCode(null)
        setHelpErrorName(null)
        setHelpReason(null)
        setUsernameTaken(false)

        if (!/^[a-z][a-z0-9]{3,11}$/.test(username)) {
            trackError('username', 'invalid')
            setScreenId('signup')
            return
        }

        // Re-check support live: device state can change after mount, and a tap
        // must never silently no-op when passkeys are unavailable.
        const support = await checkPasskeySupport()
        if (!support.isSupported) {
            const message = preflightText(support) ?? t('passkey.notAvailable')
            setPreflightWarning(message)
            setInlineError(message)
            const reason = settingsHelpReason(support)
            if (reason) {
                setHelpReason(reason)
                setIsHelpOpen(true)
            }
            trackError('create_passkey', 'PASSKEY_UNSUPPORTED')
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                ...passkeyFailureFields(undefined),
                device_type: deviceType,
                error_name: 'PreflightUnsupported',
                // Tells a missing screen lock from a missing provider and the other pre-check reasons.
                preflight_warning: support.warningKey ?? undefined,
            })
            return
        }
        setPreflightWarning(null)

        // Catch an already-registered username BEFORE the ceremony: retrying a
        // half-completed signup would otherwise create another credential in the
        // OS keychain and then 409 on the server.
        const taken = await isUsernameTaken(username)
        if (taken === null && uncertainRegistration.current) {
            setInlineError(t('passkey.serverUnreachable'))
            trackError('create_passkey', 'NETWORK')
            return
        }
        if (taken) {
            setUsernameTaken(true)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                device_type: deviceType,
                error_name: 'UsernameTaken',
                error_code: 'USERNAME_TAKEN',
            })
            return
        }

        posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED, { device_type: deviceType })

        attemptsRef.current += 1
        const attemptStartedAt = Date.now()
        registrationInitiatedRef.current = true
        uncertainRegistration.current = true
        setRegistrationInProgress(true)
        referred.current = !!context.inviteSelection || !!readInviteCode()
        saveSignupDraft(snapshotRef.current)
        try {
            await withWebAuthnRetry(() => handleRegister(username), 'passkey-registration')
            // success: the effect below advances once the wallet address appears
        } catch (error) {
            registrationInitiatedRef.current = false
            setRegistrationInProgress(false)
            const err = error as Error
            if (err.name === 'UsernameReserved') {
                trackError('username', 'refused')
                uncertainRegistration.current = false
                setRefusedUsername(username)
                setScreenId('signup')
                return
            }
            const nativeReason = nativePasskeyFailure(err)
            // The OS sheet's own duration, without the network calls around it.
            const ceremony = latestCeremony('create', 'registration', attemptStartedAt)
            // Layout facts only (TASK-24498): never the challenge or the origin.
            const provider =
                err.name === 'PasskeyProviderUnsupportedError' ? (err as PasskeyProviderUnsupportedError) : undefined
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                device_type: deviceType,
                error_name: err.name,
                error_code: err.name === 'UsernameTaken' ? 'USERNAME_TAKEN' : classifyPasskeyError(err).code,
                native_error_code: nativeErrorCode(err),
                native_reason: nativeReason,
                ceremony_ms: ceremony?.durationMs,
                attempt: attemptsRef.current,
                ...(provider && {
                    challenge_offset: provider.challengeOffset,
                    backup_eligible: provider.backupEligible,
                    client_data_keys: provider.clientDataKeys,
                }),
                // Bounded names, the plugin's native exception and the device facts (TASK-25047); they read the
                // plugin's own error layers, so they win over the plain fields above.
                ...passkeyFailureFields(err),
            })
            trackError(
                'create_passkey',
                err.name === 'UsernameTaken' ? 'USERNAME_TAKEN' : classifyPasskeyError(err).code
            )

            if (err.name === 'UsernameTaken') {
                const registered = await isUsernameTaken(username)
                if (registered === true) setUsernameTaken(true)
                else if (registered === false) setScreenId('signup')
                else {
                    setInlineError(t('passkey.serverUnreachable'))
                    trackError('create_passkey', 'NETWORK')
                }
                return
            }
            if (await isUsernameTaken(username)) {
                setUsernameTaken(true)
                return
            }

            // The phone's password manager writes the signed note in a layout the
            // wallet validator cannot read, so this passkey could never sign. The
            // constant message keeps every such phone in one Sentry issue.
            if (provider) {
                Sentry.captureMessage('Passkey provider writes an unsupported clientDataJSON layout', {
                    level: 'warning',
                    tags: {
                        error_type: 'passkey_provider_unsupported',
                        challenge_offset: provider.challengeOffset ?? 'unknown',
                    },
                    extra: { clientDataKeys: provider.clientDataKeys, backupEligible: provider.backupEligible },
                })
                setProviderUnsupportedPlatform(isAndroidNativeBridge() ? 'android-app' : 'other')
                return
            }

            // Ceremony-guard errors (shim race / timeout, TASK-21782) are reported
            // inside handleRegister. A timed-out register may have completed
            // server-side, so the username check routes the user to Log in
            // instead of a colliding re-register.
            if (isCeremonyGuardError(error)) {
                if (error.name === 'CeremonyTimeoutError' && (await isUsernameTaken(username))) {
                    setUsernameTaken(true)
                } else if (error.name === 'CeremonyTimeoutError') {
                    // The timer says whether the sheet hung or the person switched apps; an older timer says neither.
                    const outcome = (error as { outcome?: string }).outcome
                    setInlineError(t('passkey.tookTooLong'))
                    // Only the Android timer tells the two outcomes apart; web and iOS keep Konrad's inline line.
                    if (isAndroidNativeBridge()) {
                        setHelpReason(outcome === 'left_app' ? 'left-app' : 'took-too-long')
                        setIsHelpOpen(true)
                    }
                } else if (error.name === 'PasskeyShimNotReadyError') {
                    setInlineError(t('passkey.notReady'))
                } else if (error.name === 'CeremonyConflictError') {
                    setInlineError(t('passkey.interrupted'))
                } else if (error.name === 'PasskeyRequestSettlingError') {
                    setInlineError(t('passkey.settling'))
                } else if (error.name === 'PasskeyCleanupPendingError') {
                    setInlineError(t('passkey.stillOpen'))
                } else {
                    setInlineError(t('passkey.deviceState'))
                }
                return
            }

            // The API rate-limited the request; the prompt may not have opened and a wait fixes it.
            if (err.name === 'PasskeyRateLimitedError') {
                Sentry.captureException(err, { level: 'warning', tags: { error_type: 'passkey_rate_limited' } })
                setInlineError(t('passkey.rateLimited'))
                return
            }

            // The passkey server answered the options request with an error
            // body instead of a challenge, so the OS prompt never opened: no
            // device help applies.
            if (err.name === 'PasskeyServerError') {
                Sentry.captureException(err, { tags: { error_type: 'passkey_server_failure' } })
                setInlineError(t('passkey.serverUnreachable'))
                return
            }

            // Android cannot create a passkey yet (no screen lock, no Google
            // account, no credential provider). The plugin reports it as a
            // cancel; the help drawer lists the fixes.
            if (nativeReason === 'setup_required') {
                reportPasskeyFailure(err, 'registration')
                setHelpErrorName(WebAuthnErrorName.NotAllowed)
                setHelpReason('android-setup')
                setIsHelpOpen(true)
                return
            }

            // In the app, only a reason the native layer names as a cancel is one. A NotAllowedError with no
            // known message may be a provider that refused, so it says "not completed", never "cancelled".
            const nativeCancel = nativeReason === 'canceled'
            const nativeUnclassified = !nativeReason && err.name === WebAuthnErrorName.NotAllowed
            const showCancelOrUnfinished = () => {
                setInlineError(t(nativeCancel ? 'passkey.cancelled' : 'passkey.notCompleted'))
                setInlineErrorCode(nativeCancel ? 'cancelled' : null)
            }

            // The iOS app ends the ceremony as a plain cancel when iCloud
            // Passwords is off, even after its own prompt sent the user to
            // Settings. iPhone Safari keeps the browser path below.
            if ((nativeCancel || nativeUnclassified) && isIOSNativeBridge()) {
                if (nativeReason) reportPasskeyFailure(err, 'registration')
                iosCancelsRef.current += 1
                const fastCancel = ceremony !== undefined && ceremony.durationMs < IOS_FAST_CANCEL_MS
                if (fastCancel || iosCancelsRef.current >= CANCELS_BEFORE_HELP) {
                    setHelpErrorName(PASSKEY_NOT_SAVED_HELP)
                    setHelpReason('ios-not-saved')
                    setIsHelpOpen(true)
                } else {
                    showCancelOrUnfinished()
                }
                return
            }

            // The Android app: Samsung Pass or another provider can open in front of Google's and fail as a
            // cancel. A second cancel, or any unclassified refusal, gets the steps to pick another manager.
            if ((nativeCancel || nativeUnclassified) && isAndroidNativeBridge()) {
                if (nativeReason) reportPasskeyFailure(err, 'registration')
                if (nativeCancel) androidCancelsRef.current += 1
                showCancelOrUnfinished()
                if (nativeUnclassified || androidCancelsRef.current >= CANCELS_BEFORE_HELP) {
                    setHelpReason('android-cancel')
                    setIsHelpOpen(true)
                }
                return
            }

            if (nativeReason) {
                reportPasskeyFailure(err, 'registration')
                if (nativeCancel) showCancelOrUnfinished()
                else setInlineError(t(getPasskeySetupKey(classifyPasskeyError(err).code)))
                return
            }

            // NotAllowedError is either a cancel (most common) or a browser block
            // (private mode, privacy settings). Only the block needs the help drawer.
            if (err.name === WebAuthnErrorName.NotAllowed) {
                if (isProbablyPrivateMode()) {
                    setHelpErrorName(WebAuthnErrorName.NotAllowed)
                    setHelpReason('private-mode')
                    setIsHelpOpen(true)
                } else {
                    setInlineError(t('passkey.cancelled'))
                    setInlineErrorCode('cancelled')
                }
                return
            }

            if (
                [
                    WebAuthnErrorName.NotReadable,
                    WebAuthnErrorName.InvalidState,
                    WebAuthnErrorName.NotSupported,
                ].includes(err.name as WebAuthnErrorName)
            ) {
                setHelpErrorName(err.name)
                setHelpReason('error-name')
                setIsHelpOpen(true)
            } else {
                Sentry.captureException(error, {
                    tags: { error_type: 'passkey_setup_error' },
                    extra: { errorName: err.name, deviceType },
                })
                setHelpErrorName('UnknownError')
                setHelpReason('error-name')
                setIsHelpOpen(true)
            }
        }
    }

    const claim = async () => {
        if (inFlightRef.current || completedRef.current) return
        inFlightRef.current = true
        setRegistrationInProgress(true)
        setIsPreparing(true)
        try {
            await register()
        } finally {
            inFlightRef.current = false
            if (!registrationInitiatedRef.current || completedRef.current) setRegistrationInProgress(false)
            setIsPreparing(false)
        }
    }

    const logIn = async () => {
        trackError('log_in', null)
        setInlineError(null)
        setInlineErrorCode(null)
        try {
            await handleLoginClick()
            // success: useLogin's effect redirects once the user is loaded
        } catch (error) {
            trackError('log_in', getPasskeyErrorCode(error) ?? classifyPasskeyError(error).code)
            // The taken username belongs to a deleted account, so only a new username can sign up.
            if (getPasskeyErrorCode(error) === 'ACCOUNT_DELETED') {
                setUsernameTaken(false)
                setInlineError(t('passkey.accountDeletedChooseUsername'))
                return
            }
            const i18nKey = getPasskeyErrorSetupKey(error)
            setInlineError(i18nKey ? t(i18nKey) : (error as Error)?.message || t('loginFailed'))
        }
    }

    // Advance only when a wallet address appears AFTER this step started a
    // registration. Gating on that intent, not on the address value, keeps a
    // stale hydrated address from skipping the step into a half-valid session.
    useEffect(() => {
        if (address && registrationInitiatedRef.current) {
            registrationInitiatedRef.current = false
            completedRef.current = true
            setIsFinishing(true)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED, { device_type: deviceType })
            setNoBackLockScreenId(postRegistrationScreen(steps.map((step) => step.screenId)))
            const userId = userRef.current?.user.userId
            if (userId) {
                void bindSignupDraft(userId, snapshotRef.current).then(() => {
                    if (!referred.current) return
                    void settlePendingInviteAttribution(userId, 'registration').then((outcome) => {
                        if (userRef.current?.user.userId !== userId || outcome.status !== 'attributed') return
                        markSignupDraftInviteAccepted(userId)
                        setInviterAccepted(true)
                        posthog.capture(ANALYTICS_EVENTS.SIGNUP_INVITER_ADDED)
                        void fetchUser().catch(() => {})
                    })
                })
            }
            void handleNext()
            setRegistrationInProgress(false)
        }
    }, [
        address,
        handleNext,
        deviceType,
        setNoBackLockScreenId,
        setRegistrationInProgress,
        setInviterAccepted,
        fetchUser,
        steps,
    ])

    return {
        claim,
        isClaiming: isPreparing || isRegistering || isFinishing,
        preflightWarning,
        inlineError,
        inlineErrorCode,
        usernameTaken,
        logIn,
        isLoggingIn,
        helpErrorName,
        helpReason,
        isHelpOpen,
        closeHelp: () => setIsHelpOpen(false),
        retryFromHelp: () => {
            setIsHelpOpen(false)
            void claim()
        },
        /** The pre-check screens' "Open settings": the phone's security settings, where a screen lock is set. */
        openSettings: () => {
            void openPasskeySettings().catch((error: unknown) => {
                Sentry.captureException(error, { tags: { error_type: 'passkey_settings_open_failed' } })
            })
        },
        isProviderUnsupportedOpen: providerUnsupportedPlatform !== null,
        providerUnsupportedPlatform: providerUnsupportedPlatform ?? 'other',
        closeProviderUnsupported: () => setProviderUnsupportedPlatform(null),
        retryFromProviderUnsupported: () => {
            setProviderUnsupportedPlatform(null)
            void claim()
        },
        signUpInBrowser: async () => {
            try {
                await openExternalUrl(keepWebSignupUrl())
                setProviderUnsupportedPlatform(null)
            } catch (error) {
                // The drawer stays open, so retry and support still work.
                Sentry.captureException(error, { tags: { error_type: 'passkey_provider_browser_open_failed' } })
            }
        },
        deviceType,
    }
}
