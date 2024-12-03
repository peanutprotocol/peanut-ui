import { Button, Card } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useState } from 'react'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { next_proxy_url } from '@/constants'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { useRouter } from 'next/navigation'

const WelcomeStep = () => {
    const toast = useToast()
    const [handle, setHandle] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const { handleLogin, isLoggingIn } = useZeroDev()
    const [isSignUp, setIsSignUp] = useState(false)
    const { push } = useRouter()

    const checkHandleValidity = async (handle: string): Promise<boolean> => {
        if (handle.length < 4) {
            toast.error('Handle must be at least 4 characters long')
            return false
        }
        if (!handle.match(/^[a-zA-Z\d]*$/)) {
            toast.error('Handle must contain only letters and numbers')
            return false
        }
        const res = await fetch(`${next_proxy_url}/get/users/username/${handle}`, {
            method: 'HEAD', // we only need the status code no body
        })
        // 200 on user means an user exists with this handle
        const isHandleTaken = 200 === res.status
        if (isHandleTaken) {
            toast.error('Handle already taken')
        } else if (404 !== res.status) {
            console.error('Failed to check handle', res)
            toast.error('Failed to check handle')
            return false
        }
        return !isHandleTaken
    }
    return (
        <Card className="mx-auto w-full max-w-md border-2 shadow-lg">
            <Card.Content className="space-y-4 pt-6">
                {!isSignUp ? (
                    <>
                        <Button shadowSize="4" onClick={() => setIsSignUp(true)}>
                            Create my wallet!
                        </Button>
                        <Button
                            shadowSize="4"
                            loading={isLoggingIn}
                            variant="stroke"
                            onClick={() => {
                                handleLogin()
                                    .then(() => push('/home'))
                                    .catch((_e) => toast.error('Error logging in'))
                            }}
                        >
                            Login
                        </Button>
                    </>
                ) : (
                    <>
                        <div className="space-y-2">
                            <ValidatedInput
                                placeholder="Pick your new handle"
                                value={handle}
                                debounceTime={750}
                                validate={checkHandleValidity}
                                onUpdate={({ value, isChanging, isValid }) => {
                                    setHandle(value)
                                    setIsValid(isValid)
                                    setIsChanging(isChanging)
                                }}
                            />
                        </div>
                        <Button
                            loading={isLoading || isChanging}
                            shadowSize="4"
                            onClick={() => {
                                handleNext<'passkey'>(async () => true, { handle })
                            }}
                            disabled={!isValid || isChanging || isLoading}
                        >
                            Next
                        </Button>
                    </>
                )}
            </Card.Content>
        </Card>
    )
}

export default WelcomeStep
