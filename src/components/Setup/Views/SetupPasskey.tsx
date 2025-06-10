import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { getFromLocalStorage } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { WebAuthnError } from '@simplewebauthn/browser'

const SetupPasskey = () => {
    const dispatch = useAppDispatch()
    const { username } = useSetupStore()
    const { isLoading } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { user } = useAuth()
    const { addAccount } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (address && user) {
            addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user?.user.userId as string,
            })
                .then(() => {
                    // if redirect is set, redirect to the redirect url and clear
                    const localStorageRedirect = getFromLocalStorage('redirect')
                    if (localStorageRedirect) {
                        localStorage.removeItem('redirect')
                        router.push(localStorageRedirect)
                    } else {
                        router.push('/home')
                    }
                })
                .catch((e) => {
                    Sentry.captureException(e)
                    console.error('Error adding account', e)
                    setError('Error adding account')
                })
                .finally(() => {
                    dispatch(setupActions.setLoading(false))
                })
        }
    }, [address, user])

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-3 p-0 ">
                <Button
                    loading={isLoading}
                    disabled={isLoading}
                    onClick={async () => {
                        dispatch(setupActions.setLoading(true))
                        try {
                            await handleRegister(username)
                        } catch (e) {
                            if (e instanceof WebAuthnError) {
                                // https://github.com/MasterKale/SimpleWebAuthn/blob/master/packages/browser/src/helpers/identifyRegistrationError.ts
                                if (e.message.includes('timed out or was not allowed')) {
                                    setError('Passkey registration timed out or cancelled. Please try again.')
                                    dispatch(setupActions.setLoading(false))
                                    return
                                } else {
                                    setError(e.message)
                                }
                            } else {
                                setError('Error registering passkey.')
                            }
                            console.error('Error registering passkey:', e)
                            Sentry.captureException(e)
                            dispatch(setupActions.setLoading(false))
                        }
                    }}
                    className="text-nowrap"
                    shadowSize="4"
                >
                    Set it up
                </Button>
                {error && <p className="text-sm font-bold text-error">{error}</p>}
            </div>
        </div>
    )
}

export default SetupPasskey
