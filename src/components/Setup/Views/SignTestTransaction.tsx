import DocsLink from '@/components/Global/DocsLink'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import PasskeyInfoDrawer from '@/components/Setup/components/PasskeyInfoDrawer'
import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { useSetupFlowContext } from '@/features/setup/SetupFlowContext'
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
import { signupAnalyticsContext } from '@/features/setup/signup-analytics'

export function AccountReadyView({
    onContinue,
    isRedirecting = false,
}: {
    onContinue: () => void
    isRedirecting?: boolean
}) {
    const t = useTranslations('setup')
    return (
        <div className="flex w-full flex-col gap-4 text-left">
            {/* Neither block is a warning or caveat, so keep them as plain
                text under grey mini-headers rather than tinted notifications. */}
            <div className="flex flex-col gap-1">
                <MiniHeader>{t('accountReady.worksNowTitle')}</MiniHeader>
                <p className="text-body-s text-foreground-primary">{t('accountReady.worksNowBody')}</p>
            </div>
            <div className="flex flex-col gap-1">
                <MiniHeader>{t('accountReady.laterTitle')}</MiniHeader>
                <p className="text-body-s text-foreground-primary">{t('accountReady.laterBody')}</p>
            </div>
            <Button
                onClick={onContinue}
                loading={isRedirecting}
                disabled={isRedirecting}
                shadowSize="4"
                className="mt-2"
            >
                {t('accountReady.cta')}
            </Button>
        </div>
    )
}

const SignTestTransaction = () => {
    const t = useTranslations('setup')
    const tCommon = useTranslations('common')
    const { address, handleSendUserOpEncoded } = useZeroDev()
    const { finalizeAccountSetup, isProcessing, error: setupError, handleRedirect } = useAccountSetup()
    const { user, isFetchingUser, fetchUser } = useAuth()
    const {
        residenceCountry,
        secondResidenceCountry,
        setIsLoading: setSetupLoading,
        signupEntryFlow,
    } = useSetupFlowContext()
    const [error, setError] = useState<string | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [testTransactionCompleted, setTestTransactionCompleted] = useState(false)
    const [isPasskeyInfoOpen, setIsPasskeyInfoOpen] = useState(false)
    const creatingAccountRef = useRef(false)
    /*
     * handleRedirect CONSUMES the stored post-auth route, so it must fire once.
     * A second caller would find nothing stored, fall back to /home and race
     * the first redirect — a signup entered from /receipt would land on /home.
     */
    const redirectingRef = useRef(false)

    const redirectToAccount = () => {
        if (redirectingRef.current) return
        redirectingRef.current = true
        // This terminal path only runs for an account created in this session,
        // so it inherits no earlier session's page — only a deep link the
        // person themselves asked for.
        handleRedirect({ isNewAccount: true })
    }

    const completeSignup = () => {
        creatingAccountRef.current = false
        console.log('[SignTestTransaction] Account setup complete')
        const inviteCode = getFromCookie('inviteCode')
        posthog.capture(ANALYTICS_EVENTS.SIGNUP_COMPLETED, {
            acquisition_source: inviteCode ? 'referred' : 'organic',
            invite_code: inviteCode || undefined,
            ...signupAnalyticsContext(signupEntryFlow),
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

        // Completion is terminal for this screen. Keep both loading states
        // active until navigation unmounts it so a slow route transition
        // cannot expose a second completion attempt.
        redirectToAccount()
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
        // straight in. Signup completion owns its own redirect, guarded so the
        // account refetch cannot consume the stored destination a second time.
        if (creatingAccountRef.current || redirectingRef.current) return
        if (accountExists) {
            console.log('[SignTestTransaction] Account exists, redirecting to the app')
            handleRedirect()
        }
    }, [accountExists])

    const handleTestTransaction = async () => {
        if (redirectingRef.current) return

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
        setSetupLoading(true)
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
                    // The request layer already recorded the concrete failure;
                    // avoid another console-captured wrapper event here.
                    console.info('[SignTestTransaction] Account setup remains retryable')
                    setError(setupError || t('testTransaction.errors.setupFailed'))
                    setIsSigning(false)
                    setSetupLoading(false)
                    return
                }

                // addAccount() already fetched and verified user data.
                completeSignup()
            } else {
                if (creatingAccountRef.current) {
                    // A prior ambiguous request can commit after both immediate
                    // profile reconciliations fail. Retry consumes that signup
                    // marker and presents the same success state as the direct
                    // response instead of leaving the button loading forever.
                    console.log('[SignTestTransaction] Reconciled account from an earlier setup request')
                    completeSignup()
                } else {
                    // Login flow: the account-exists effect owns navigation.
                    console.log('[SignTestTransaction] Account exists, redirecting to the app')
                    // keep loading state active until redirect completes
                }
            }
        } catch (e) {
            console.error('[SignTestTransaction] Test transaction failed:', e)

            // Browser capability probes must not delay recovery from a failed signature.
            void capturePasskeyDebugInfo('test-transaction-failed').catch((debugError) => {
                console.warn('[SignTestTransaction] Diagnostics failed:', debugError)
            })

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
            setSetupLoading(false)
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

    return (
        <div>
            <div className="flex h-full flex-col justify-between gap-6 p-0 md:min-h-32">
                <div className="flex h-full flex-col justify-end gap-2">
                    <p className="mb-1 text-body-s text-foreground-secondary">
                        {t('steps.sign-test-transaction.description')}
                    </p>
                    {displayError && <Callout priority="error">{displayError}</Callout>}
                    <Button
                        loading={isLoading}
                        disabled={isDisabled}
                        onClick={handleTestTransaction}
                        className="text-nowrap"
                        shadowSize="4"
                    >
                        {getButtonText()}
                    </Button>
                </div>
                <div>
                    {/* In-app explainer instead of a browser redirect — leaving
                        the app mid-signup loses users (full guide inside). */}
                    <p className="border-t border-border-subtle pt-2 text-center text-body-xs text-foreground-secondary">
                        <LinkButton onClick={() => setIsPasskeyInfoOpen(true)}>{t('passkey.learnMore')}</LinkButton>
                    </p>
                </div>
            </div>
            <PasskeyInfoDrawer visible={isPasskeyInfoOpen} onClose={() => setIsPasskeyInfoOpen(false)} />
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
