'use client'

import { Button } from '@/components/0_Bruddle'
import { useToast } from '@/components/0_Bruddle/Toast'
import ValidatedInput from '@/components/Global/ValidatedInput'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import * as Sentry from '@sentry/nextjs'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAppDispatch } from '@/redux/hooks'
import { setupActions } from '@/redux/slices/setup-slice'
import { invitesApi } from '@/services/invites'

const JoinWaitlist = () => {
    const [inviteCode, setInviteCode] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)

    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const { handleNext } = useSetupFlow()
    const dispatch = useAppDispatch()

    const validateInviteCode = async (inviteCode: string): Promise<boolean> => {
        setisLoading(true)
        const res = await invitesApi.validateInviteCode(inviteCode)
        setisLoading(false)
        return res
    }

    const handleError = (error: any) => {
        const errorMessage =
            error.code === 'LOGIN_CANCELED'
                ? 'Login was canceled. Please try again.'
                : error.code === 'NO_PASSKEY'
                  ? 'No passkey found. Please create a wallet first.'
                  : 'An unexpected error occurred during login.'
        toast.error(errorMessage)
        Sentry.captureException(error, { extra: { errorCode: error.code } })
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <ValidatedInput
                    placeholder="Enter an invite code"
                    value={inviteCode}
                    debounceTime={750}
                    validate={validateInviteCode}
                    onUpdate={({ value, isValid, isChanging }) => {
                        setIsValid(isValid)
                        setIsChanging(isChanging)
                        setInviteCode(value)
                    }}
                    isSetupFlow
                    isInputChanging={isChanging}
                    className={twMerge(
                        !isValid && !isChanging && !!inviteCode && 'border-error dark:border-error',
                        isValid && !isChanging && !!inviteCode && 'border-secondary-8 dark:border-secondary-8',
                        'rounded-sm'
                    )}
                />
                <Button
                    className="h-12 w-4/12"
                    loading={isLoading}
                    shadowSize="4"
                    onClick={() => {
                        dispatch(setupActions.setInviteCode(inviteCode))
                        handleNext()
                    }}
                    disabled={!isValid || isChanging || isLoading}
                >
                    Next
                </Button>
            </div>

            {!isValid && (
                <Button onClick={() => handleNext()} shadowSize="4">
                    Join Waitlist
                </Button>
            )}

            <button
                disabled={isLoggingIn}
                onClick={() => {
                    handleLogin().catch((e) => {
                        handleError(e)
                    })
                }}
                className="text-sm underline"
            >
                {isLoggingIn ? 'Please wait..' : 'Already have an account? Log in!'}
            </button>
        </div>
    )
}

export default JoinWaitlist
