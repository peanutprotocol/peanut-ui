'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useLogin } from '@/hooks/useLogin'
import { postRegistrationScreen, useSetupFlow } from '@/hooks/useSetupFlow'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { isCapacitor, isIOSNativeBridge } from '@/utils/capacitor'
import { apiFetch } from '@/utils/api-fetch'
import { checkPasskeySupport } from '@/utils/passkeyPreflight'
import { nativeErrorCode, nativePasskeyFailure } from '@/utils/native-passkey-errors'
import { reportPasskeyFailure } from '@/utils/passkey-failure-reporting'
import { isCeremonyGuardError } from '@/utils/passkeyCeremony.utils'
import {
    PASSKEY_NOT_SAVED_HELP,
    WebAuthnErrorName,
    classifyPasskeyError,
    getPasskeyErrorSetupKey,
    getPasskeySetupKey,
    withWebAuthnRetry,
} from '@/utils/webauthn.utils'

// A signup that failed client-side AFTER the server verified may have already
// registered this username (user + passkey exist server-side, so login works).
// Fail-open on network errors — the server's 409 is the backstop.
const isUsernameTaken = async (username: string): Promise<boolean> => {
    try {
        // capacitorHttp doesn't support HEAD — use GET in native.
        // includeAuth: false — public pre-auth check, no session token involved.
        const res = await apiFetch(`/users/username/${username}`, {
            method: isCapacitor() ? 'GET' : 'HEAD',
            includeAuth: false,
        })
        return res.status === 200
    } catch {
        return false
    }
}

// The first cancel is usually deliberate; the second on the same step usually means iOS refused to save.
const IOS_CANCELS_BEFORE_HELP = 2

const isProbablyPrivateMode = () => {
    try {
        localStorage.setItem('test', 'test')
        localStorage.removeItem('test')
        return false
    } catch {
        return true
    }
}

/**
 * Claiming a username creates the account: the passkey ceremony runs on the
 * username step, and a successful registration advances to residence and locks
 * the way back. Every failure keeps the user on the username step with the
 * same recovery the old passkey step offered: an inline message, the help
 * drawer for device problems, or Log in when the username already exists.
 */
