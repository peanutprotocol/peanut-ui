'use client'

import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import { getFromLocalStorage } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const WelcomeStep = () => {
    const { handleNext } = useSetupFlow()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const { user } = useAuth()
    const { push } = useRouter()
    const toast = useToast()

    useEffect(() => {
        if (!!user) push('/home')
    }, [user, push])

    const handleError = (error: any) => {
        const errorMessage =
            error.code === 'LOGIN_CANCELED'
                ? 'Login was canceled. Please try again.'
                : error.code === 'NO_PASSKEY'
                  ? 'No passkey found. Please create a wallet first.'
                  : 'An unexpected error occurred during login.'
        toast.error(errorMessage)
        Sentry.captureException(error, { extra: { errorCode: error.code } })
        if (error.code === 'NO_PASSKEY') {
            handleNext() // Redirect to registration
        }
    }

    return (
        <Card className="border-0">
            <Card.Content className="space-y-4 p-0 pt-4">
                <Button shadowSize="4" className="h-11" onClick={() => handleNext()}>
                    Create your wallet
                </Button>
                <Button
                    loading={isLoggingIn}
                    shadowSize="4"
                    disabled={isLoggingIn}
                    className="h-11"
                    variant="primary-soft"
                    onClick={async () => {
                        try {
                            await handleLogin()
                            const localStorageRedirect = getFromLocalStorage('redirect')
                            if (localStorageRedirect) {
                                localStorage.removeItem('redirect')
                                push(localStorageRedirect)
                            } else {
                                push('/home')
                            }
                        } catch (e: any) {
                            handleError(e)
                        }
                    }}
                >
                    Log In
                </Button>
            </Card.Content>
        </Card>
    )
}

export default WelcomeStep
