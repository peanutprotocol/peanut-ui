import { Button } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'

const SetupSuccess = () => {
    const { handleNext, handleBack } = useSetupFlow()

    return (
        <div className="flex flex-row items-center gap-2">
            <Button onClick={handleBack} variant="stroke">
                <Icon name="arrow-prev" />
            </Button>
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
