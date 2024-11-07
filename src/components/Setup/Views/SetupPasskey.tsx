import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import Icon from '@/components/Global/Icon'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useZeroDev } from '@/context/walletContext/zeroDevContext.context'
import { PasskeyStorage } from '../Setup.helpers'
import { useAuth } from '@/context/authContext'

const SetupPasskey = () => {
    const { handleNext, handleBack, isLoading, screenProps = { handle: '' } } = useSetupFlow()
    const { handleRegister } = useZeroDev()
    const { fetchUser } = useAuth()
    const toast = useToast()

    const { handle } = screenProps

    console.log('Creating passkey for handle', handle)

    const createKey = async () => {
        try {
            // set register
            const { account } = await handleRegister(handle)

            // once register is set, provider is setup,
            // all calls get a response and
            // cookies are set properly, then get the user
            //
            // note: this was tested to ensure jwt will be set in Cookies
            // by the time we arive to fetchUser()
            //
            // TODO: ensure getUser() is properly called on reload
            fetchUser()
            

            const smartAccountAddress = account.address

            // TODO: Remove PasskeyStorage altogether
            PasskeyStorage.add({ handle, account: smartAccountAddress })

            return true;
        } catch (error) {
            console.log('Error creating passkey', error)
            toast.error('Failed to create passkey')
            return false;
        }
    }

    return (
        <div className="flex h-full gap-4 flex-col text-center justify-between">
            <p className="">You're about to register as: <span className="text-lg font-bold">{handle}</span></p>
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
