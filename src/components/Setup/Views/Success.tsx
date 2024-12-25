import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/hooks/useSetupFlow'

const SetupSuccess = () => {
    const { handleNext } = useSetupFlow()

    return (
        <Button
            shadowSize="4"
            onClick={() => {
                handleNext()
            }}
        >
            {`Let's go`}
        </Button>
    )
}

export default SetupSuccess
