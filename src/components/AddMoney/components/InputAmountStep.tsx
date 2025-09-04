'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { useRouter } from 'next/navigation'
import { CountryData } from '../consts'
import { getCurrencySymbol } from '@/utils'
import ErrorAlert from '@/components/Global/ErrorAlert'

interface InputAmountStepProps {
    onSubmit: () => void
    selectedCountry: CountryData | null | undefined
    isLoading: boolean
    tokenAmount: string
    setTokenAmount: React.Dispatch<React.SetStateAction<string>>
    error: string | null
}

const InputAmountStep = ({
    tokenAmount,
    setTokenAmount,
    onSubmit,
    selectedCountry,
    isLoading,
    error,
}: InputAmountStepProps) => {
    const router = useRouter()

    return (
        <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
            <NavHeader title="Add Money" onPrev={() => router.back()} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                <div className="text-sm font-bold">How much do you want to add?</div>
                <TokenAmountInput
                    tokenValue={tokenAmount}
                    setTokenValue={(e) => setTokenAmount(e ?? '')}
                    walletBalance={undefined}
                    hideCurrencyToggle
                    currency={
                        selectedCountry
                            ? {
                                  code: selectedCountry.id,
                                  symbol: getCurrencySymbol(selectedCountry.id),
                                  price: 1,
                              }
                            : undefined
                    }
                    hideBalance={true}
                />
                <div className="flex items-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>This must exactly match what you send from your bank</span>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={!parseFloat(tokenAmount.replace(/,/g, ''))}
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
