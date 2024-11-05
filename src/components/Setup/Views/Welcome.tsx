import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import { useSetupFlow } from '@/components/Setup/context/SetupFlowContext'
import { useState } from 'react'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { next_proxy_url } from '@/constants'

const WelcomeStep = () => {
    const toast = useToast()
    const [handle, setHandle] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)

    const checkHandleValidity = async (handle: string): Promise<boolean> => {
        if (handle.length < 4) {
            toast.error('Handle must be at least 4 characters long')
            return false
        }
        const res = await fetch(`${next_proxy_url}/get/users/username/${handle}`, {
            method: 'HEAD', // we only need the status code no body
        })
        // 404 on user means no user exist with this handle
        const isHandleTaken = 404 !== res.status
        if (isHandleTaken) {
            toast.error('Handle already taken')
        }
        return !isHandleTaken
    }

    return (
        <div className="flex h-full flex-col justify-end gap-8">
            <ValidatedInput
                placeholder="Pick your new handle"
                value={handle}
                debounceTime={750}
                validate={checkHandleValidity}
                onUpdate={({ value, isChanging, isValid }) => {
                    setHandle(value)
                    setIsValid(isValid)
                    setIsChanging(isChanging)
                }}
            />
            <Button
                loading={isLoading || isChanging}
                onClick={() => {
                    handleNext<'passkey'>(async () => true, { handle })
                }}
                disabled={!isValid || isChanging || isLoading}
            >
                Next
            </Button>
        </div>
    )
}

export default WelcomeStep
