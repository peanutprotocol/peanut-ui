import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const AddWallets = () => {
    const { handleNext } = useSetupFlow()

    return (
        <div className="flex h-full flex-col justify-end gap-2">
            <Button
                variant="dark"
                disabled
                onClick={() => {
                    // Logic to connect a wallet & create a new account
                }}
            >
                Connect
            </Button>
            <Button
                variant="stroke"
                size="small"
                onClick={() => {
                    handleNext()
                }}
            >
                Skip
            </Button>
        </div>
    )
}

export default AddWallets
