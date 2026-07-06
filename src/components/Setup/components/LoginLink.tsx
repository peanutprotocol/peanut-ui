'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

// Login affordance for setup screens other than Landing. A stale campaignTag
// cookie can route a returning user straight to Signup (skipping Landing's Log
// In button), so this keeps login reachable wherever the router drops them.
// Mirrors Landing.tsx's error handling (toast + Sentry + SIGNUP_LOGIN_ERROR).
const LoginLink = () => {
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()

    const handleError = (error: any) => {
        const errorMessage =
            error.code === 'LOGIN_CANCELED'
                ? 'Login was canceled. Please try again.'
                : error.code === 'NO_PASSKEY'
                  ? 'No passkey found. Please create a wallet first.'
                  : 'An unexpected error occurred during login.'
        toast.error(errorMessage)
        Sentry.captureException(error, { extra: { errorCode: error.code } })
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, { error_code: error.code })
    }

    const onLoginClick = async () => {
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    return (
        <button
            type="button"
            onClick={onLoginClick}
            disabled={isLoggingIn}
            className="text-xs text-grey-1 underline underline-offset-2 disabled:opacity-60"
        >
            Already have an account? Log in
        </button>
    )
}

export default LoginLink
