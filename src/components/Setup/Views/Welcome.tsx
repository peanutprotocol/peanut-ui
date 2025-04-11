import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const WelcomeStep = () => {
    const { handleNext } = useSetupFlow()
    const { handleLogin, isLoggingIn } = useZeroDev()
    const { user } = useAuth()
    const { push } = useRouter()
    const toast = useToast()
    const [isCheckingPasskey, setIsCheckingPasskey] = useState(false)

    useEffect(() => {
        if (!!user) push('/home')
    }, [user])

    const checkPasskeysAndLogin = async () => {
        if (isCheckingPasskey || isLoggingIn) return

        setIsCheckingPasskey(true)
        try {
            // check if the device supports passkeys
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()

            if (!available) {
                toast.error("Your device doesn't support passkeys. Please use a compatible device.")
                return
            }

            try {
                await handleLogin()
            } catch (e) {
                console.error('Login error:', e)

                // check for common passkey-related errors
                const errorMessage = e instanceof Error ? e.message : String(e)
                const errorName = e instanceof Error ? e.name : 'Unknown'

                console.log('Error details:', { message: errorMessage, name: errorName })

                // check for passkey-related errors
                const isPasskeyError =
                    errorMessage.toLowerCase().includes('passkey') ||
                    errorMessage.toLowerCase().includes('credential') ||
                    errorMessage.toLowerCase().includes('authentication') ||
                    errorName === 'NotFoundError' ||
                    errorMessage.toLowerCase().includes('not found') ||
                    errorMessage.toLowerCase().includes('no credentials') ||
                    errorMessage.toLowerCase().includes('abort') ||
                    errorMessage.toLowerCase().includes('cancel')

                if (isPasskeyError) {
                    toast.error('No passkey found. Please sign up first to create a passkey for this device.')
                } else {
                    toast.error('Error logging in. Please try again.')
                    Sentry.captureException(e)
                }
            }
        } catch (e) {
            console.error('Outer error:', e)
            toast.error('Error logging in. Please try again.')
            Sentry.captureException(e)
        } finally {
            setIsCheckingPasskey(false)
        }
    }

    const isButtonDisabled = isLoggingIn || isCheckingPasskey

    return (
        <Card className="border-0">
            <Card.Content className="space-y-4 p-0 pt-4">
                <Button shadowSize="4" onClick={() => handleNext()}>
                    Sign up
                </Button>
                <Button
                    loading={isLoggingIn || isCheckingPasskey}
                    disabled={isButtonDisabled}
                    variant="transparent-dark"
                    onClick={checkPasskeysAndLogin}
                >
                    Log in
                </Button>
            </Card.Content>
        </Card>
    )
}

export default WelcomeStep
