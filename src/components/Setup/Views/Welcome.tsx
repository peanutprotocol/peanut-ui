import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useState } from 'react'

const WelcomeStep = () => {
    const [handle, setHandle] = useState('')
    const { handleNext, isLoading } = useSetupFlow()

    const businessLogic = async () => {
        await new Promise<void>((resolve) => {
            setTimeout(() => {
                resolve()
            }, 1000)
        })
    }

    return (
        <div className="flex h-full flex-col justify-end gap-8">
            <BaseInput
                placeholder="Pick you new handle"
                onChange={(e) => {
                    setHandle(e.target.value)
                }}
            />
            <Button
                loading={isLoading}
                onClick={() => {
                    handleNext<'passkey'>(businessLogic, { handle })
                }}
            >
                Next
            </Button>
        </div>
    )
}

export default WelcomeStep
