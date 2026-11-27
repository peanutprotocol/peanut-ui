'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Icon } from '@/components/Global/Icons/Icon'
import { getCurrencyFlagUrl } from '@/constants/countryCurrencyMapping'
import type { SupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import { formatAmountNumber } from '@/utils/currency'
import type { FxBulkRateEntry, FxFeeSchedule } from '@/utils/fx.utils'
import {
    convertCurrencyAmount,
    getActiveFlatFeeForCurrency,
    parseLocaleAmount,
    QR_ENABLED_CURRENCIES,
    RATE_DECIMALS,
    type RatesDirection,
} from './rates-fees.utils'

interface RateConverterCardProps {
    currency: SupportedExchangeCurrency
    direction: RatesDirection
    amountInput: string
    onAmountChange: (value: string) => void
    onSwapDirection: () => void
    rateEntry: FxBulkRateEntry | undefined
    rateLoading: boolean
    feeSchedule: FxFeeSchedule
    userCountryCode?: string | null
    ctaLabel: string
    ctaDisabled: boolean
    onCtaClick: () => void
}

export function RateConverterCard({
    currency,
    direction,
    amountInput,
    onAmountChange,
    onSwapDirection,
    rateEntry,
    rateLoading,
    feeSchedule,
    userCountryCode,
    ctaLabel,
    ctaDisabled,
    onCtaClick,
}: RateConverterCardProps) {
    const t = useTranslations('exchangeRate')
    const locale = useLocale()
    const isAdd = direction === 'add'
    const isUsd = currency === 'USD'
    const dec = RATE_DECIMALS[currency]
    const hasQr = QR_ENABLED_CURRENCIES.has(currency)

    const currencyFlag = getCurrencyFlagUrl(currency)
    const usdFlag = getCurrencyFlagUrl('USD')

    const activeRate = isUsd ? 1 : isAdd ? rateEntry?.buyRate : rateEntry?.sellRate
    const oppositeRate = isUsd ? 1 : isAdd ? rateEntry?.sellRate : rateEntry?.buyRate

    const parsedAmount = parseLocaleAmount(amountInput, locale)
    const activeFlatFee = getActiveFlatFeeForCurrency(feeSchedule, currency, direction, userCountryCode)
    const flatFeeLocal = isAdd && activeFlatFee && activeFlatFee.currency === currency ? activeFlatFee.amount : 0

    const convertedAmount =
        activeRate && activeRate > 0
            ? convertCurrencyAmount({
                  amount: parsedAmount,
                  rate: activeRate,
                  direction,
                  flatFeeLocal,
              })
            : null

    const outDecimals = isAdd ? 2 : dec > 2 ? 2 : dec
    const formattedOutput =
        convertedAmount !== null
            ? formatAmountNumber(convertedAmount, outDecimals, outDecimals, locale)
            : rateLoading
              ? '…'
              : '—'

    const formatFlatFeeValue = () => {
        if (!activeFlatFee) return null
        if (activeFlatFee.currency === 'BRL') {
            return `R$ ${formatAmountNumber(activeFlatFee.amount, 2, 2, locale)}`
        }
        if (activeFlatFee.currency === 'EUR') {
            return `€${formatAmountNumber(activeFlatFee.amount, 2, 2, locale)}`
        }
        if (activeFlatFee.railHint === 'wire') {
            return `$${formatAmountNumber(activeFlatFee.amount, 0, 0, locale)} (${t('converter.achZero')})`
        }
        return `$${formatAmountNumber(activeFlatFee.amount, 2, 2, locale)}`
    }

    const updatedTime = rateEntry?.effectiveAt
        ? new Date(rateEntry.effectiveAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
        : null

    const fromCode = isAdd ? currency : 'USD'
    const toCode = isAdd ? 'USD' : currency
    const fromFlag = isAdd ? currencyFlag : usdFlag
    const toFlag = isAdd ? usdFlag : currencyFlag

    return (
        <Card className="flex flex-col gap-3 p-4">
            {/* From input */}
            <div className="flex flex-col gap-1">
                <label htmlFor="rates-amount-input" className="text-body-s text-foreground-secondary">
                    {isAdd ? t('converter.youSendLocal', { currency }) : t('converter.youSendUsd')}
                </label>
                <div className="flex min-h-12 items-center justify-between gap-2 rounded-sm border border-border-default bg-background-default px-3 focus-within:outline-[3px] focus-within:outline-action-focus">
                    <input
                        id="rates-amount-input"
                        type="text"
                        inputMode="decimal"
                        value={amountInput}
                        onChange={(event) => onAmountChange(event.target.value)}
                        aria-label={t('converter.amountAria')}
                        className="w-full min-w-0 bg-transparent text-body-m-semibold text-foreground-primary outline-none"
                    />
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-label-l text-foreground-primary">
                        {fromFlag && (
                            <Image
                                src={fromFlag}
                                alt={fromCode}
                                width={20}
                                height={20}
                                className="size-5 rounded-full object-cover"
                            />
                        )}
                        {fromCode}
                    </span>
                </div>
            </div>

            {/* Bilateral 1-tap swap */}
            <div className="flex justify-center">
                <button
                    type="button"
                    onClick={onSwapDirection}
                    aria-label={t('widget.swapCurrencies')}
                    data-testid="rates-swap-direction"
                    className="relative flex size-10 items-center justify-center rounded-full border border-border-default bg-background-default text-foreground-primary transition-colors duration-instant after:absolute after:-inset-0.5 hover:bg-action-primary focus-visible:outline-[3px] focus-visible:outline-action-focus active:bg-action-primary-press"
                >
                    <Icon name="arrow-exchange" size={20} className="rotate-90" />
                </button>
            </div>

            {/* To output */}
            <div className="flex flex-col gap-1">
                <span className="text-body-s text-foreground-secondary">
                    {isAdd ? t('converter.youReceiveUsd') : t('converter.youReceiveLocal', { currency })}
                </span>
                <div className="flex min-h-12 items-center justify-between gap-2 rounded-sm border border-border-default bg-background-page px-3">
                    <span
                        data-testid="rates-converted-output"
                        className="min-w-0 flex-1 truncate text-body-m-semibold text-foreground-primary"
                    >
                        {formattedOutput}
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-label-l text-foreground-primary">
                        {toFlag && (
                            <Image
                                src={toFlag}
                                alt={toCode}
                                width={20}
                                height={20}
                                className="size-5 rounded-full object-cover"
                            />
                        )}
                        {toCode}
                    </span>
                </div>
            </div>

            {/* Single calm rate pill + opposite side / freshness */}
            <div className="flex flex-col items-center gap-1 pt-1 text-center">
                <span
                    data-testid="rates-hero-rate"
                    className="inline-flex items-center rounded-full bg-background-disabled px-3 py-1 text-label-m text-foreground-primary"
                >
                    {isUsd
                        ? '1 USD = 1 USD'
                        : activeRate
                          ? `1 USD = ${formatAmountNumber(activeRate, dec, dec, locale)} ${currency}`
                          : rateLoading
                            ? '…'
                            : t('widget.rateUnavailable')}
                </span>
                <span className="text-body-xs text-foreground-secondary">
                    {isUsd
                        ? t('converter.usdSubline')
                        : oppositeRate
                          ? [
                                isAdd
                                    ? `${hasQr ? t('direction.withdrawQrShort') : t('direction.withdrawShort')}: ${formatAmountNumber(oppositeRate, dec, dec, locale)} ${currency}`
                                    : `${t('direction.addShort')}: ${formatAmountNumber(oppositeRate, dec, dec, locale)} ${currency}`,
                                updatedTime ? t('converter.updatedAt', { time: updatedTime }) : null,
                            ]
                                .filter(Boolean)
                                .join(' · ')
                          : null}
                </span>
            </div>

            {/* Fee row renders ONLY when a non-zero flat/provider fee actually applies */}
            {activeFlatFee && (
                <div className="border-t border-dashed border-border-default">
                    <DataRow
                        label={
                            activeFlatFee.railHint === 'wire'
                                ? 'Wire'
                                : activeFlatFee.payer === 'provider'
                                  ? t('converter.providerFee')
                                  : t('converter.flatFee')
                        }
                        value={formatFlatFeeValue()}
                    />
                </div>
            )}

            <Button
                variant="primary"
                shadowSize="4"
                className="w-full"
                disabled={ctaDisabled}
                onClick={onCtaClick}
                data-testid="widget-cta"
            >
                {ctaLabel}
            </Button>
        </Card>
    )
}
