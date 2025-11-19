import { Button } from '@/components/0_Bruddle'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAuth } from '@/context/authContext'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { WebAuthnError } from '@simplewebauthn/browser'
import Link from 'next/link'
import { clearAuthState, withWebAuthnRetry, getWebAuthnErrorMessage } from '@/utils'

const SetupPasskey = () => {
    const dispatch = useAppDispatch()
    const { username } = useSetupStore()
    const { isLoading, handleNext } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { user } = useAuth()
    const { deviceType } = useDeviceType()
    const [error, setError] = useState<string | null>(null)

    // once passkey is registered successfully, move to test transaction step
    useEffect(() => {
        if (address) {
            handleNext()
        }
    }, [address, handleNext])

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-11 p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2 text-center">
                    <Button
                        loading={isLoading}
                        disabled={isLoading}
                        onClick={async () => {
                            dispatch(setupActions.setLoading(true))
                            try {
                                // use retry wrapper for transient errors (NotReadableError, etc.)
                                await withWebAuthnRetry(() => handleRegister(username), 'passkey-registration')
                            } catch (e) {
                                if (e instanceof WebAuthnError) {
                                    // webauthn errors: no state was saved yet (state only saved after success)
                                    // user can safely retry without losing username/setup progress
                                    setError(getWebAuthnErrorMessage(e, deviceType))
                                } else {
                                    // network/backend errors: might have partial state, clear it
                                    clearAuthState(user?.user.userId)
                                    const error = e as Error
                                    setError(
                                        error.name
                                            ? getWebAuthnErrorMessage(error, deviceType)
                                            : 'Error registering passkey. Please try again.'
                                    )
                                }
                                console.error('Error registering passkey:', e)
                                Sentry.captureException(e)
                                dispatch(setupActions.setLoading(false))
                            }
                        }}
                        className="text-nowrap"
                        shadowSize="4"
                    >
                        Set it up
                    </Button>
                    {error && <p className="text-sm font-bold text-error">{error}</p>}
                </div>
                <div>
                    <p className="border-t border-grey-1 pt-2 text-center text-xs text-grey-1">
                        <Link
                            rel="noopener noreferrer"
                            target="_blank"
                            className="underline underline-offset-2"
                            href="https://docs.peanut.me/passkeys"
                        >
                            Learn more about what Passkeys are
                        </Link>{' '}
                    </p>
                </div>
            </div>
        </div>
    )
}

export default SetupPasskey
