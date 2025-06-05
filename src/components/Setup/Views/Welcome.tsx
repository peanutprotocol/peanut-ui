import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { NoPasskeyRegisteredError, useZeroDev } from '@/hooks/useZeroDev'
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
        if (!!user) {
            console.log('[WelcomeStep] useEffect: User detected, redirecting to /home.', user)
            push('/home')
        }
    }, [user, push])

    return (
        <Card className="border-0">
            <Card.Content className="space-y-4 p-0 pt-4">
                <Button shadowSize="4" className="h-11" onClick={() => handleNext()}>
                    Create your wallet
                </Button>
                <Button
                    loading={isLoggingIn}
                    shadowSize="4"
                    className="h-11"
                    variant="primary-soft"
                    onClick={() => {
                        console.log('[WelcomeStep] Log In button clicked.')
                        console.log('[WelcomeStep] Calling handleLogin...')
                        handleLogin()
                            .then(() => {
                                console.log('[WelcomeStep] handleLogin successful.')
                                const localStorageRedirect = getFromLocalStorage('redirect')
                                if (localStorageRedirect) {
                                    console.log(
                                        '[WelcomeStep] Redirecting to localStorageRedirect:',
                                        localStorageRedirect
                                    )
                                    localStorage.removeItem('redirect') // Clear the redirect URL
                                    push(localStorageRedirect)
                                } else {
                                    console.log('[WelcomeStep] No localStorageRedirect found, redirecting to /home.')
                                    push('/home')
                                }
                            })
                            .catch((e) => {
                                console.error('[WelcomeStep] handleLogin failed:', e)
                                if (e instanceof NoPasskeyRegisteredError) {
                                    toast.error(e.message || 'No passkey registered. Please create an account first.')
                                } else {
                                    toast.error('Error logging in. Please try again.')
                                }
                                Sentry.captureException(e)
                            })
                    }}
                >
                    Log In
                </Button>
            </Card.Content>
        </Card>
    )
}

export default WelcomeStep
