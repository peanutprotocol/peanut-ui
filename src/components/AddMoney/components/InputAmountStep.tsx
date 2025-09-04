'use client'

import { Button } from '@/components/0_Bruddle'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import TokenAmountInput from '@/components/Global/TokenAmountInput'
import { useRouter } from 'next/navigation'
import { CountryData } from '../consts'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useCurrency } from '@/hooks/useCurrency'
import PeanutLoading from '@/components/Global/PeanutLoading'

interface InputAmountStepProps {
    onSubmit: () => void
    selectedCountry: CountryData
    isLoading: boolean
    tokenAmount: string
    setTokenAmount: React.Dispatch<React.SetStateAction<string>>
    setTokenUSDAmount: React.Dispatch<React.SetStateAction<string>>
    error: string | null
}

const InputAmountStep = ({
    tokenAmount,
    setTokenAmount,
    onSubmit,
    selectedCountry,
    isLoading,
    error,
    setTokenUSDAmount,
}: InputAmountStepProps) => {
    const router = useRouter()
    const currencyData = useCurrency(selectedCountry.currency ?? 'ARS')

    if (currencyData.isLoading) {
        return <PeanutLoading />
    }

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
                    setUsdValue={(e) => setTokenUSDAmount(e)}
                    currency={
                        currencyData
                            ? {
                                  code: currencyData.code!,
                                  symbol: currencyData.symbol!,
                                  price: currencyData.price!,
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
