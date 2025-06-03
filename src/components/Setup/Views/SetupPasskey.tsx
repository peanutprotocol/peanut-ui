import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import { WalletProviderType } from '@/interfaces'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { getFromLocalStorage } from '@/utils'
import { Link } from '@chakra-ui/react'
import * as Sentry from '@sentry/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
            <div className="flex h-full min-h-32 flex-col justify-between p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2 text-center">
                    <Button
                        loading={isLoading}
                        disabled={isLoading}
                        onClick={async () => {
                            dispatch(setupActions.setLoading(true))
                            try {
                                await handleRegister(username)
                            } catch (e) {
                                Sentry.captureException(e)
                                console.error('Error registering passkey:', e)
                                setError('Error registering passkey.')
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
                <div>
                    <p className="border-t border-grey-1 pt-2 text-center text-xs text-grey-1">
                        <Link
                            rel="noopener noreferrer"
                            target="_blank"
                            className="underline underline-offset-2"
                            href="https://peanutprotocol.notion.site/Terms-of-Service-Privacy-Policy-1f245331837f4b7e860261be8374cc3a?pvs=4"
                        >
                            Learn more about what Passkeys are
                        </Link>{' '}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SetupPasskey
