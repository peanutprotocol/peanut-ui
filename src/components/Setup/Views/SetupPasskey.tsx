import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Icon from '@/components/Global/Icon'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useAuth } from '@/context/authContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { WalletProviderType } from '@/interfaces'
import { PasskeyStorage } from '../Setup.helpers'

const SetupPasskey = () => {
    const { handleNext, handleBack, isLoading, screenProps = { handle: '' } } = useSetupFlow()
    const { handleRegister } = useZeroDev()
    const { fetchUser, addAccount } = useAuth()
    const toast = useToast()

    const { handle } = screenProps

    console.log('Creating passkey for handle', handle)

    const createKey = async () => {
        try {
            // set register
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
            toast.error('Failed to create passkey')
            return false
        }
    }

    return (
        <div className="flex h-full flex-col justify-end gap-4 text-center">
            <p className="">
                You're about to register as: <span className="text-lg font-bold">{handle}</span>
            </p>
            <div className="flex flex-row items-center gap-2">
                <Button onClick={handleBack} variant="stroke">
                    <Icon name="arrow-prev" />
                </Button>
                <Button
                    loading={isLoading}
                    onClick={() => {
                        handleNext(createKey)
                    }}
                    className="text-nowrap"
                >
                    Create
                </Button>
            </div>
        </div>
    )
}

export default SetupPasskey
