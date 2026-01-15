'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import { useRouter } from 'next/navigation'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useCurrency } from '@/hooks/useCurrency'
import PeanutLoading from '@/components/Global/PeanutLoading'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { formatExtendedNumber } from '@/utils/general.utils'

type ICurrency = ReturnType<typeof useCurrency>

interface LimitsValidationProps {
    isBlocking: boolean
    isWarning: boolean
    remainingLimit: number | null
    daysUntilReset: number | null
}

interface InputAmountStepProps {
    onSubmit: () => void
    isLoading: boolean
    tokenAmount: string
    setTokenAmount: ((value: string) => void) | React.Dispatch<React.SetStateAction<string>>
    error: string | null
    setCurrencyAmount: (amount: string | undefined) => void
    currencyData?: ICurrency
    setCurrentDenomination?: (denomination: string) => void
    initialDenomination?: string
    setDisplayedAmount?: (value: string) => void
    limitsValidation?: LimitsValidationProps
    limitsCurrency?: string
}

const InputAmountStep = ({
    tokenAmount,
    setTokenAmount,
    onSubmit,
    isLoading,
    error,
    currencyData,
    setCurrencyAmount,
    setCurrentDenomination,
    initialDenomination,
    setDisplayedAmount,
    limitsValidation,
    limitsCurrency = 'USD',
}: InputAmountStepProps) => {
    const router = useRouter()

    if (currencyData?.isLoading) {
        return <PeanutLoading />
    }

    const showLimitsCard = limitsValidation?.isBlocking || limitsValidation?.isWarning

    return (
        <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
            <NavHeader title="Add Money" onPrev={() => router.back()} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                <div className="text-sm font-bold">How much do you want to add?</div>

                <AmountInput
                    initialAmount={tokenAmount}
                    initialDenomination={initialDenomination}
                    setPrimaryAmount={setCurrencyAmount}
                    setSecondaryAmount={setTokenAmount}
                    setDisplayedAmount={setDisplayedAmount}
                    secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                    primaryDenomination={
                        currencyData
                            ? {
                                  symbol: currencyData.symbol!,
                                  price: currencyData.price!.buy,
                                  decimals: 2,
                              }
                            : undefined
                    }
                    setCurrentDenomination={setCurrentDenomination}
                    hideBalance
                />

                {/* limits warning/error card */}
                {showLimitsCard && (
                    <LimitsWarningCard
                        type={limitsValidation.isBlocking ? 'error' : 'warning'}
                        title={
                            limitsValidation.isBlocking
                                ? 'Amount too high, try a smaller amount.'
                                : "You're close to your limit."
                        }
                        items={[
                            {
                                text: `You can add up to ${formatExtendedNumber(limitsValidation.remainingLimit ?? 0)} ${limitsCurrency}`,
                            },
                            ...(limitsValidation.daysUntilReset
                                ? [{ text: `Limit resets in ${limitsValidation.daysUntilReset} days.` }]
                                : []),
                            { text: 'Check my limits.', isLink: true, href: '/limits', icon: 'external-link' },
                        ]}
                    />
                )}

                <div className="flex items-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>This must exactly match what you send from your bank</span>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={!!error || isLoading || !parseFloat(tokenAmount) || limitsValidation?.isBlocking}
                    className="w-full"
                    loading={isLoading}
                >
                    Continue
                </Button>
                {/* only show error if limits card is not displayed */}
                {error && !showLimitsCard && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}

export default InputAmountStep
