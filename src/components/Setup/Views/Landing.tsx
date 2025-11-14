'use client'

import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useLogin } from '@/hooks/useLogin'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'

const LandingStep = () => {
    const { handleNext } = useSetupFlow()
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
                <Button shadowSize="4" className="h-11" onClick={() => handleNext()}>
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
                    <Link href="/support" className="text-xs text-grey-1 underline underline-offset-2">
                        Need to recover your Peanut wallet?
                    </Link>
                </div>
            </Card.Content>
        </Card>
    )
}

export default LandingStep
