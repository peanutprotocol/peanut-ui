import { Button } from '@/components/0_Bruddle'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAppDispatch } from '@/redux/hooks'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces'
import { useState, useEffect } from 'react'
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem'
import { PEANUT_WALLET_TOKEN, PEANUT_WALLET_CHAIN } from '@/constants'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import * as Sentry from '@sentry/nextjs'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'

const SignTestTransaction = () => {
    const router = useRouter()
    const dispatch = useAppDispatch()
    const { address, handleSendUserOpEncoded } = useZeroDev()
    const { finalizeAccountSetup, isProcessing, error: setupError } = useAccountSetup()
    const { user, isFetchingUser, fetchUser } = useAuth()
    const [error, setError] = useState<string | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [testTransactionCompleted, setTestTransactionCompleted] = useState(false)

    // ensure user is fetched when component mounts (important for new signups)
    useEffect(() => {
        console.log('[SignTestTransaction] Component mounted, user state:', {
            hasUser: !!user,
            isFetchingUser,
            userId: user?.user?.userId,
        })

        if (!user && !isFetchingUser) {
            console.log('[SignTestTransaction] User not loaded, fetching user data')
            fetchUser().catch((err) => {
                console.error('[SignTestTransaction] Failed to fetch user:', err)
                Sentry.captureException(err, {
                    tags: { feature: 'signup-test-transaction' },
                    extra: { context: 'user-fetch-on-mount' },
                })
                setError('Failed to load user data. Please refresh the page.')
            })
        } else if (user) {
            console.log('[SignTestTransaction] User loaded successfully:', {
                userId: user.user.userId,
                username: user.user.username,
                accountCount: user.accounts.length,
            })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, isFetchingUser])

    // check if account already exists (for login flow)
    const accountExists = user?.accounts.some((a) => a.type === AccountType.PEANUT_WALLET)

    useEffect(() => {
        if (accountExists) {
            console.log('[SignTestTransaction] Account exists, redirecting to home')
            router.push('/home')
        }
    }, [accountExists, router])

    const handleTestTransaction = async () => {
        if (!address) {
            setError('No wallet address found. Please try refreshing the page.')
            return
        }

        if (!user) {
            console.error('[SignTestTransaction] Cannot proceed without user data')
            setError('User data not loaded. Please refresh the page.')
            return
        }

        console.log('[SignTestTransaction] Starting test transaction flow', {
            address,
            accountExists,
            userId: user.user.userId,
            testTransactionCompleted,
        })
        setIsSigning(true)
        setError(null)
        dispatch(setupActions.setLoading(true))

        try {
            // if test transaction already completed, skip signing and go straight to account creation
            if (!testTransactionCompleted) {
                // create a 0 amount erc20 transfer transaction to test passkey signing
                console.log('[SignTestTransaction] Encoding test transaction data')
                const txData = encodeFunctionData({
                    abi: erc20Abi,
                    functionName: 'transfer',
                    args: [address as Address, 0n], // transfer 0 tokens to self
                }) as Hex

                const params = [
                    {
                        to: PEANUT_WALLET_TOKEN as Hex,
                        value: 0n,
                        data: txData,
                    },
                ]

                // attempt to sign and send the test transaction
                console.log('[SignTestTransaction] Requesting user to sign transaction')
                const result = await handleSendUserOpEncoded(params, PEANUT_WALLET_CHAIN.id.toString())
                console.log('[SignTestTransaction] Transaction signed successfully', {
                    userOpHash: result.userOpHash,
                })
                setTestTransactionCompleted(true)
            } else {
                console.log('[SignTestTransaction] Test transaction already completed, retrying account creation')
            }

            // if successful and account doesn't exist, finalize account setup
            if (!accountExists) {
                console.log('[SignTestTransaction] Finalizing account setup')
                const success = await finalizeAccountSetup(address)
                if (!success) {
                    console.error('[SignTestTransaction] Failed to finalize account setup')
                    setError(
                        setupError || 'Failed to complete account setup. Please try again by clicking the button below.'
                    )
                    setIsSigning(false)
                    dispatch(setupActions.setLoading(false))
                    return
                }

                // account setup complete - addAccount() already fetched and verified user data
                console.log('[SignTestTransaction] Account setup complete, redirecting to home')
                router.push('/home')
                // keep loading state active until redirect completes
            } else {
                // if account already exists, just navigate home (login flow)
                console.log('[SignTestTransaction] Account exists, redirecting to home')
                router.push('/home')
                // keep loading state active until redirect completes
            }
        } catch (e) {
            console.error('[SignTestTransaction] Test transaction failed:', e)

            // capture comprehensive debug info for troubleshooting
            await capturePasskeyDebugInfo('test-transaction-failed')

            // capture the error with additional context
            Sentry.captureException(e, {
                extra: {
                    address,
                    accountExists,
                    testTransactionCompleted,
                    errorMessage: (e as Error).message,
                    errorName: (e as Error).name,
                },
            })

            setError(
                "We're having trouble setting up your account. Our team has been notified. Please contact support for help."
            )
            setIsSigning(false)
            dispatch(setupActions.setLoading(false))
        }
    }

    const isLoading = isSigning || isProcessing || isFetchingUser
    const isDisabled = isLoading || !user
    const displayError = error || setupError

    // determine button text based on state
    const getButtonText = () => {
        if (isFetchingUser) return 'Loading...'
        if (testTransactionCompleted && displayError) return 'Retry account setup'
        return 'Sign test transaction'
    }

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-11 p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2 text-center">
                    <Button
                        loading={isLoading}
                        disabled={isDisabled}
                        onClick={handleTestTransaction}
                        className="text-nowrap"
                        shadowSize="4"
                    >
                        {getButtonText()}
                    </Button>
                    {displayError && <p className="text-sm font-bold text-error">{displayError}</p>}
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

export const PasskeyDocsLink = ({ className }: { className?: string }) => {
    return (
        <p className={twMerge('border-t border-grey-1 pt-2 text-center text-xs text-grey-1', className)}>
            <Link
                rel="noopener noreferrer"
                target="_blank"
                className="underline underline-offset-2"
                href="https://docs.peanut.me/passkeys"
            >
                Learn more about what Passkeys are
            </Link>{' '}
        </p>
    )
}

export default SignTestTransaction