export function useSignupPasskey(username: string) {
    const t = useTranslations('setup')
    const { setNoBackLockScreenId, steps } = useSetupFlowContext()
    const { handleNext } = useSetupFlow()
    const { handleRegister, address, isRegistering } = useZeroDev()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const { deviceType } = useDeviceType()
    const [helpErrorName, setHelpErrorName] = useState<string | null>(null)
    const [isHelpOpen, setIsHelpOpen] = useState(false)
    const [preflightWarning, setPreflightWarning] = useState<string | null>(null)
    const [inlineError, setInlineError] = useState<string | null>(null)
    const [usernameTaken, setUsernameTaken] = useState(false)
    // True only once the user starts a registration on THIS step. The advance
    // below keys off it, so a wallet address that hydrates asynchronously from a
    // stale web-authn-key cookie (native cookie jar) can never pass for a fresh
    // registration and skip ahead.
    const registrationInitiatedRef = useRef(false)
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
    // Covers those same awaits in the UI, so the button reads as busy, not dead.
    const [isPreparing, setIsPreparing] = useState(false)

    useEffect(() => {
        void checkPasskeySupport().then((result) => {
            if (!result.isSupported && result.warning) setPreflightWarning(result.warning)
        })
    }, [])

    const register = async () => {
        setInlineError(null)
        setHelpErrorName(null)
        setUsernameTaken(false)

        // Re-check support live: device state can change after mount, and a tap
        // must never silently no-op when passkeys are unavailable.
        const support = await checkPasskeySupport()
        if (!support.isSupported) {
            const message = support.warning ?? t('passkey.notAvailable')
            setPreflightWarning(message)
            setInlineError(message)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                device_type: deviceType,
                error_name: 'PreflightUnsupported',
            })
            return
        }
        setPreflightWarning(null)

        // Catch an already-registered username BEFORE the ceremony: retrying a
        // half-completed signup would otherwise create another credential in the
        // OS keychain and then 409 on the server.
        if (await isUsernameTaken(username)) {
            setUsernameTaken(true)
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                device_type: deviceType,
                error_name: 'UsernameTaken',
                error_code: 'USERNAME_TAKEN',
            })
            return
        }

        posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_STARTED, { device_type: deviceType })

        registrationInitiatedRef.current = true
        try {
            await withWebAuthnRetry(() => handleRegister(username), 'passkey-registration')
            // success: the effect below advances once the wallet address appears
        } catch (error) {
            registrationInitiatedRef.current = false
            const err = error as Error
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_FAILED, {
                device_type: deviceType,
                error_name: err.name,
                error_code: err.name === 'UsernameTaken' ? 'USERNAME_TAKEN' : classifyPasskeyError(err).code,
                native_error_code: nativeErrorCode(err),
            })

            if (err.name === 'UsernameTaken') {
                setUsernameTaken(true)
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
                    setInlineError(t('passkey.tookTooLong'))
                } else if (error.name === 'PasskeyShimNotReadyError') {
                    setInlineError(t('passkey.notReady'))
                } else if (error.name === 'CeremonyConflictError') {
                    setInlineError(t('passkey.interrupted'))
                } else {
                    setInlineError(t('passkey.deviceState'))
                }
                return
            }

            // The iOS app ends the ceremony as a plain cancel when iCloud
            // Passwords is off, even after its own prompt sent the user to
            // Settings. iPhone Safari keeps the browser path below.
            const nativeReason = nativePasskeyFailure(err)
            const cancelled =
                nativeReason === 'canceled' || (!nativeReason && err.name === WebAuthnErrorName.NotAllowed)
            if (cancelled && isIOSNativeBridge()) {
                if (nativeReason) reportPasskeyFailure(err, 'registration')
                iosCancelsRef.current += 1
                if (iosCancelsRef.current >= IOS_CANCELS_BEFORE_HELP) {
                    setHelpErrorName(PASSKEY_NOT_SAVED_HELP)
                    setIsHelpOpen(true)
                } else {
                    setInlineError(t('passkey.notCompleted'))
                }
                return
            }

            if (nativeReason) {
                reportPasskeyFailure(err, 'registration')
                setInlineError(t(getPasskeySetupKey(classifyPasskeyError(err).code)))
                return
            }

            // NotAllowedError is either a cancel (most common) or a browser block
            // (private mode, privacy settings). Only the block needs the help drawer.
            if (err.name === WebAuthnErrorName.NotAllowed) {
                if (isProbablyPrivateMode()) {
                    setHelpErrorName(WebAuthnErrorName.NotAllowed)
                    setIsHelpOpen(true)
                } else {
                    setInlineError(t('passkey.notCompleted'))
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
                setIsHelpOpen(true)
            } else {
                Sentry.captureException(error, {
                    tags: { error_type: 'passkey_setup_error' },
                    extra: { errorName: err.name, deviceType },
                })
                setHelpErrorName('UnknownError')
                setIsHelpOpen(true)
            }
        }
    }

    const claim = async () => {
        if (inFlightRef.current) return
        inFlightRef.current = true
        setIsPreparing(true)
        try {
            await register()
        } finally {
            inFlightRef.current = false
            setIsPreparing(false)
        }
    }

    const logIn = async () => {
        setInlineError(null)
        try {
            await handleLoginClick()
            // success: useLogin's effect redirects once the user is loaded
        } catch (error) {
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
            posthog.capture(ANALYTICS_EVENTS.SIGNUP_PASSKEY_SUCCEEDED, { device_type: deviceType })
            setNoBackLockScreenId(postRegistrationScreen(steps.map((step) => step.screenId)))
            void handleNext()
        }
    }, [address, handleNext, deviceType, setNoBackLockScreenId, steps])

    return {
        claim,
        isClaiming: isPreparing || isRegistering,
        preflightWarning,
        inlineError,
        usernameTaken,
        logIn,
        isLoggingIn,
        helpErrorName,
        isHelpOpen,
        closeHelp: () => setIsHelpOpen(false),
        retryFromHelp: () => {
            setIsHelpOpen(false)
            void claim()
        },
        deviceType,
    }
}
