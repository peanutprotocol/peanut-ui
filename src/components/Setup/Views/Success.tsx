import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const SetupSuccess = () => {
    const { handleNext } = useSetupFlow()

    return (
        <div className="flex h-full flex-col justify-end">
            <Button
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
