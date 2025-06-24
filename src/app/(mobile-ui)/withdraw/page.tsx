'use client'

import { Button } from '@/components/0_Bruddle'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { useWithdrawFlow } from '@/context/WithdrawFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatAmount } from '@/utils'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'

type WithdrawStep = 'inputAmount' | 'selectMethod'

export default function WithdrawPage() {
    const router = useRouter()
    const [step, setStep] = useState<WithdrawStep>('inputAmount')
    const [rawTokenAmount, setRawTokenAmount] = useState<string>('')
    const {
        amountToWithdraw: amountFromContext,
        setAmountToWithdraw,
        setError,
        error,
        setRecipient,
    } = useWithdrawFlow()

    const { balance } = useWallet()

    const maxDecimalAmount = useMemo(() => {
        return Number(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
    }, [balance])

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    useEffect(() => {
        setRecipient({ address: '', name: '' })
    }, [])

    useEffect(() => {
        if (amountFromContext && parseFloat(amountFromContext) > 0) {
            setStep('selectMethod')
            if (!rawTokenAmount) {
                setRawTokenAmount(amountFromContext)
            }
        } else {
            setStep('inputAmount')
            setRawTokenAmount('')
        }
    }, [amountFromContext])

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            const amount = Number(amountStr)

            if (Number.isFinite(amount) && amount > 0 && amount <= maxDecimalAmount) {
                setError({ showError: false, errorMessage: '' })
                return true
            } else {
                let message = 'Please enter a valid amount.'
                if (!Number.isFinite(amount)) {
                    message = 'Please enter a valid number.'
                } else if (amount <= 0) {
                    message = 'Amount must be greater than zero.'
                } else if (amount > maxDecimalAmount) {
                    message = 'Amount exceeds your wallet balance.'
                }
                setError({
                    showError: true,
                    errorMessage: message,
                })
                return false
            }
        },
        [maxDecimalAmount, setError]
    )

    const handleTokenAmountChange = useCallback(
        (value: string | undefined) => {
            setRawTokenAmount(value || '')
        },
        [setRawTokenAmount]
    )

    useEffect(() => {
        if (rawTokenAmount === '') {
            if (!amountFromContext) {
                setError({ showError: false, errorMessage: '' })
            }
        } else {
            validateAmount(rawTokenAmount)
        }
    }, [rawTokenAmount, validateAmount, setError, amountFromContext])

    const handleAmountContinue = () => {
        // the button is disabled if amount is not > 0.
        // validateAmount will perform the final check against balance and format.
        if (validateAmount(rawTokenAmount)) {
            if (parseFloat(rawTokenAmount) > 0) {
                setAmountToWithdraw(rawTokenAmount)
            }
        }
    }

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Withdraw" onPrev={() => router.push('/home')} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">Amount to withdraw</div>
                    <TokenAmountInput
                        tokenValue={rawTokenAmount}
                        setTokenValue={handleTokenAmountChange}
                        walletBalance={peanutWalletBalance}
                        hideCurrencyToggle
                    />
                    <Button
                        variant="purple"
                        shadowSize="4"
                        onClick={handleAmountContinue}
                        disabled={!parseFloat(rawTokenAmount) || parseFloat(rawTokenAmount) <= 0 || error.showError}
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
                    setAmountToWithdraw('')
                }}
            />
        )
    }

    return null
}
