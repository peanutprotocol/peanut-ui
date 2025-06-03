import { Button } from '@/components/0_Bruddle'
import ErrorAlert from '@/components/Global/ErrorAlert'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { next_proxy_url } from '@/constants'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { fetchWithSentry } from '@/utils'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useState } from 'react'

const SignupStep = () => {
    const dispatch = useAppDispatch()
    const { username } = useSetupStore()
    const [error, setError] = useState('')
    const { handleNext, isLoading } = useSetupFlow()
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)

    const checkUsernameValidity = async (username: string): Promise<boolean> => {
        // clear error when starting a new validation
        setError('')

        // handle empty input
        if (!username) {
            setError('Username is required')
            return false
        }

        // check length requirement
        if (username.length < 4) {
            setError('Username must be at least 4 characters long')
            return false
        }
        if (username.length > 12) {
            setError('Username must be at most 12 characters long')
            return false
        }

        // check character requirement
        if (!username.match(/^[a-z][a-z0-9]{3,11}$/)) {
            setError('Username must contain only lowercase letters and numbers and start with a letter')
            return false
        }

        try {
            // here we expect 404 or 400 so dont use the fetchWithSentry helper
            const res = await fetchWithSentry(`${next_proxy_url}/get/users/username/${username}`, {
                method: 'HEAD',
            })
            switch (res.status) {
                case 200:
                    setError('Username already taken')
                    return false
                case 400:
                    setError('Username is invalid, please use a different one')
                    return false
                case 404:
                    // handle is available
                    setError('')
                    return true
                default:
                    // we dont expect any other status code
                    console.error('Unexpected status code when checking handle availability:', res.status)
                    setError('Failed to check handle availability. Please try again.')
                    Sentry.captureMessage('Unexpected status code when checking handle availability', {
                        level: 'error',
                        extra: {
                            url: res.url,
                            status: res.status,
                            method: 'HEAD',
                        },
                    })
                    return false
            }
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
        dispatch(setupActions.setUsername(value.toLowerCase()))
        setIsValid(isValid)
        setIsChanging(isChanging)

        // Clear error when input is being changed
        if (isChanging) {
            setError('')
        }
    }

    return (
        <>
            <div className="flex h-full min-h-32 flex-col justify-between md:pt-5">
                <div className="mb-auto w-full space-y-2.5">
                    <div className="flex items-center gap-2">
                        <ValidatedInput
                            placeholder="Enter a username"
                            value={username}
                            debounceTime={750}
                            validate={checkUsernameValidity}
                            onUpdate={handleInputUpdate}
                        />
                        <Button
                            className="h-12 w-4/12"
                            loading={isLoading}
                            shadowSize="4"
                            onClick={() => handleNext(async () => isValid)}
                            disabled={!isValid || isChanging || isLoading}
                        >
                            Next
                        </Button>
                    </div>
                    {error && (
                        <div className="pb-1">
                            <ErrorAlert description={error} className="gap-2 text-xs" iconSize={14} />
                        </div>
                    )}
                </div>
                <div>
                    <p className="border-t border-grey-1 pt-2 text-center text-xs text-grey-1">
                        <span>By creating account you agree with </span>
                        <Link
                            rel="noopener noreferrer"
                            target="_blank"
                            href="https://peanutprotocol.notion.site/Terms-of-Service-Privacy-Policy-1f245331837f4b7e860261be8374cc3a?pvs=4"
                        >
                            <span className="underline underline-offset-2">T&C</span> and{' '}
                            <span className="underline underline-offset-2">Privacy Policy</span>
                        </Link>{' '}
                    </p>
                </div>
            </div>
        </>
    )
}

export default SignupStep
