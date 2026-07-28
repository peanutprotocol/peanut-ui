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
import { useTranslations } from 'next-intl'

const LandingStep = () => {
    const t = useTranslations('setup')
    const { handleNext } = useSetupFlow()
    const { handleLoginClick, isLoggingIn } = useLogin()
    const toast = useToast()

    // The auth landing is a "real auth" surface. Demo mode persists in
    // localStorage, so without this a prior demo session would make Log In /
    // Sign up re-enter demo (user = DEMO_USER → routed to the demo home).
    useEffect(() => {
        disableDemoMode()
    }, [])

    const handleError = (error: unknown) => {
        const errorCode = error instanceof Error && 'code' in error ? String(error.code) : undefined
        toast.error((error instanceof Error && error.message) || t('loginFailed'))
        Sentry.captureException(error, { extra: { errorCode } })
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_LOGIN_ERROR, { error_code: errorCode })
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
                    {t('landing.signUp')}
                </Button>
                <Button
                    loading={isLoggingIn}
                    shadowSize="4"
                    disabled={isLoggingIn}
                    className="h-11"
                    variant="primary-soft"
                    onClick={onLoginClick}
                >
                    {t('logIn')}
                </Button>
                <div className="pt-2 text-center">
                    <DocsLink
                        href="/en/help/account-recovery"
                        className="text-xs text-grey-1 underline underline-offset-2"
                    >
                        {t('landing.recoverWallet')}
                    </DocsLink>
                </div>
            </Card.Content>
        </Card>
    )
}

export default LandingStep
