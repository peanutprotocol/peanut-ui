import { Button } from '@/components/0_Bruddle'
import { useSetupFlow } from '@/hooks/useSetupFlow'

export default function PasskeySuccess() {
    const { handleNext } = useSetupFlow()

    return (
        <Button shadowSize="4" onClick={() => handleNext()}>
            Next
        </Button>
    )
}
