import { Button } from '@/components/0_Bruddle'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { WalletProviderType } from '@/interfaces'
import { useSetupStore } from '@/redux/hooks'
import { useState, useEffect } from 'react'

const SetupPasskey = () => {
    const { handle } = useSetupStore()
    const { handleNext, isLoading } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { addAccount, user } = useAuth()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (address && user) {
            handleNext(async () => {
                await addAccount({
                    accountIdentifier: address,
                    accountType: WalletProviderType.PEANUT,
                    userId: user?.user.userId as string,
                })
                return true
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
                        console.error('Error registering passkey', e)
                        setError('Error registering passkey')
                    }
                }}
                className="text-nowrap"
                shadowSize="4"
            >
                Add a passkey
            </Button>
            {error && <p className="text-sm font-bold text-error">{error}</p>}
        </div>
    )
}

export default SetupPasskey
