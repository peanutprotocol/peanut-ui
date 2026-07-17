'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/zerodev.consts'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { getCountryFromAccount, getCountryFromPath, getMinimumAmount } from '@/utils/bridge.utils'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces/interfaces'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState, useRef, useContext } from 'react'
import { formatUnits } from 'viem'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { withdrawBankUrl, withdrawCountryUrl } from '@/utils/native-routes'
import { useTranslations } from 'next-intl'

type WithdrawStep = 'inputAmount' | 'selectMethod'

export default function WithdrawPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const t = useTranslations('withdraw')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const tErrors = useTranslations('errors')
    const { selectedTokenData } = useContext(tokenSelectorContext)

    // check if coming from send flow based on method query param
    const methodParam = searchParams.get('method')
    const isFromSendFlow = !!(methodParam && ['bank', 'crypto'].includes(methodParam))
    const isCryptoFromSend = methodParam === 'crypto' && isFromSendFlow
    const isBankFromSend = methodParam === 'bank' && isFromSendFlow

    // native app passes country as query param instead of path segment
    const countryFromQuery = searchParams.get('country')

    const {
        amountToWithdraw: amountFromContext,
        setAmountToWithdraw,
        setError,
        error,
        setUsdAmount,
        selectedMethod,
        selectedBankAccount,
        setSelectedBankAccount,
        setSelectedMethod,
        setShowAllWithdrawMethods,
    } = useWithdrawFlow()

    // only go to input amount if method is selected OR if it's crypto from send (bank needs method selection first)
    const initialStep: WithdrawStep = selectedMethod || isCryptoFromSend ? 'inputAmount' : 'selectMethod'

    const [step, setStep] = useState<WithdrawStep>(initialStep)

    // automatically set crypto method when coming from send flow with method=crypto
    useEffect(() => {
        if (isCryptoFromSend && !selectedMethod) {
            setSelectedMethod({
                type: 'crypto',
                title: 'Crypto',
                countryPath: undefined,
            })
        } else if (isBankFromSend && !selectedMethod) {
            // for bank from send flow, prefer showing saved accounts first
            setShowAllWithdrawMethods(false)
        }
    }, [isCryptoFromSend, isBankFromSend, selectedMethod, setSelectedMethod, setShowAllWithdrawMethods])

    // flag to know if user has manually entered something
    const userTypedRef = useRef<boolean>(false)

    // initialise the amount input with the value from context (if any)
    // state to keep track of the token input key to force-remount the component
    const [_tokenInputKey, setTokenInputKey] = useState<number>(0)

    // raw amount currently typed in the input
    const [rawTokenAmount, setRawTokenAmount] = useState<string>(amountFromContext || '')

    const { spendableBalance: balance, formattedSpendableBalance } = useWallet()

    // Spend ceiling = the displayed total spendable. We gate on display (not an
    // available-now subset) so we never block funds the live withdraw could route;
    // an in-transit shortfall fails late with a settling message. See useWallet.
    const maxDecimalAmount = useMemo(() => {
        return balance !== undefined ? Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : 0
    }, [balance])

    // Displayed total spendable (smart + collateral), single-sourced + formatted
    // by the hook. Empty while loading so we don't flash "$0.00".
    const peanutWalletBalance = useMemo(() => {
        return balance === undefined ? '' : formattedSpendableBalance
    }, [balance, formattedSpendableBalance])

    // derive country and account type for minimum amount validation
    const { countryIso2, rateAccountType } = useMemo(() => {
        if (selectedBankAccount) {
            const country = getCountryFromAccount(selectedBankAccount)
            return { countryIso2: country?.iso2 || '', rateAccountType: selectedBankAccount.type as AccountType }
        }
        if (selectedMethod?.countryPath) {
            const country = getCountryFromPath(selectedMethod.countryPath)
            const iso2 = country?.iso2 || ''
            let accountType: AccountType = AccountType.IBAN
            if (iso2 === 'US') accountType = AccountType.US
            else if (iso2 === 'GB') accountType = AccountType.GB
            else if (iso2 === 'MX') accountType = AccountType.CLABE
            return { countryIso2: iso2, rateAccountType: accountType }
        }
        return { countryIso2: '', rateAccountType: AccountType.US }
    }, [selectedBankAccount, selectedMethod])

    // crypto withdrawals are plain on-chain transfers — fiat-rail minimums don't
    // apply. selectedMethod is the routing source of truth (a stale bank method
    // from an abandoned withdraw still routes to the bank flow, so it must keep
    // its minimum); the URL param only covers the first render before the mount
    // effect commits the crypto method.
    const isCryptoWithdraw = selectedMethod ? selectedMethod.type === 'crypto' : isCryptoFromSend

    // fetch exchange rate for non-USD countries to convert local minimum to USD
    const { exchangeRate } = useGetExchangeRate({
        accountType: rateAccountType,
        enabled: !isCryptoWithdraw && rateAccountType !== AccountType.US && countryIso2 !== '',
    })

    // compute minimum withdrawal in USD using the exchange rate
    const minUsdAmount = useMemo(() => {
        if (isCryptoWithdraw) return 0 // any amount > 0 is valid, same as send-via-link
        const localMin = getMinimumAmount(countryIso2)
        // for US or unknown, minimum is already in USD
        if (!countryIso2 || countryIso2 === 'US') return localMin
        // for EUR countries, €1 ≈ $1
        if (localMin === 1) return 1
        // convert local minimum to USD: sellRate = local currency per 1 USD
        const rate = parseFloat(exchangeRate || '0')
        if (rate <= 0) return 1 // fallback while rate is loading
        return Math.ceil(localMin / rate)
    }, [isCryptoWithdraw, countryIso2, exchangeRate])

    // validate against user's limits for bank withdrawals
    // note: crypto withdrawals don't have fiat limits
    const limitsValidation = useLimitsValidation({
        flowType: 'offramp',
        amount: rawTokenAmount,
        currency: 'USD',
    })

    // clear errors and reset any persisted state when component mounts to ensure clean state
    useEffect(() => {
        setError({ showError: false, errorMessage: '' })
        // clear any potential persisted token input state by resetting to empty
        if (!amountFromContext) {
            setRawTokenAmount('')
            setTokenInputKey((k) => k + 1)
        }
    }, [setError, amountFromContext])

    useEffect(() => {
        if (selectedMethod || isCryptoFromSend) {
            setStep('inputAmount')
            if (amountFromContext && !rawTokenAmount) {
                setRawTokenAmount(amountFromContext)
            }
        } else if (!selectedMethod) {
            setStep('selectMethod')
            // clear the raw token amount when switching back to method selection
            if (step !== 'selectMethod') {
                setRawTokenAmount('')
                setTokenInputKey((k) => k + 1)
            }
        }
    }, [selectedMethod, isCryptoFromSend, amountFromContext, step, rawTokenAmount])

    useEffect(() => {
        // If amount is available (i.e) user clicked back from select method view, show all methods
        if (amountFromContext) {
            setShowAllWithdrawMethods(true)
        }
    }, [])

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            const amount = Number(amountStr)
            if (!Number.isFinite(amount) || amount <= 0) {
                setError({ showError: true, errorMessage: t('errors.invalidNumber') })
                return false
            }

            // convert the entered token amount to USD
            const price = selectedTokenData?.price ?? 0 // 0 for safety; will fail below
            const usdEquivalent = price ? amount * price : amount // if no price assume token pegged 1 USD

            // While the balance is still loading, maxDecimalAmount is 0 — skip the
            // balance check so a pre-filled amount isn't false-blocked; the effect
            // re-validates once it lands (validateAmount is in its deps).
            const balanceLoaded = balance !== undefined
            if (usdEquivalent >= minUsdAmount && (!balanceLoaded || amount <= maxDecimalAmount)) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            // determine message
            let message = ''
            if (usdEquivalent < minUsdAmount) {
                const minDisplay = minUsdAmount % 1 === 0 ? `$${minUsdAmount}` : `$${minUsdAmount.toFixed(2)}`
                message = isFromSendFlow
                    ? t('errors.minimumSend', { amount: minDisplay })
                    : t('errors.minimumWithdrawal', { amount: minDisplay })
            } else if (balanceLoaded && amount > maxDecimalAmount) {
                message = tErrors('notEnoughBalanceAddFunds')
            } else {
                message = t('errors.invalidAmount')
            }
            setError({ showError: true, errorMessage: message })
            return false
        },
        [balance, maxDecimalAmount, setError, selectedTokenData?.price, isFromSendFlow, minUsdAmount, t, tErrors]
    )

    const handleTokenAmountChange = useCallback(
        (value: string | undefined) => {
            let newValue = value || ''
            // treat leading "0" from initial AmountInput mount as empty
            if (newValue === '0') {
                newValue = ''
            }
            setRawTokenAmount(newValue)

            // ignore programmatically injected tiny residual amounts (<1) before user interaction
            const numericVal = parseFloat(newValue)
            if (!userTypedRef.current && numericVal > 0 && numericVal < 1) {
                return // do not update state at all
            }

            // mark that the user has interacted once they type anything >= 1 or delete everything
            if (newValue === '' || numericVal >= 1) {
                userTypedRef.current = true
            }

            // clear any existing errors when user starts typing
            if (error.showError) {
                setError({ showError: false, errorMessage: '' })
            }
        },
        [setRawTokenAmount, error.showError, setError]
    )

    // only validate when rawTokenAmount changes and we're in inputAmount step
    useEffect(() => {
        if (step === 'inputAmount') {
            if (rawTokenAmount === '') {
                setError({ showError: false, errorMessage: '' })
            } else {
                // add a small delay to avoid validating while user is still typing
                const timeoutId = setTimeout(() => {
                    validateAmount(rawTokenAmount)
                }, 300)

                return () => clearTimeout(timeoutId)
            }
        }
        return undefined
    }, [rawTokenAmount, validateAmount, setError, step])

    const handleAmountContinue = () => {
        if (validateAmount(rawTokenAmount) && selectedMethod) {
            setAmountToWithdraw(rawTokenAmount)
            const usdVal = (selectedTokenData?.price ?? 1) * parseFloat(rawTokenAmount)
            setUsdAmount(usdVal.toString())
            posthog.capture(ANALYTICS_EVENTS.WITHDRAW_AMOUNT_ENTERED, {
                amount_usd: usdVal,
                method_type: selectedMethod.type,
                country: selectedMethod.countryPath,
                from_send_flow: isFromSendFlow,
            })

            // Route based on selected method type (check method type first to avoid stale bank account taking priority)
            // preserve method param if coming from send flow
            const methodQueryParam = isFromSendFlow ? `method=${methodParam}` : ''

            if (selectedMethod.type === 'crypto') {
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(`/withdraw/crypto${queryParams}`)
            } else if (selectedMethod.type === 'manteca') {
                // Manteca (AR/BR) accounts route to the Manteca flow. Checked BEFORE
                // the generic saved-bank-account branch below — that branch targets
                // the Bridge bank page via getCountryFromAccount and would both
                // mis-route a Manteca account and throw when its country can't be
                // resolved. Route directly with method + country params instead.
                const mantecaMethodParam = selectedMethod.title?.toLowerCase().replace(/\s+/g, '-') || 'bank-transfer'
                const additionalParams = isFromSendFlow ? `&${methodQueryParam}` : ''
                router.push(
                    `/withdraw/manteca?method=${mantecaMethodParam}&country=${selectedMethod.countryPath}${additionalParams}`
                )
            } else if (selectedBankAccount) {
                const country = getCountryFromAccount(selectedBankAccount)
                if (country) {
                    const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                    router.push(withdrawBankUrl(country.path, queryParams))
                } else {
                    // Never throw inside the click handler: a synchronous throw aborts
                    // the router transition with no UI feedback, so the button silently
                    // dies ("press Continue, nothing happens"). Surface a recoverable
                    // error and log for observability instead.
                    console.error('[withdraw] could not resolve country from saved bank account', {
                        type: selectedBankAccount.type,
                        countryName: selectedBankAccount.details?.countryName,
                        countryCode: selectedBankAccount.details?.countryCode,
                    })
                    setError({
                        showError: true,
                        errorMessage: t('errors.countryUnresolved'),
                    })
                }
            } else if (selectedMethod.type === 'bridge' && selectedMethod.countryPath) {
                // Bridge countries go to country page for bank account form
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(withdrawCountryUrl(selectedMethod.countryPath, queryParams))
            } else if (selectedMethod.countryPath) {
                // Other countries go to their country pages
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(withdrawCountryUrl(selectedMethod.countryPath, queryParams))
            } else {
                // No branch matched the selected method — surface an error rather
                // than leaving the user with a silently-dead Continue button.
                console.error('[withdraw] no route matched for selected method', {
                    type: selectedMethod.type,
                    countryPath: selectedMethod.countryPath,
                    hasBankAccount: !!selectedBankAccount,
                })
                setError({
                    showError: true,
                    errorMessage: t('errors.setupFailed'),
                })
            }
        }
    }

    // check if continue button should be disabled
    const isContinueDisabled = useMemo(() => {
        if (!rawTokenAmount) return true

        const numericAmount = parseFloat(rawTokenAmount)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) return true

        const usdEq = (selectedTokenData?.price ?? 1) * numericAmount
        if (usdEq < minUsdAmount) return true // below country-specific minimum

        // only apply the balance ceiling once it has loaded (maxDecimalAmount is 0
        // while spendableBalance is undefined) — else Continue is disabled during load
        return (balance !== undefined && numericAmount > maxDecimalAmount) || error.showError
    }, [rawTokenAmount, balance, maxDecimalAmount, error.showError, selectedTokenData?.price, minUsdAmount])

    // native app: render country-specific views when ?country= is present
    const viewFromQuery = searchParams.get('view')
    if (countryFromQuery) {
        // native app: render country-specific views.
        // stub exists for web build; real component is injected by native build script.
        if (viewFromQuery === 'bank') {
            const WithdrawBankPage = React.lazy(() => import('./_withdraw-bank'))
            return (
                <React.Suspense fallback={null}>
                    <WithdrawBankPage />
                </React.Suspense>
            )
        }
        const AddWithdrawCountriesList = React.lazy(() => import('@/components/AddWithdraw/AddWithdrawCountriesList'))
        return (
            <React.Suspense fallback={null}>
                <AddWithdrawCountriesList flow="withdraw" />
            </React.Suspense>
        )
    }

    if (step === 'inputAmount') {
        // only show limits card for bank/manteca withdrawals, not crypto
        const showLimitsCard = !isCryptoWithdraw && (limitsValidation.isBlocking || limitsValidation.isWarning)

        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader
                    title={isFromSendFlow ? tNav('send') : tNav('withdraw')}
                    onPrev={() => {
                        // if crypto from send, go back to send page
                        if (isCryptoFromSend) {
                            setSelectedMethod(null)
                            router.push('/send')
                        } else {
                            // otherwise go back to method selection
                            // clear amount so it doesn't carry over to a different method
                            setAmountToWithdraw('')
                            setUsdAmount('')
                            setSelectedMethod(null)
                            setSelectedBankAccount(null)
                            setStep('selectMethod')
                        }
                    }}
                />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="space-y-1">
                        <div className="text-xl font-bold">
                            {isFromSendFlow ? t('amountToSend') : t('amountToWithdraw')}
                        </div>
                    </div>
                    <AmountInput
                        initialAmount={rawTokenAmount}
                        setPrimaryAmount={handleTokenAmountChange}
                        primaryDenomination={{
                            symbol: '$',
                            price: 1,
                            decimals: 6, // we want USDC decimals to be able to pay exactly
                        }}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                    />

                    {/* limits warning/error card for bank withdrawals */}
                    {showLimitsCard &&
                        (() => {
                            const limitsCardProps = getLimitsWarningCardProps({
                                validation: limitsValidation,
                                flowType: 'offramp',
                                currency: 'USD',
                            })
                            return limitsCardProps ? <LimitsWarningCard {...limitsCardProps} /> : null
                        })()}

                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={
                            isContinueDisabled ||
                            (!isCryptoWithdraw && (limitsValidation.isLoading || limitsValidation.isBlocking))
                        }
                        className="w-full"
                    >
                        {tCommon('continue')}
                    </Button>
                    {/* only show error if limits blocking card is not displayed (warnings can coexist) */}
                    {error.showError && !!error.errorMessage && !limitsValidation.isBlocking && (
                        <ErrorAlert description={error.errorMessage} />
                    )}
                </div>
            </div>
        )
    }

    if (step === 'selectMethod' && !selectedMethod) {
        return (
            <AddWithdrawRouterView
                flow="withdraw"
                pageTitle={isBankFromSend ? tNav('send') : tNav('withdraw')}
                mainHeading={isBankFromSend ? t('howWouldYouLikeToSend') : t('howWouldYouLikeToWithdraw')}
                onBackClick={() => {
                    // if bank from send flow, go back to send page
                    if (isBankFromSend) {
                        router.push('/send')
                    } else {
                        router.push('/home')
                    }
                }}
            />
        )
    }

    return null
}
