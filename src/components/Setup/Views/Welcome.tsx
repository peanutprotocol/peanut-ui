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
    }, [user])

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
                        handleLogin()
                            .then(() => {
                                const localStorageRedirect = getFromLocalStorage('redirect')
                                if (localStorageRedirect) {
                                    localStorage.removeItem('redirect') // Clear the redirect URL
                                    push(localStorageRedirect)
                                }
                            })
                            .catch((e) => {
                                toast.error('Error logging in')
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
