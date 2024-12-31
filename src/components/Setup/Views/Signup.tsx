import { Button, Card } from '@/components/0_Bruddle'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { next_proxy_url } from '@/constants'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import Link from 'next/link'
import { useState } from 'react'

const SignupStep = () => {
    const dispatch = useAppDispatch()
    const { handle } = useSetupStore()
    const [error, setError] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)

    const checkHandleValidity = async (handle: string): Promise<boolean> => {
        // clear error when starting a new validation
        setError('')

        // handle empty input
        if (!handle.trim()) {
            setError('Handle is required')
            return false
        }

        // check length requirement
        if (handle.length < 4) {
            setError('Handle must be at least 4 characters long')
            return false
        }

        // check character requirement
        if (!handle.match(/^[a-zA-Z\d]*$/)) {
            setError('Handle must contain only letters and numbers')
            return false
        }

        try {
            const res = await fetch(`${next_proxy_url}/get/users/username/${handle}`, {
                method: 'HEAD',
            })
            const isHandleTaken = res.status === 200

            if (isHandleTaken) {
                setError('Handle already taken')
                return false
            }

            // clear error if all validations pass
            setError('')
            return true
        } catch (err) {
            setError('Failed to check handle availability. Please try again.')
            return false
        }
    }

    const handleInputUpdate = ({
        value,
        isChanging,
        isValid,
    }: {
        value: string
        isChanging: boolean
        isValid: boolean
    }) => {
        dispatch(setupActions.setHandle(value))
        setIsValid(isValid)
        setIsChanging(isChanging)

        // Clear error when input is being changed
        if (isChanging) {
            setError('')
        }
    }

    return (
        <Card className="border-0">
            <Card.Content className="flex h-full min-h-42 flex-col justify-between p-0 md:min-h-32">
                <div className="w-full space-y-2">
                    <div className="flex items-center gap-2">
                        <ValidatedInput
                            className=""
                            placeholder="Choose your handle"
                            value={handle}
                            debounceTime={750}
                            validate={checkHandleValidity}
                            onUpdate={handleInputUpdate}
                        />
                        <Button
                            className="w-4/12"
                            loading={isLoading || isChanging}
                            shadowSize="4"
                            onClick={() => handleNext(async () => isValid)}
                            disabled={!isValid || isChanging || isLoading}
                        >
                            Create
                        </Button>
                    </div>
                    {error && <p className="text-sm font-bold text-error">{error}</p>}
                </div>
                <div>
                    <p className="border-t border-gray-1 pt-2 text-center text-xs text-gray-1">
                        <span>By creating account you agree with </span>
                        <Link
                            rel="noopener noreferrer"
                            target="_blank"
                            className="underline underline-offset-2"
                            href="https://peanutprotocol.notion.site/Terms-of-Service-Privacy-Policy-1f245331837f4b7e860261be8374cc3a?pvs=4"
                        >
                            T&C and Privacy Policy
                        </Link>{' '}
                    </p>
                </div>
            </Card.Content>
        </Card>
    )
}

export default SignupStep
