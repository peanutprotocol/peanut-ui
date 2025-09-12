import { Button } from '@/components/0_Bruddle'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useSetupFlow } from '@/hooks/useSetupFlow'
import { useAuth } from '@/context/authContext'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { WalletProviderType, AccountType } from '@/interfaces'
import { WebAuthnError } from '@simplewebauthn/browser'
import Link from 'next/link'
import { getFromLocalStorage, sanitizeRedirectURL } from '@/utils'
import { POST_SIGNUP_ACTIONS } from '@/components/Global/PostSignupActionManager/post-signup-action.consts'

const SetupPasskey = () => {
    const dispatch = useAppDispatch()
    const { username, telegramHandle } = useSetupStore()
    const { isLoading } = useSetupFlow()
    const { handleRegister, address } = useZeroDev()
    const { user, isFetchingUser } = useAuth()
    const { addAccount } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

    useEffect(() => {
        // Dont try to double add the account
        if (isFetchingUser || user?.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)) return
        if (address && user) {
            addAccount({
                accountIdentifier: address,
                accountType: WalletProviderType.PEANUT,
                userId: user?.user.userId as string,
                telegramHandle: telegramHandle.length > 0 ? telegramHandle : undefined,
            })
                .then(() => {
                    const redirect_uri = searchParams.get('redirect_uri')
                    if (redirect_uri) {
                        const sanitizedRedirectUrl = sanitizeRedirectURL(redirect_uri)
                        router.push(sanitizedRedirectUrl)
                        return
                    }

                    const localStorageRedirect = getFromLocalStorage('redirect')
                    // redirect based on post signup action config
                    if (localStorageRedirect) {
                        const matchedAction = POST_SIGNUP_ACTIONS.find((action) =>
                            action.pathPattern.test(localStorageRedirect)
                        )
                        if (matchedAction) {
                            router.push('/home')
                        } else {
                            localStorage.removeItem('redirect')
                            router.push(localStorageRedirect)
                        }
                    } else {
                        router.push('/home')
                    }
                })
                .catch((e) => {
                    Sentry.captureException(e)
                    console.error('Error adding account', e)
                    setError('Error adding account')
                })
                .finally(() => {
                    dispatch(setupActions.setLoading(false))
                })
        }
    }, [address, user, isFetchingUser])

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-11 p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2 text-center">
                    <Button
                        loading={isLoading || isFetchingUser}
                        disabled={isLoading || isFetchingUser}
                        onClick={async () => {
                            dispatch(setupActions.setLoading(true))
                            try {
                                await handleRegister(username)
                            } catch (e) {
                                if (e instanceof WebAuthnError) {
                                    // https://github.com/MasterKale/SimpleWebAuthn/blob/master/packages/browser/src/helpers/identifyRegistrationError.ts
                                    if (
                                        e.message.includes('timed out or was not allowed') ||
                                        e.message.includes('denied permission')
                                    ) {
                                        setError('Passkey registration timed out or cancelled. Please try again.')
                                        dispatch(setupActions.setLoading(false))
                                        return
                                    } else {
                                        setError(e.message)
                                    }
                                } else {
                                    setError('Error registering passkey.')
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
