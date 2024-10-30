import { Button } from '@/components/0_Bruddle'
import BaseInput from '@/components/0_Bruddle/BaseInput'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useState } from 'react'

const WelcomeStep = () => {
    const toast = useToast()
    const [handle, setHandle] = useState('')
    const { handleNext, isLoading } = useSetupFlow()

    // TODO: Add call backend username validity
    const checkHandleValidity = async (handle: string) => {
        await new Promise<void>((resolve, reject) => {
            setTimeout(() => {
                if (handle.length <= 3) {
                    reject(new Error('Handle must be at least 3 characters long'))
                }
                resolve()
            }, 1000)
        })
    }

    const businessLogic = async () => {
        try {
            await checkHandleValidity(handle)
            return true
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Couldn't create handle")
            return false
        }
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
