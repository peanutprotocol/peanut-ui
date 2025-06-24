'use client'

import { Button } from '@/components/0_Bruddle'
import { AddWithdrawRouterView } from '@/components/AddWithdraw/AddWithdrawRouterView'
import ActionModal from '@/components/Global/ActionModal'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants'
import { useAddFlow } from '@/context/AddFlowContext'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatAmount } from '@/utils'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'

type AddStep = 'inputAmount' | 'selectMethod'

export default function AddMoneyPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [step, setStep] = useState<AddStep>('selectMethod')
    const [rawTokenAmount, setRawTokenAmount] = useState<string>('')
    const [showWarningModal, setShowWarningModal] = useState(false)
    const [isRiskAccepted, setIsRiskAccepted] = useState(false)
    const {
        amountToAdd: amountFromContext,
        setAmountToAdd,
        setError,
        error,
        fromBankSelected,
        setFromBankSelected,
    } = useAddFlow()

    const { balance } = useWallet()

    const peanutWalletBalance = useMemo(() => {
        const formattedBalance = formatAmount(formatUnits(balance, PEANUT_WALLET_TOKEN_DECIMALS))
        return formattedBalance
    }, [balance])

    // Handle URL parameter for fromBank selection
    useEffect(() => {
        const fromBankParam = searchParams.get('fromBank')
        if (fromBankParam === 'true' && !fromBankSelected) {
            setFromBankSelected(true)
        }
    }, [searchParams, fromBankSelected, setFromBankSelected])

    useEffect(() => {
        if (fromBankSelected) {
            setStep('inputAmount')
            if (amountFromContext && !rawTokenAmount) {
                setRawTokenAmount(amountFromContext)
            }
        } else {
            setStep('selectMethod')
        }
    }, [fromBankSelected, amountFromContext, rawTokenAmount])

    const validateAmount = useCallback(
        (amountStr: string): boolean => {
            if (!amountStr) {
                setError({ showError: false, errorMessage: '' })
                return true
            }

            const amount = Number(amountStr)

            if (Number.isFinite(amount) && amount >= 1) {
                setError({ showError: false, errorMessage: '' })
                return true
            } else {
                let message = 'Please enter a valid amount.'
                if (!Number.isFinite(amount)) {
                    message = 'Please enter a valid number.'
                } else if (amount < 1) {
                    message = 'Minimum deposit is 1.'
                }
                setError({
                    showError: true,
                    errorMessage: message,
                })
                return false
            }
        },
        [setError]
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
        if (validateAmount(rawTokenAmount)) {
            setShowWarningModal(true)
        }
    }

    const handleWarningConfirm = () => {
        setAmountToAdd(rawTokenAmount)
        setShowWarningModal(false)
        setIsRiskAccepted(false)
        // Navigate to a generic bank form page for add money
        // Using US as default since bank transfers are typically handled there
        router.push('/add-money/us/bank')
    }

    const handleWarningCancel = () => {
        setShowWarningModal(false)
        setIsRiskAccepted(false)
    }

    const handleBackFromAmount = () => {
        setFromBankSelected(false)
        setAmountToAdd('')
        setRawTokenAmount('')
        setStep('selectMethod')
        // Clear URL parameter
        router.replace('/add-money')
    }

    if (step === 'inputAmount') {
        return (
            <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
                <NavHeader title="Add Money" onPrev={handleBackFromAmount} />
                <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                    <div className="text-sm font-bold">Amount to add from bank</div>
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
                        disabled={!parseFloat(rawTokenAmount) || parseFloat(rawTokenAmount) < 1 || error.showError}
                        className="w-full"
                    >
                        Continue
                    </Button>
                    {error.showError && !!error.errorMessage && <ErrorAlert description={error.errorMessage} />}
                </div>

                <ActionModal
                    visible={showWarningModal}
                    onClose={handleWarningCancel}
                    icon="alert"
                    title="Important Notice"
                    description="In the following step you'll see a 'Deposit Message' item, copy and paste it exactly as it is on the description field of your transfer. Without it, we won't be able to credit your money."
                    checkbox={{
                        text: 'I understand and accept the risk.',
                        checked: isRiskAccepted,
                        onChange: setIsRiskAccepted,
                    }}
                    ctas={[
                        {
                            text: 'Continue',
                            variant: isRiskAccepted ? 'purple' : 'dark',
                            shadowSize: '4',
                            onClick: handleWarningConfirm,
                            disabled: !isRiskAccepted,
                            className: 'w-full',
                        },
                    ]}
                    preventClose={false}
                    modalPanelClassName="max-w-md"
                />
            </div>
        )
    }

    if (step === 'selectMethod') {
        return (
            <AddWithdrawRouterView
                flow="add"
                pageTitle="Add Money"
                mainHeading="Where to add money from?"
                onBackClick={() => {
                    if (fromBankSelected) {
                        handleBackFromAmount()
                    } else {
                        router.push('/home')
                    }
                }}
            />
        )
    }
}
