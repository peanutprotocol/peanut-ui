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
import { useRouter, useSearchParams } from 'next/navigation'
import { getFromLocalStorage, sanitizeRedirectURL } from '@/utils'
import ErrorAlert from '@/components/Global/ErrorAlert'

const JoinWaitlist = () => {
    const [inviteCode, setInviteCode] = useState('')
    const [isValid, setIsValid] = useState(false)
    const [isChanging, setIsChanging] = useState(false)
    const [isLoading, setisLoading] = useState(false)
    const [error, setError] = useState('')

    const { handleLogin, isLoggingIn } = useZeroDev()
    const toast = useToast()
    const { handleNext } = useSetupFlow()
    const dispatch = useAppDispatch()
    const router = useRouter()
    const searchParams = useSearchParams()

    const validateInviteCode = async (inviteCode: string): Promise<boolean> => {
        try {
            setError('')
            setisLoading(true)
            const res = await invitesApi.validateInviteCode(inviteCode)
            const isValid = res.success
            if (!isValid) {
                setError('Invalid invite code')
            }
            return isValid
        } catch (e) {
            setError('Invalid invite code')
            return false
        } finally {
            setisLoading(false)
        }
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

    const onLoginClick = async () => {
        try {
            await handleLogin()
            const localStorageRedirect = getFromLocalStorage('redirect')
            const redirect_uri = searchParams.get('redirect_uri')
            if (redirect_uri) {
                let decodedRedirect = redirect_uri
                try {
                    decodedRedirect = decodeURIComponent(redirect_uri)
                } catch {}
                const sanitizedRedirectUrl = sanitizeRedirectURL(decodedRedirect)
                router.push(sanitizedRedirectUrl)
            } else if (localStorageRedirect) {
                localStorage.removeItem('redirect')
                router.push(localStorageRedirect)
            } else {
                router.push('/home')
            }
        } catch (e) {
            handleError(e)
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <ValidatedInput
                    placeholder="Do you have an invite code?"
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
            </div>

            {error && (
                <div className="pb-1">
                    <ErrorAlert description={error} className="gap-2 text-xs" iconSize={14} />
                </div>
            )}

            <Button
                disabled={(inviteCode.length !== 0 && !!error) || isLoading}
                onClick={() => {
                    if (inviteCode.length !== 0) {
                        dispatch(setupActions.setInviteCode(inviteCode))
                    }

                    handleNext()
                }}
                shadowSize="4"
            >
                {inviteCode.length > 0 ? 'Claim your spot' : 'Join Waitlist'}
            </Button>

            <button disabled={isLoggingIn} onClick={onLoginClick} className="text-sm underline">
                {isLoggingIn ? 'Please wait..' : 'Already have an account? Log in!'}
            </button>
        </div>
    )
}

export default JoinWaitlist
