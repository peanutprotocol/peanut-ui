'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import ErrorAlert from '@/components/Global/ErrorAlert'
import { useCurrency } from '@/hooks/useCurrency'
import PeanutLoading from '@/components/Global/PeanutLoading'
import LimitsWarningCard from '@/features/limits/components/LimitsWarningCard'
import { getLimitsWarningCardProps, type LimitCurrency } from '@/features/limits/utils'
import type { LimitValidationResult } from '@/features/limits/hooks/useLimitsValidation'
import { useTranslations } from 'next-intl'

type ICurrency = ReturnType<typeof useCurrency>

type LimitsValidationWithUser = LimitValidationResult & { isMantecaUser?: boolean }

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
    limitsValidation?: LimitsValidationWithUser
    // required - must be provided by caller based on the payment flow's currency (ARS, BRL, USD)
    limitsCurrency: LimitCurrency
    onBack: () => void
    // optional warning banner rendered at the top of the step (e.g. PIX-under-maintenance)
    maintenanceBanner?: React.ReactNode
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
    limitsCurrency,
    onBack,
    maintenanceBanner,
}: InputAmountStepProps) => {
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')

    if (currencyData?.isLoading) {
        return <PeanutLoading />
    }

    // FX fetch failed (e.g. provider outage): price is null but not loading.
    // Without this guard, `currencyData.price!.buy` below derefs null and
    // crashes the whole render (PEANUT-UI-PS7). Surface an error and block
    // submission instead — a wrong/absent rate must never reach onramp create.
    const rateUnavailable = !!currencyData?.isError

    const limitsCardProps = limitsValidation
        ? getLimitsWarningCardProps({
              validation: limitsValidation,
              flowType: 'onramp',
              currency: limitsCurrency,
          })
        : null

    return (
        <div className="flex min-h-[inherit] flex-col justify-start space-y-8">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                {maintenanceBanner}
                <div className="text-sm font-bold">{t('howMuchToAdd')}</div>

                <AmountInput
                    initialAmount={tokenAmount}
                    initialDenomination={initialDenomination}
                    setPrimaryAmount={setCurrencyAmount}
                    setSecondaryAmount={setTokenAmount}
                    setDisplayedAmount={setDisplayedAmount}
                    secondaryDenomination={{ symbol: 'USD', price: 1, decimals: 2 }}
                    primaryDenomination={
                        currencyData?.price && currencyData.symbol
                            ? {
                                  symbol: currencyData.symbol,
                                  price: currencyData.price.buy,
                                  decimals: 2,
                              }
                            : undefined
                    }
                    setCurrentDenomination={setCurrentDenomination}
                    hideBalance
                />

                {/* limits warning/error card */}
                {limitsCardProps && <LimitsWarningCard {...limitsCardProps} />}

                <div className="flex items-center gap-2 text-xs text-grey-1">
                    <Icon name="info" width={16} height={16} />
                    <span>{t('mustMatchBankTransfer')}</span>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={
                        !!error ||
                        isLoading ||
                        !parseFloat(tokenAmount) ||
                        limitsValidation?.isBlocking ||
                        rateUnavailable
                    }
                    className="w-full"
                    loading={isLoading}
                >
                    {tCommon('continue')}
                </Button>
                {/* only show error if limits blocking card is not displayed (warnings can coexist) */}
                {error && !limitsValidation?.isBlocking && <ErrorAlert description={error} />}
                {rateUnavailable && !error && !limitsValidation?.isBlocking && (
                    <ErrorAlert description={t('errors.rateUnavailable')} />
                )}
            </div>
        </div>
    )
}

export default InputAmountStep
