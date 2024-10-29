import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { EyeIcon } from '@/components/Setup/components/EyesIcon'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const SetupPasskey = () => {
    const { handleNext, handleBack, isLoading, screenProps = { handle: '' } } = useSetupFlow()

    const { handle } = screenProps

    console.log('Creating passkey for handle', handle)

    const createKey = () =>
        new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve()
            }, 1000)
        })

    return (
        <div className="flex h-full flex-col justify-between">
            <div>
                <EyeIcon className="mx-auto h-20 w-20" />
            </div>
            <div className="flex flex-row items-center gap-2">
                <Button onClick={handleBack} variant="stroke">
                    <Icon name="arrow-prev" />
                </Button>
                <Button
                    loading={isLoading}
                    onClick={() => {
                        handleNext(createKey)
                    }}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}

export default SetupPasskey
