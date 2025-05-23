import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { getFromLocalStorage } from '@/utils'

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
                <Button shadowSize="4" onClick={() => handleNext()}>
                    Sign up
                </Button>
                <Button
                    loading={isLoggingIn}
                    variant="transparent-dark"
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
                    Log in
                </Button>
            </Card.Content>
        </Card>
    )
}

export default WelcomeStep
