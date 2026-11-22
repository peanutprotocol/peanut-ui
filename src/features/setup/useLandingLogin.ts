'use client'

import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { useEffect, useState } from 'react'
import { useToast } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useOptionalSetupFlow } from '@/features/setup/SetupFlowContext'
import { discardSignupDraft, readSignupDraft } from '@/features/setup/signup-draft'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useLoginRecovery } from '@/hooks/useLoginRecovery'
import { useLogin } from '@/hooks/useLogin'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { isCapacitor } from '@/utils/capacitor'
import { disableDemoMode } from '@/utils/demo'
import { useNativePlatform } from '@/utils/native-platform'
import { loadPasskeyDeviceFacts, passkeyFailureFields } from '@/utils/passkey-failure-fields'
import {
    classifyPasskeyError,
    getPasskeyErrorCode,
    getPasskeyErrorSetupKey,
    isAlreadyReported,
} from '@/utils/webauthn.utils'

/**
 * The sign-up landing's log-in and sign-up behaviour, moved unchanged from dev's `Views/Landing.tsx`: the web
 * download-only rule, the draft rule on Sign up, the recovery rule after a failed log-in, the account-deleted
 * callout, the recovery drawer and their analytics. Contract: mono _temp/signup-redesign/r2/r9/build/contract/P1.md § 1.
 */
export function useLandingLogin() {
    const nativePlatform = useNativePlatform()
    const t = useTranslations('setup')
    const hasKeepWebBypass = useKeepWebBypass()
    const { deviceType } = useDeviceType()

    // On the web NEW signups are app-only, so the app download leads and Log In
    // drops to a text link for existing accounts. Native app and keep-web
    // bypass users get Sign up and Log in.
    const blockSignup = !nativePlatform.isCapacitor && !hasKeepWebBypass
    const { handleNext } = useSetupFlow()
    const flow = useOptionalSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()
    const { track, trackError } = useSignupControl()
    const [loginFailed, setLoginFailed] = useState(false)
    const [isAccountDeleted, setIsAccountDeleted] = useState(false)
    const { offersRecovery, openRecovery, recoveryDrawer } = useLoginRecovery({
        onRetry: () => void login(),
        // Signup is app-only on the blocked web layout; the store buttons sit behind the drawer there.
        onSignUp: blockSignup ? undefined : () => signUp(),
        repeatedCancel: true,
        onEvent: (event) =>
            event === 'open' || event === 'dismiss'
                ? track('login_recovery', event)
                : track(`recovery_${event}`, 'tap'),
    })

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    const handleError = (error: unknown) => {
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
        const passkeyErrorCode = getPasskeyErrorCode(error)
        trackError('log_in', passkeyErrorCode ?? classifyPasskeyError(error).code)
        const recovery = offersRecovery(passkeyErrorCode)
        // A single dismissal of the passkey sheet is a choice, not a failed login.
        if (passkeyErrorCode !== 'LOGIN_CANCELED' || recovery) setLoginFailed(true)
        if (passkeyErrorCode === 'ACCOUNT_DELETED') {
            setIsAccountDeleted(true)
        } else if (recovery) {
            openRecovery()
        } else {
            const i18nKey = getPasskeyErrorSetupKey(error)
            toast.error(i18nKey ? t(i18nKey) : (error instanceof Error && error.message) || t('loginFailed'))
        }
        if (!isAlreadyReported(error)) {
            Sentry.captureException(error, { extra: { errorCode } })
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, {
            ...passkeyFailureFields(error),
            error_code: errorCode,
            native: isCapacitor(),
            recovery_drawer: recovery,
        })
    }

    const login = async () => {
        trackError('log_in', null)
        setIsAccountDeleted(false)
        void loadPasskeyDeviceFacts()
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    const onLoginClick = () => {
        track('log_in', 'tap')
        void login()
    }

    const signUp = () => {
        if (readSignupDraft()?.userId) {
            discardSignupDraft()
            flow?.resetSetupFlow()
        }
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_CLICKED)
        handleNext()
    }

    const onSignUpClick = () => {
        track('sign_up', 'tap')
        signUp()
    }

    return {
        blockSignup,
        deviceType,
        isLoggingIn,
        // native only: mid-ceremony Sign Up taps flashed the next setup step (TASK-21782). On web an abandoned
        // hybrid/QR ceremony can pend minutes, so Sign Up stays an escape hatch there, and a mid-ceremony register
        // fails cleanly as CeremonyConflictError.
        signUpDisabled: isLoggingIn && nativePlatform.isCapacitor,
        loginFailed,
        isAccountDeleted,
        onLoginClick,
        onSignUpClick,
        recoveryDrawer,
        track,
    }
}
