'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { FieldColumn } from '@/components/0_Bruddle/FieldColumn'
import { Notification } from '@/components/0_Bruddle/Notification'
import NavHeader from '@/components/Global/NavHeader'
import AmountInput from '@/components/Global/AmountInput'
import RateUnavailable from '@/components/Global/RateUnavailable'
import { useCurrency } from '@/hooks/useCurrency'
import Loading from '@/components/Global/Loading'
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
    // flow-level failure (API/provider/sumsub) — renders in the Notification
    error: string | null
    // client-side amount validation — renders as the field's own error under the input
    validationError?: string | null
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
    validationError,
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

    // The rate fetch can hold this screen for tens of seconds on a slow mobile
    // network. Keep the header mounted so "back" always works instead of the
    // page reading as frozen (#1848).
    if (currencyData?.isLoading) {
        // dev keeps the header mounted so back always works during the load
        return (
            <div className="flex min-h-inherit flex-col justify-start gap-8">
                <NavHeader title={t('title')} onPrev={onBack} />
                <Loading variant="mascot" />
            </div>
        )
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
        <div className="flex min-h-inherit flex-col justify-start gap-8">
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="my-auto flex flex-grow flex-col justify-center gap-4 md:my-0">
                {maintenanceBanner}
                <div className="text-label-l">{t('howMuchToAdd')}</div>

                {/* only show the field error if limits blocking card is not displayed (warnings can coexist) */}
                <FieldColumn
                    error={!limitsValidation?.isBlocking ? validationError : undefined}
                    errorTestId="error-alert"
                >
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
                </FieldColumn>

                {/* limits warning/error card */}
                {limitsCardProps && <LimitsWarningCard {...limitsCardProps} />}

                <div className="flex items-center gap-2 text-body-xs text-foreground-secondary">
                    <span>{t('mustMatchBankTransfer')}</span>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    onClick={onSubmit}
                    disabled={
                        !!error ||
                        !!validationError ||
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
                {error && !limitsValidation?.isBlocking && (
                    <Notification priority="error" data-testid="error-alert">
                        {error}
                    </Notification>
                )}
                {/* not gated on `error`/limits like the alert above: the retry is the only
                    way to clear the rate block that disables Continue (dev #2843) */}
                {rateUnavailable && <RateUnavailable onRetry={() => currencyData?.refetch()} />}
            </div>
        </div>
    )
}

export default InputAmountStep
