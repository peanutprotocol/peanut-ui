'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useEffect } from 'react'
import { disableDemoMode } from '@/utils/demo'
import DocsLink from '@/components/Global/DocsLink'

const LandingStep = () => {
    const { handleNext } = useSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    const handleError = (error: any) => {
        toast.error(error?.message || 'We couldn’t log you in. Please try again.')
        Sentry.captureException(error, { extra: { errorCode: error?.code } })
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, { error_code: error?.code })
    }

    const onLoginClick = async () => {
        try {
            await handleLoginClick()
        } catch (e) {
            handleError(e)
        }
    }

    return (
        <Card className="border-0">
            <Card.Content className="space-y-4 p-0 pt-4">
                <Button
                    shadowSize="4"
                    className="h-11"
                    onClick={() => {
                        posthog.capture(ANALYTICS_EVENTS.SIGNUP_CLICKED)
                        handleNext()
                    }}
                >
                    Sign up
                </Button>
                <Button
                    loading={isLoggingIn}
                    shadowSize="4"
                    disabled={isLoggingIn}
                    className="h-11"
                    variant="primary-soft"
                    onClick={onLoginClick}
                >
                    Log In
                </Button>
                <div className="pt-2 text-center">
                    <DocsLink
                        href="/en/help/account-recovery"
                        className="text-xs text-grey-1 underline underline-offset-2"
                    >
                        Need to recover your Peanut wallet?
                    </DocsLink>
                </div>
            </Card.Content>
        </Card>
    )
}

export default LandingStep
