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
import { formatAmount } from '@/utils/general.utils'
import { getCountryFromAccount, getCountryFromPath, getMinimumAmount } from '@/utils/bridge.utils'
import useGetExchangeRate from '@/hooks/useGetExchangeRate'
import { AccountType } from '@/interfaces'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useRef, useContext } from 'react'
import { formatUnits } from 'viem'
import { useLimitsValidation } from '@/features/limits/hooks/useLimitsValidation'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps } from '@/features/limits/utils'

type WithdrawStep = 'inputAmount' | 'selectMethod'

export default function WithdrawPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { selectedTokenData } = useContext(tokenSelectorContext)

    // check if coming from send flow based on method query param
    const methodParam = searchParams.get('method')
    const isFromSendFlow = !!(methodParam && ['bank', 'crypto'].includes(methodParam))
    const isCryptoFromSend = methodParam === 'crypto' && isFromSendFlow
    const isBankFromSend = methodParam === 'bank' && isFromSendFlow

    const {
        amountToWithdraw: amountFromContext,
        setAmountToWithdraw,
        setError,
        error,
        setUsdAmount,
        selectedMethod,
        selectedBankAccount,
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
    const [tokenInputKey, setTokenInputKey] = useState<number>(0)

    // raw amount currently typed in the input
    const [rawTokenAmount, setRawTokenAmount] = useState<string>(amountFromContext || '')

    const { balance } = useWallet()

    const maxDecimalAmount = useMemo(() => {
        return balance !== undefined ? Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : 0
    }, [balance])

    const peanutWalletBalance = useMemo(() => {
        return balance !== undefined ? formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : ''
    }, [balance])

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

    // fetch exchange rate for non-USD countries to convert local minimum to USD
    const { exchangeRate } = useGetExchangeRate({
        accountType: rateAccountType,
        enabled: rateAccountType !== AccountType.US && countryIso2 !== '',
    })

    // compute minimum withdrawal in USD using the exchange rate
    const minUsdAmount = useMemo(() => {
        const localMin = getMinimumAmount(countryIso2)
        // for US or unknown, minimum is already in USD
        if (!countryIso2 || countryIso2 === 'US') return localMin
        // for EUR countries, €1 ≈ $1
        if (localMin === 1) return 1
        // convert local minimum to USD: sellRate = local currency per 1 USD
        const rate = parseFloat(exchangeRate || '0')
        if (rate <= 0) return 1 // fallback while rate is loading
        return Math.ceil(localMin / rate)
    }, [countryIso2, exchangeRate])

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
                setError({ showError: true, errorMessage: 'Please enter a valid number.' })
                return false
            }

            // convert the entered token amount to USD
            const price = selectedTokenData?.price ?? 0 // 0 for safety; will fail below
            const usdEquivalent = price ? amount * price : amount // if no price assume token pegged 1 USD

            if (usdEquivalent >= minUsdAmount && amount <= maxDecimalAmount) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            // determine message
            let message = ''
            if (usdEquivalent < minUsdAmount) {
                const minDisplay = minUsdAmount % 1 === 0 ? `$${minUsdAmount}` : `$${minUsdAmount.toFixed(2)}`
                message = isFromSendFlow
                    ? `Minimum send amount is ${minDisplay}.`
                    : `Minimum withdrawal is ${minDisplay}.`
            } else if (amount > maxDecimalAmount) {
                message = 'Amount exceeds your wallet balance.'
            } else {
                message = 'Please enter a valid amount.'
            }
            setError({ showError: true, errorMessage: message })
            return false
        },
        [maxDecimalAmount, setError, selectedTokenData?.price, isFromSendFlow, minUsdAmount]
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
    }, [rawTokenAmount, validateAmount, setError, step])

    const handleAmountContinue = () => {
        if (validateAmount(rawTokenAmount) && selectedMethod) {
            setAmountToWithdraw(rawTokenAmount)
            const usdVal = (selectedTokenData?.price ?? 1) * parseFloat(rawTokenAmount)
            setUsdAmount(usdVal.toString())

            // Route based on selected method type
            // preserve method param if coming from send flow
            const methodQueryParam = isFromSendFlow ? `method=${methodParam}` : ''

            if (selectedBankAccount) {
                const country = getCountryFromAccount(selectedBankAccount)
                if (country) {
                    const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                    router.push(`/withdraw/${country.path}/bank${queryParams}`)
                } else {
                    throw new Error('Failed to get country from bank account')
                }
            } else if (selectedMethod.type === 'crypto') {
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(`/withdraw/crypto${queryParams}`)
            } else if (selectedMethod.type === 'manteca') {
                // Route directly to Manteca with method and country params
                const mantecaMethodParam = selectedMethod.title?.toLowerCase().replace(/\s+/g, '-') || 'bank-transfer'
                const additionalParams = isFromSendFlow ? `&${methodQueryParam}` : ''
                router.push(
                    `/withdraw/manteca?method=${mantecaMethodParam}&country=${selectedMethod.countryPath}${additionalParams}`
                )
            } else if (selectedMethod.type === 'bridge' && selectedMethod.countryPath) {
                // Bridge countries go to country page for bank account form
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(`/withdraw/${selectedMethod.countryPath}${queryParams}`)
            } else if (selectedMethod.countryPath) {
                // Other countries go to their country pages
                const queryParams = isFromSendFlow ? `?${methodQueryParam}` : ''
                router.push(`/withdraw/${selectedMethod.countryPath}${queryParams}`)
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

        return numericAmount > maxDecimalAmount || error.showError
    }, [rawTokenAmount, maxDecimalAmount, error.showError, selectedTokenData?.price, minUsdAmount])

    if (step === 'inputAmount') {
        // only show limits card for bank/manteca withdrawals, not crypto
        const showLimitsCard =
            selectedMethod?.type !== 'crypto' && (limitsValidation.isBlocking || limitsValidation.isWarning)

        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader
                    title={isFromSendFlow ? 'Send' : 'Withdraw'}
                    onPrev={() => {
                        // if crypto from send, go back to send page
                        if (isCryptoFromSend) {
                            setSelectedMethod(null)
                            router.push('/send')
                        } else {
                            // otherwise go back to method selection
                            setSelectedMethod(null)
                            setStep('selectMethod')
                        }
                    }}
                />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="space-y-1">
                        <div className="text-xl font-bold">
                            {isFromSendFlow ? 'Amount to send' : 'Amount to withdraw'}
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
                            (selectedMethod?.type !== 'crypto' &&
                                (limitsValidation.isLoading || limitsValidation.isBlocking))
                        }
                        className="w-full"
                    >
                        Continue
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
                pageTitle={isBankFromSend ? 'Send' : 'Withdraw'}
                mainHeading={isBankFromSend ? 'How would you like to send?' : 'How would you like to withdraw?'}
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
