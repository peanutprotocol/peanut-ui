import DocsLink from '@/components/Global/DocsLink'
import PasskeyInfoModal from '@/components/Setup/components/PasskeyInfoModal'
import { Button } from '@/components/0_Bruddle/Button'
import { Notification } from '@/components/0_Bruddle/Notification'
import { setupActions } from '@/redux/slices/setup-slice'
import { useAppDispatch, useSetupStore } from '@/redux/hooks'
import { updateUserById } from '@/app/actions/users'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useAccountSetup } from '@/hooks/useAccountSetup'
import { useAuth } from '@/context/authContext'
import { AccountType } from '@/interfaces/interfaces'
import { useState, useEffect, useRef } from 'react'
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { capturePasskeyDebugInfo } from '@/utils/passkeyDebug'
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'
import { storeDeclaredResidence, storeSecondResidence } from '@/utils/declared-residence.storage'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { getFromCookie } from '@/utils/general.utils'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'

const SignTestTransaction = () => {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const dispatch = useAppDispatch()
    const { address, handleSendUserOpEncoded } = useZeroDev()
    const { finalizeAccountSetup, isProcessing, error: setupError, handleRedirect } = useAccountSetup()
    const { user, isFetchingUser, fetchUser } = useAuth()
    const { residenceCountry, secondResidenceCountry } = useSetupStore()
    const [error, setError] = useState<string | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [testTransactionCompleted, setTestTransactionCompleted] = useState(false)
    const [isPasskeyInfoOpen, setIsPasskeyInfoOpen] = useState(false)
    // Fresh signups pause on the account-ready screen instead of auto-redirecting;
    // the ref (not state) guards the redirect effect against firing during the
    // re-render window between account creation and the state update below.
    const [accountReady, setAccountReady] = useState(false)
    const creatingAccountRef = useRef(false)
    /*
     * handleRedirect CONSUMES the stored post-auth route, so it must fire once.
     * A second tap would find nothing stored, fall back to /home and race the
     * first push — a signup entered from /receipt would land on /home. The ref
     * is the guard (state is async, so a same-tick double tap would pass it);
     * the state only drives the button's disabled/loading affordance.
     */
    const redirectingRef = useRef(false)
    const [isRedirecting, setIsRedirecting] = useState(false)

    const goToAccount = () => {
        if (redirectingRef.current) return
        redirectingRef.current = true
        setIsRedirecting(true)
        handleRedirect()
    }

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
                setError(t('testTransaction.errors.loadUserFailed'))
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
        // Login flow only: an account that existed before this screen redirects
        // straight in. A signup that just created its account stays for the
        // account-ready screen and redirects from its CTA instead — nothing may
        // navigate off that screen on its own, so it is a hard guard here and
        // not only the creating-account ref.
        if (accountReady || creatingAccountRef.current) return
        if (accountExists) {
            console.log('[SignTestTransaction] Account exists, redirecting to the app')
            handleRedirect()
        }
    }, [accountExists, accountReady])

    const handleTestTransaction = async () => {
        if (!address) {
            setError(t('testTransaction.errors.noWalletAddress'))
            return
        }

        if (!user) {
            console.error('[SignTestTransaction] Cannot proceed without user data')
            setError(t('testTransaction.errors.userNotLoaded'))
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
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_STARTED)

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
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_SIGNED)
                setTestTransactionCompleted(true)
            } else {
                console.log('[SignTestTransaction] Test transaction already completed, retrying account creation')
            }

            // if successful and account doesn't exist, finalize account setup
            if (!accountExists) {
                console.log('[SignTestTransaction] Finalizing account setup')
                creatingAccountRef.current = true
                const success = await finalizeAccountSetup(address)
                if (!success) {
                    console.error('[SignTestTransaction] Failed to finalize account setup')
                    setError(setupError || t('testTransaction.errors.setupFailed'))
                    setIsSigning(false)
                    dispatch(setupActions.setLoading(false))
                    return
                }

                // account setup complete - addAccount() already fetched and verified user data
                console.log('[SignTestTransaction] Account setup complete, showing the account-ready screen')
                const inviteCode = getFromCookie('inviteCode')
                posthog.capture(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
                    acquisition_source: inviteCode ? 'referred' : 'organic',
                    invite_code: inviteCode || undefined,
                })

                // Persist the residence answer from the residence step, now that
                // the account exists. Fire-and-forget: prequalification data,
                // never a reason to fail or delay the redirect.
                if (residenceCountry) {
                    posthog.setPersonProperties({
                        residence_country: residenceCountry,
                        second_residence_country: secondResidenceCountry || undefined,
                    })
                    const userId = user?.user?.userId
                    if (userId) {
                        storeDeclaredResidence(userId, residenceCountry)
                        storeSecondResidence(userId, secondResidenceCountry || null)
                        void updateUserById({
                            userId,
                            residenceCountry,
                            ...(secondResidenceCountry ? { secondResidenceCountry } : {}),
                        })
                            .then((result) => {
                                // updateUserById maps API failures to { error },
                                // it doesn't throw them — inspect the result.
                                if (result?.error) {
                                    console.error('[SignTestTransaction] Failed to persist residence:', result.error)
                                }
                            })
                            .catch((err: unknown) => {
                                console.error('[SignTestTransaction] Failed to persist residence:', err)
                            })
                    }
                }

                // The finish line does two jobs: celebrate what already works
                // without ID, and plant the honest KYC expectation before home
                // ever asks. The redirect moves to its CTA.
                setIsSigning(false)
                dispatch(setupActions.setLoading(false))
                setAccountReady(true)
            } else {
                // if account already exists, just navigate home (login flow)
                console.log('[SignTestTransaction] Account exists, redirecting to the app')
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

            posthog.capture(ANALYTICS_EVENTS.SIGNUP_TEST_TX_FAILED, { error_name: (e as Error).name })
            setError(t('testTransaction.errors.supportNeeded'))
            setIsSigning(false)
            dispatch(setupActions.setLoading(false))
        }
    }

    const isLoading = isSigning || isProcessing || isFetchingUser || !user
    const isDisabled = isLoading
    const displayError = error || setupError

    // determine button text based on state
    const getButtonText = () => {
        if (isFetchingUser || !user) return tCommon('loading')
        if (testTransactionCompleted && displayError) return t('testTransaction.retryAccountSetup')
        return t('testTransaction.confirmAndFinish')
    }

    if (accountReady) {
        return (
            <div className="flex w-full flex-col gap-3 text-left">
                <div className="rounded-sm border border-border-default bg-background-default p-4">
                    <p className="text-heading-card">{t('accountReady.worksNowTitle')}</p>
                    <p className="text-body-m">{t('accountReady.worksNowBody')}</p>
                </div>
                <div className="rounded-sm border border-border-default bg-background-default p-4">
                    <p className="text-heading-card">{t('accountReady.laterTitle')}</p>
                    <p className="text-body-m">{t('accountReady.laterBody')}</p>
                </div>
                <Button onClick={goToAccount} loading={isRedirecting} disabled={isRedirecting} shadowSize="4">
                    {t('accountReady.cta')}
                </Button>
            </div>
        )
    }

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-6 p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2">
                    {/* Rendered here, not by the step chrome, so the account-ready
                        state doesn't repeat it (descriptionInView on the step). */}
                    <p className="mb-1 text-body-s text-foreground-secondary">
                        {t('steps.sign-test-transaction.description')}
                    </p>
                    <Button
                        loading={isLoading}
                        disabled={isDisabled}
                        onClick={handleTestTransaction}
                        className="text-nowrap"
                        shadowSize="4"
                    >
                        {getButtonText()}
                    </Button>
                    {displayError && <Notification priority="error">{displayError}</Notification>}
                </div>
                <div>
                    {/* In-app explainer instead of a browser redirect — leaving
                        the app mid-signup loses users (full guide inside). */}
                    <p className="border-t border-border-subtle pt-2 text-center text-body-xs text-foreground-secondary">
                        <button
                            type="button"
                            // after: pseudo-element extends the text row to a 44px hit area (LinkButton pattern)
                            className="relative underline underline-offset-2 after:absolute after:inset-x-0 after:-inset-y-3.5 focus-visible:outline-[3px] focus-visible:outline-action-focus"
                            onClick={() => setIsPasskeyInfoOpen(true)}
                        >
                            {t('passkey.learnMore')}
                        </button>
                    </p>
                </div>
            </div>
            <PasskeyInfoModal visible={isPasskeyInfoOpen} onClose={() => setIsPasskeyInfoOpen(false)} />
        </div>
    )
}

export const PasskeyDocsLink = ({ className }: { className?: string }) => {
    const t = useTranslations('setup')
    return (
        <p
            // ds text tokens stay outside twMerge — unconfigured twMerge groups
            // them as colors and deletes the size (see LinkButton.tsx:40)
            className={`text-body-xs text-foreground-secondary ${twMerge('border-t border-border-subtle pt-2 text-center', className)}`}
        >
            <DocsLink href="/en/help/passkeys" className="underline underline-offset-2">
                {t('passkey.learnMore')}
            </DocsLink>{' '}
        </p>
    )
}

export default SignTestTransaction
