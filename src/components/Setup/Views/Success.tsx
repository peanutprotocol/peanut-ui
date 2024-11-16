import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const SetupSuccess = () => {
    const { handleNext } = useSetupFlow()

    return (
        <div className="flex flex-row items-center justify-center">
            <Button
                variant="green"
                onClick={() => {
                    handleNext()
                }}
            >
                Complete
            </Button>
        </div>
    )
}

export default SetupSuccess
