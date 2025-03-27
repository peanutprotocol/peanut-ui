import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import { WalletProviderType } from '@/interfaces'
import { useSetupStore, useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { useEffect, useState } from 'react'
import { getFromLocalStorage } from '@/utils'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'

const SetupPasskey = () => {
    const dispatch = useAppDispatch()
    const { handle } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { user } = useAuth()
    const { addAccount } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const localStorageRedirect = getFromLocalStorage('redirect')
    const redirect = localStorageRedirect ? localStorageRedirect : '/home'

    useEffect(() => {
        if (address && user) {
            addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user?.user.userId as string,
            })
                .then(() => {
                    router.push(redirect)
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
    }, [address, addAccount, user, handleNext])

    return (
        <div className="flex h-full flex-col justify-end gap-2 text-center">
            <Button
                loading={isLoading}
                disabled={isLoading}
                onClick={async () => {
                    dispatch(setupActions.setLoading(true))
                    try {
                        await handleRegister(handle)
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
                Add a Passkey
            </Button>
            {error && <p className="text-sm font-bold text-error">{error}</p>}
        </div>
    )
}

export default SetupPasskey
