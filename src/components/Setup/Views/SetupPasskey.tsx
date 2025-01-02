import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { WalletProviderType } from '@/interfaces'
import { useSetupStore } from '@/redux/hooks'
import { useState } from 'react'
import { PasskeyStorage } from '../Setup.helpers'

const SetupPasskey = () => {
    const { handle } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { handleRegister } = useZeroDev()
    const { fetchUser, addAccount } = useAuth()
    const [error, setError] = useState<string | null>(null)

    const createKey = async () => {
        try {
            const { account } = await handleRegister(handle)
            if (!account) {
                throw new Error('Failed to register handle, account is undefined')
            }

            // once register is set, provider is setup,
            // all calls get a response and
            // cookies are set properly, then get add the new PW
            // as an account (calls fetchUser() interanlly on success)
            //
            // note: this was tested to ensure jwt will be set in Cookies
            // by the time we arive to fetchUser()
            //
            // TODO: ensure getUser() is properly called on reload
            // TODO: on login -> this will need to be just fetchUser() instead of, also, addAccount()
            const fetchedUser = await fetchUser()
            await addAccount({
                accountIdentifier: account.address,
                accountType: WalletProviderType.PEANUT,
                userId: fetchedUser?.user.userId as string,
            })

            const smartAccountAddress = account.address

            // TODO: Remove PasskeyStorage altogether
            PasskeyStorage.add({ handle, account: smartAccountAddress })

            return true
        } catch (error) {
            console.log('Error creating passkey', error)
            setError('Failed to create passkey')
            return false
        }
    }

    return (
        <div className="flex h-full flex-col justify-end gap-2 text-center">
            <Button loading={isLoading} onClick={() => handleNext(createKey)} className="text-nowrap" shadowSize="4">
                Add a passkey
            </Button>
            {error && <p className="text-sm font-bold text-error">{error}</p>}
        </div>
    )
}

export default SetupPasskey
