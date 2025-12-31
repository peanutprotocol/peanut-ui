'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import { useRouter } from 'next/navigation'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useCurrency } from '@/hooks/useCurrency'
import PeanutLoading from '@/components/Global/PeanutLoading'

type ICurrency = ReturnType<typeof useCurrency>
interface InputAmountStepProps {
    onSubmit: () => void
    isLoading: boolean
    tokenAmount: string
    setTokenAmount: ((value: string) => void) | React.Dispatch<React.SetStateAction<string>>
    error: string | null
    setCurrencyAmount: (amount: string | undefined) => void
    currencyData?: ICurrency
    setCurrentDenomination?: (denomination: string) => void
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
}: InputAmountStepProps) => {
    const router = useRouter()

    if (currencyData?.isLoading) {
        return <PeanutLoading />
    }

    return (
        <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
            <NavHeader title="Add Money" onPrev={() => router.back()} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                <div className="text-sm font-bold">How much do you want to add?</div>

                <AmountInput
                    initialAmount={tokenAmount}
                    setPrimaryAmount={setCurrencyAmount}
                    setSecondaryAmount={setTokenAmount}
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
                <div className="flex items-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>This must exactly match what you send from your bank</span>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={!!error || isLoading || !parseFloat(tokenAmount)}
                    className="w-full"
                    loading={isLoading}
                >
                    Continue
                </Button>
                {error && <ErrorAlert description={error} />}
            </div>
        </div>
    )
}

export default InputAmountStep
