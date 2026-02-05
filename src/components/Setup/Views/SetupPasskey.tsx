import { Button } from '@/components/0_Bruddle/Button'
import { useSetupStore } from '@/redux/hooks'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useDeviceType } from '@/hooks/useGetDeviceType'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import { checkPasskeySupport } from '@/utils/passkeyPreflight'
import { WebAuthnErrorName, withWebAuthnRetry } from '@/utils/webauthn.utils'
import { PasskeySetupHelpModal } from './PasskeySetupHelpModal'
import ErrorAlert from '@/components/Global/ErrorAlert'
import * as Sentry from '@sentry/nextjs'

const SetupPasskey = () => {
    const { username } = useSetupStore()
    const { isLoading, handleNext } = useSetupFlow()
    const { handleRegister, address, isRegistering } = useZeroDev()
    const { deviceType } = useDeviceType()
    const [errorName, setErrorName] = useState<string | null>(null)
    const [showErrorModal, setShowErrorModal] = useState(false)
    const [preflightWarning, setPreflightWarning] = useState<string | null>(null)
    const [inlineError, setInlineError] = useState<string | null>(null)

    // preflight check for common passkey issues
    useEffect(() => {
        const runPreflightCheck = async () => {
            const result = await checkPasskeySupport()
            if (!result.isSupported && result.warning) {
                setPreflightWarning(result.warning)
            }
        }

        runPreflightCheck()
    }, [])

    // handle passkey registration with retry logic
    const handlePasskeySetup = async () => {
        // clear any previous inline errors
        setInlineError(null)
        setErrorName(null)
        //capturePasskeyDebugInfo('passkey-registration-started')

        try {
            await withWebAuthnRetry(() => handleRegister(username), 'passkey-registration')
            // success - useEffect below will handle navigation
        } catch (error) {
            const err = error as Error
            console.error('Passkey registration failed:', err)

            // capture debug info for all failures
            await capturePasskeyDebugInfo('passkey-registration-failed')

            // notallowederror can mean two things:
            // 1. user actually cancelled (most common)
            // 2. browser blocked it (incognito, privacy settings, etc)
            if (err.name === WebAuthnErrorName.NotAllowed) {
                // check if this might be a browser block vs user cancellation
                // if localStorage is blocked or cookies disabled, likely in private mode
                const isProbablyPrivateMode = (() => {
                    try {
                        localStorage.setItem('test', 'test')
                        localStorage.removeItem('test')
                        return false // localStorage works, probably not private mode
                    } catch {
                        return true // localStorage blocked, likely private mode
                    }
                })()

                if (isProbablyPrivateMode) {
                    // browser blocking - show help modal with troubleshooting
                    console.log('[SetupPasskey] Private mode detected, showing help modal')
                    setErrorName(WebAuthnErrorName.NotAllowed)
                    setShowErrorModal(true)
                } else {
                    // likely user cancellation - show simple inline error
                    console.log('[SetupPasskey] User likely cancelled, showing inline error')
                    setInlineError('Passkey setup was cancelled. Please try again when ready.')
                }
                return
            }

            // device/system issues - show detailed help modal with troubleshooting steps
            if (
                [
                    WebAuthnErrorName.NotReadable,
                    WebAuthnErrorName.InvalidState,
                    WebAuthnErrorName.NotSupported,
                ].includes(err.name as WebAuthnErrorName)
            ) {
                setErrorName(err.name)
                setShowErrorModal(true)
            } else {
                // unexpected error - show generic message and log to sentry
                Sentry.captureException(error, {
                    tags: { error_type: 'passkey_setup_error' },
                    extra: { errorName: err.name, deviceType },
                })
                setErrorName('UnknownError')
                setShowErrorModal(true)
            }
        }
    }

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
                        loading={isRegistering || isLoading}
                        disabled={isRegistering || isLoading || !!preflightWarning}
                        onClick={handlePasskeySetup}
                        className="text-nowrap"
                        shadowSize="4"
                    >
                        Set it up
                    </Button>
                    {preflightWarning && <p className="text-sm font-bold text-orange-1">{preflightWarning}</p>}
                    {inlineError && <ErrorAlert description={inlineError} />}
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

            {/* help modal for passkey setup issues */}
            {errorName && (
                <PasskeySetupHelpModal
                    visible={showErrorModal}
                    onClose={() => setShowErrorModal(false)}
                    onRetry={() => {
                        setShowErrorModal(false)
                        handlePasskeySetup()
                    }}
                    errorName={errorName}
                    platform={deviceType}
                />
            )}
        </div>
    )
}

export default SetupPasskey
