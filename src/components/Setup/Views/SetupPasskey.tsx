import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useZeroDev } from '@/hooks/useZeroDev'
import { WalletProviderType } from '@/interfaces'
import { useSetupStore } from '@/redux/hooks'
import { useEffect, useState } from 'react'

const SetupPasskey = () => {
    const { handle } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { user } = useAuth()
    const { addAccount } = useAuth()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (address && user) {
            addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user?.user.userId as string,
            })
                .then(() => {
                    handleNext()
                })
                .catch((e) => {
                    console.error('Error adding account', e)
                    setError('Error adding account')
                })
        }
    }, [address, addAccount, user, handleNext])

    return (
        <div className="flex h-full flex-col justify-end gap-2 text-center">
            <Button
                loading={isLoading}
                onClick={async () => {
                    try {
                        await handleRegister(handle)
                    } catch (e) {
                        console.error('Error registering passkey:', e)
                        setError('Error registering passkey.')
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
