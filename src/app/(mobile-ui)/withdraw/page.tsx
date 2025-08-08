'use client'

import { Button } from '@/components/0_Bruddle'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { formatAmount } from '@/utils'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, useRef, useContext } from 'react'
import { formatUnits } from 'viem'

type WithdrawStep = 'inputAmount' | 'selectMethod'

export default function WithdrawPage() {
    const router = useRouter()
    const { selectedTokenData } = useContext(tokenSelectorContext)

    const {
        amountToWithdraw: amountFromContext,
        setAmountToWithdraw,
        setError,
        error,
        setUsdAmount,
        resetWithdrawFlow,
    } = useWithdrawFlow()

    // choose the first screen: if an amount already exists we jump straight to the method list
    const initialStep: WithdrawStep =
        amountFromContext && parseFloat(amountFromContext) > 0 ? 'selectMethod' : 'inputAmount'

    const [step, setStep] = useState<WithdrawStep>(initialStep)

    // flag to know if user has manually entered something
    const userTypedRef = useRef<boolean>(false)

    // initialise the amount input with the value from context (if any)
    // state to keep track of the token input key to force-remount the component
    const [tokenInputKey, setTokenInputKey] = useState<number>(0)

    // raw amount currently typed in the input
    const [rawTokenAmount, setRawTokenAmount] = useState<string>(amountFromContext || '')

    const { balance } = useWallet()

    const maxDecimalAmount = useMemo(() => {
        return balance ? Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : 0
    }, [balance])

    const peanutWalletBalance = useMemo(() => {
        return balance ? formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS)) : ''
    }, [balance])

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
        if (!amountFromContext) {
            resetWithdrawFlow()
        }
    }, [amountFromContext, resetWithdrawFlow])

    useEffect(() => {
        if (amountFromContext && parseFloat(amountFromContext) > 0) {
            setStep('selectMethod')
            if (!rawTokenAmount) {
                setRawTokenAmount(amountFromContext)
            }
        } else {
            setStep('inputAmount')
            // clear the raw token amount when switching back to input
            if (step !== 'inputAmount') {
                setRawTokenAmount('')
                setTokenInputKey((k) => k + 1)
            }
        }
    }, [amountFromContext, step])

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            const cleanedAmountStr = amountStr.replace(/,/g, '')
            const amount = Number(cleanedAmountStr)
            if (!Number.isFinite(amount) || amount <= 0) {
                setError({ showError: true, errorMessage: 'Please enter a valid number.' })
                return false
            }

            // convert the entered token amount to USD to enforce the $1 min rule
            const price = selectedTokenData?.price ?? 0 // 0 for safety; will fail below
            const usdEquivalent = price ? amount * price : amount // if no price assume token pegged 1 USD

            if (usdEquivalent >= 1 && amount <= maxDecimalAmount) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            // determine message
            let message = ''
            if (usdEquivalent < 1) {
                message = 'Minimum withdrawal is 1.'
            } else if (amount > maxDecimalAmount) {
                message = 'Amount exceeds your wallet balance.'
            } else {
                message = 'Please enter a valid amount.'
            }
            setError({ showError: true, errorMessage: message })
            return false
        },
        [maxDecimalAmount, setError, selectedTokenData?.price]
    )

    const handleTokenAmountChange = useCallback(
        (value: string | undefined) => {
            let newValue = value || ''
            // treat leading "0" from initial TokenAmountInput mount as empty
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
        if (validateAmount(rawTokenAmount)) {
            const cleanedAmount = rawTokenAmount.replace(/,/g, '')
            setAmountToWithdraw(cleanedAmount)
            const usdVal = (selectedTokenData?.price ?? 1) * parseFloat(cleanedAmount)
            setUsdAmount(usdVal.toString())
            // the step will automatically change to 'selectMethod' via the useEffect above
        }
    }

    // check if continue button should be disabled
    const isContinueDisabled = useMemo(() => {
        if (!rawTokenAmount) return true

        const cleanedAmount = rawTokenAmount.replace(/,/g, '')
        const numericAmount = parseFloat(cleanedAmount)
        if (!Number.isFinite(numericAmount) || numericAmount <= 0) return true

        const usdEq = (selectedTokenData?.price ?? 1) * numericAmount
        if (usdEq < 1) return true // below $1 min

        return numericAmount > maxDecimalAmount || error.showError
    }, [rawTokenAmount, maxDecimalAmount, error.showError, selectedTokenData?.price])

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Withdraw" onPrev={() => router.push('/home')} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">Amount to withdraw</div>
                    <TokenAmountInput
                        key={tokenInputKey} // force re-render to clear any internal state
                        tokenValue={rawTokenAmount}
                        setTokenValue={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                    />
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={isContinueDisabled}
                        className="w-full"
                    >
                        Continue
                    </Button>
                    {error.showError && !!error.errorMessage && <ErrorAlert description={error.errorMessage} />}
                </div>
            </div>
        )
    }

    if (step === 'selectMethod') {
        return (
            <AddWithdrawRouterView
                flow="withdraw"
                pageTitle="Withdraw"
                mainHeading="How would you like to withdraw?"
                onBackClick={() => {
                    resetWithdrawFlow()
                }}
            />
        )
    }

    return null
}
