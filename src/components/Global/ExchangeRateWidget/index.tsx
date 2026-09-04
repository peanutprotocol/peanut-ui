import CurrencySelect from '@/components/LandingPage/CurrencySelect'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { toDisplayCurrency, toSupportedExchangeCurrency } from '@/constants/exchange-currencies.consts'
import { useDebounce } from '@/hooks/useDebounce'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { applyBridgeCrossCurrencyFee, reverseBridgeCrossCurrencyFee } from '@/utils/bridge.utils'
import Image from 'next/image'
import { parseAsFloat, parseAsString, useQueryStates } from 'nuqs'
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon, type IconName } from '../Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'

export interface ExchangeRateWidgetLabels {
    youSend: string
    recipientGets: string
    swapCurrencies: string
    rateUnavailable: string
    bankFee: string
    peanutFee: string
    free: string
    arrivesHours: string
    arrivesMinutes: string
}

// English defaults keep marketing callers (landing page, MDX) unchanged;
// product-UI callers pass translated labels.
const DEFAULT_LABELS: ExchangeRateWidgetLabels = {
    youSend: 'You Send',
    recipientGets: 'Recipient Gets',
    swapCurrencies: 'Swap currencies',
    rateUnavailable: 'Rate currently unavailable',
    bankFee: 'Bank fee',
    peanutFee: 'Peanut fee',
    free: 'Free!',
    arrivesHours: 'Should arrive in hours.',
    arrivesMinutes: 'Should arrive in minutes.',
}

interface IExchangeRateWidgetProps {
    ctaLabel: string
    ctaIcon: IconName
    ctaAction: (sourceCurrency: string, destinationCurrency: string) => void
    labels?: Partial<ExchangeRateWidgetLabels>
    // Marketing send-to pages seed the URL with currencies that only need a
    // quote (see the comment on `sourceCurrency` below). Product callers whose
    // CTA routes into a country flow — currently just /profile/exchange-rate —
    // need the URL clamped to the six routable currencies instead, or a stale
    // `?to=PLN` shows a rate the dropdown never offers and the CTA can only
    // route by falling back to the default pair.
    restrictToRoutable?: boolean
}

const ExchangeRateWidget: FC<IExchangeRateWidgetProps> = ({
    ctaLabel,
    ctaIcon,
    ctaAction,
    labels,
    restrictToRoutable = false,
}) => {
    const l = { ...DEFAULT_LABELS, ...labels }
    // shallow + history:'replace' uses window.history.replaceState — bypasses
    // Next.js navigation so URL updates don't (occasionally) scroll the page
    // to the top through the parent Suspense boundary.
    const [query, setQuery] = useQueryStates(
        {
            from: parseAsString.withDefault('USD'),
            to: parseAsString.withDefault('EUR'),
            amount: parseAsFloat.withDefault(10),
        },
        { shallow: true, history: 'replace', scroll: false }
    )

    // Normalised, and — for marketing callers — not filtered to the routable
    // six. Those pages seed this URL from their MDX frontmatter
    // (Marketing/mdx/ExchangeWidget.tsx) with ~20 currencies the FX feed
    // quotes but no rail supports — THB, PLN, JPY and the rest. Rejecting those
    // would render a euro rate on a "send money to Thailand" page. Displaying
    // a quote and offering a payment rail are different permissions — but a
    // caller whose CTA routes into a country flow needs both to agree, so it
    // opts into the routable-only parse via `restrictToRoutable`.
    const resolveCurrency = restrictToRoutable ? toSupportedExchangeCurrency : toDisplayCurrency
    const rawSourceCurrency = resolveCurrency(query.from)
    const rawDestinationCurrency = resolveCurrency(query.to)
    // Resolved together, not with independent 'USD'/'EUR' defaults: an invalid
    // side falling back to 'USD' while the other side was already the
    // explicit, valid 'USD' collapsed the pair to USD/USD — a currency
    // "exchanged" with itself.
    const sourceCurrency = rawSourceCurrency ?? (rawDestinationCurrency === 'USD' ? 'EUR' : 'USD')
    const destinationCurrency = rawDestinationCurrency ?? (sourceCurrency === 'USD' ? 'EUR' : 'USD')
    const urlSourceAmount = query.amount > 0 ? query.amount : 10

    // Exchange rate hook handles all the conversion logic
    const {
        sourceAmount,
        destinationAmount,
        exchangeRate,
        isLoading,
        isError,
        handleSourceAmountChange,
        handleDestinationAmountChange,
        getDestinationDisplayValue,
    } = useExchangeRate({
        sourceCurrency,
        destinationCurrency,
        initialSourceAmount: urlSourceAmount,
    })

    const debouncedSourceAmount = useDebounce(sourceAmount, 500)

    // Cross-currency (non-USD ↔ non-USD) transfers carry the Peanut developer fee —
    // currently 0, so this is an identity pass kept for the planned FX-margin
    // re-enable. The hook returns gross `source × rate`; we display net so
    // "Recipient Gets" tracks what a transfer actually delivers if the fee returns.
    const netDestinationAmount = useMemo<number | ''>(() => {
        if (typeof destinationAmount !== 'number') return destinationAmount
        return applyBridgeCrossCurrencyFee(destinationAmount, sourceCurrency, destinationCurrency)
    }, [destinationAmount, sourceCurrency, destinationCurrency])

    // Track whether the user is actively typing in the destination field so we can
    // echo their input verbatim instead of formatting a net value over it.
    const [isEditingDestination, setIsEditingDestination] = useState(false)

    const netDestinationDisplayValue = useMemo<string>(() => {
        if (isEditingDestination) return getDestinationDisplayValue()
        if (netDestinationAmount === '' || typeof netDestinationAmount !== 'number') return ''
        return netDestinationAmount.toFixed(2)
    }, [isEditingDestination, getDestinationDisplayValue, netDestinationAmount])

    const updateUrlParams = useCallback(
        (params: { from?: string; to?: string; amount?: number }) => {
            setQuery(params)
        },
        [setQuery]
    )

    // Setter functions that update URL
    // USD must always be one of the two currencies in the pair
    const setSourceCurrency = useCallback(
        (raw: string) => {
            // CurrencySelect only renders supported rows, so this is a type
            // narrowing rather than a real filter — but it is the same door the
            // URL comes through, and one of them had no guard at all.
            const currency = toSupportedExchangeCurrency(raw)
            if (!currency) return
            if (currency === 'USD') {
                // If setting source to USD and destination is already USD, switch destination
                if (destinationCurrency === 'USD') {
                    updateUrlParams({ from: currency, to: 'EUR' }) // fallback to EUR
                } else {
                    updateUrlParams({ from: currency })
                }
            } else {
                updateUrlParams({ from: currency, to: 'USD' })
            }
        },
        [updateUrlParams, destinationCurrency]
    )

    const setDestinationCurrency = useCallback(
        (raw: string) => {
            const currency = toSupportedExchangeCurrency(raw)
            if (!currency) return
            if (currency === 'USD') {
                if (sourceCurrency === 'USD') {
                    updateUrlParams({ from: 'EUR', to: currency }) // fallback to EUR
                } else {
                    updateUrlParams({ to: currency })
                }
            } else {
                updateUrlParams({ from: 'USD', to: currency })
            }
        },
        [updateUrlParams, sourceCurrency]
    )

    const [isSwapping, setIsSwapping] = useState(false)
    const skipNextDebounceSyncRef = useRef(false)

    const swapCurrencies = useCallback(() => {
        setIsSwapping(true)
        setIsEditingDestination(false)
        skipNextDebounceSyncRef.current = true
        // Use the displayed net amount as the new source so post-swap values match
        // what the user saw in "Recipient Gets" before swapping.
        const newAmount =
            typeof netDestinationAmount === 'number' && netDestinationAmount > 0
                ? Math.round(netDestinationAmount * 100) / 100
                : undefined
        updateUrlParams({ from: destinationCurrency, to: sourceCurrency, amount: newAmount })
    }, [sourceCurrency, destinationCurrency, netDestinationAmount, updateUrlParams])

    // clear swapping state once exchange rate hook finishes recalculating
    useEffect(() => {
        if (isSwapping && !isLoading) {
            setIsSwapping(false)
        }
    }, [isSwapping, isLoading])

    const showLoading = isLoading || isSwapping

    // Enforce USD rule: at least one currency must be USD
    useEffect(() => {
        if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
            // Neither is USD, set source to USD and keep destination as user specified
            updateUrlParams({ from: 'USD' })
        }
    }, [sourceCurrency, destinationCurrency, updateUrlParams])

    // Update URL when source amount changes (only for valid numbers)
    useEffect(() => {
        if (skipNextDebounceSyncRef.current) {
            skipNextDebounceSyncRef.current = false
            return
        }
        if (typeof debouncedSourceAmount === 'number' && debouncedSourceAmount !== urlSourceAmount) {
            updateUrlParams({ amount: debouncedSourceAmount })
        }
    }, [debouncedSourceAmount, urlSourceAmount, updateUrlParams])

    const sourceCurrencyFlag = useMemo(
        () => countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.flagCode,
        [sourceCurrency]
    )

    const destinationCurrencyFlag = useMemo(
        () => countryCurrencyMappings.find((currency) => currency.currencyCode === destinationCurrency)?.flagCode,
        [destinationCurrency]
    )

    // Determine delivery time text based on destination currency
    const deliveryTimeText = destinationCurrency === 'USD' ? l.arrivesHours : l.arrivesMinutes

    // no exchange-rate board exists in figma (checked 2026-08-20) — container
    // rebuilt on the DS Card primitive (board 17802:61536) as the conservative
    // recipe; a dedicated board can restyle the internals later.
    return (
        <Card shadowSize="4" className="mx-auto mt-12 h-fit w-full items-center justify-center gap-4 p-6 md:w-[420px]">
            <div className="w-full">
                <h2 className="text-left text-body-s">{l.youSend}</h2>
                <div className="mt-2 flex w-full items-center justify-center gap-4 rounded-sm border border-border-default bg-background-default p-4">
                    {showLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-8 w-40 animate-pulse rounded-full bg-background-disabled" />
                        </div>
                    ) : (
                        <input
                            min={0}
                            placeholder="0"
                            value={sourceAmount === '' ? '' : sourceAmount}
                            onChange={(e) => {
                                const inputValue = e.target.value
                                setIsEditingDestination(false)
                                if (inputValue === '') {
                                    handleSourceAmountChange('')
                                } else {
                                    const value = parseFloat(inputValue)
                                    handleSourceAmountChange(isNaN(value) ? '' : value)
                                }
                            }}
                            type="number"
                            className="w-full bg-transparent text-body-m-semibold text-foreground-primary outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={sourceCurrency}
                        setSelectedCurrency={setSourceCurrency}
                        // excludeCurrencies={[destinationCurrency]}
                        trigger={
                            <button className="flex w-20 items-center gap-2">
                                <Image
                                    src={getFlagUrl(sourceCurrencyFlag)}
                                    alt={`${sourceCurrencyFlag} flag`}
                                    width={160}
                                    height={160}
                                    className="size-4 rounded-full object-cover"
                                />
                                {sourceCurrency}{' '}
                                <Icon name="chevron-down" className="text-foreground-secondary" size={16} />
                            </button>
                        }
                    />
                </div>
            </div>

            <button
                onClick={swapCurrencies}
                className="flex h-8 w-8 items-center justify-center self-center rounded-full hover:bg-background-disabled"
                aria-label={l.swapCurrencies}
            >
                <Icon name="arrow-exchange" size={20} className="rotate-90 transition-transform duration-moderate" />
            </button>

            <div className="w-full">
                <h2 className="text-left text-body-s">{l.recipientGets}</h2>
                <div className="mt-2 flex w-full items-center justify-center gap-4 rounded-sm border border-border-default bg-background-default p-4">
                    {showLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-8 w-40 animate-pulse rounded-full bg-background-disabled" />
                        </div>
                    ) : (
                        <input
                            min={0}
                            placeholder="0"
                            value={netDestinationDisplayValue}
                            onChange={(e) => {
                                const inputValue = e.target.value
                                setIsEditingDestination(true)
                                if (inputValue === '') {
                                    handleDestinationAmountChange('', '')
                                } else {
                                    const value = parseFloat(inputValue)
                                    // User typed a net "Recipient Gets" value — gross it up
                                    // before handing to the hook so the source amount is
                                    // computed from the gross equivalent (net / (1 - fee) / rate).
                                    const grossValue = isNaN(value)
                                        ? ''
                                        : reverseBridgeCrossCurrencyFee(value, sourceCurrency, destinationCurrency)
                                    handleDestinationAmountChange(inputValue, grossValue)
                                }
                            }}
                            type="number"
                            className="w-full bg-transparent text-body-m-semibold text-foreground-primary outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={destinationCurrency}
                        setSelectedCurrency={setDestinationCurrency}
                        trigger={
                            <button className="flex w-20 items-center gap-2">
                                <Image
                                    src={getFlagUrl(destinationCurrencyFlag)}
                                    alt={`${destinationCurrencyFlag} flag`}
                                    width={160}
                                    height={160}
                                    className="size-4 rounded-full object-cover"
                                />
                                {destinationCurrency}{' '}
                                <Icon name="chevron-down" className="text-foreground-secondary" size={16} />
                            </button>
                        }
                    />
                </div>
            </div>

            <div className="rounded-full bg-background-disabled px-2 py-[2px] text-label-m text-foreground-secondary">
                {showLoading ? (
                    <div className="mx-auto h-3 w-28 animate-pulse rounded-full bg-background-disabled" />
                ) : isError ? (
                    <span>{l.rateUnavailable}</span>
                ) : (
                    <>
                        1 {sourceCurrency} = {exchangeRate.toFixed(4)} {destinationCurrency}
                    </>
                )}
            </div>

            {typeof destinationAmount === 'number' && destinationAmount > 0 && (
                <div className="flex w-full flex-col gap-3 rounded-sm border border-border-default px-4 py-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-left text-body-s font-normal">{l.bankFee}</h2>
                        <h2 className="text-left text-body-s font-normal">{l.free}</h2>
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-left text-body-s font-normal">{l.peanutFee}</h2>
                        <h2 className="text-left text-body-s font-normal">{l.free}</h2>
                    </div>
                </div>
            )}

            <Button
                onClick={() => ctaAction(sourceCurrency, destinationCurrency)}
                icon={ctaIcon}
                shadowSize="4"
                className="w-full"
            >
                {ctaLabel}
            </Button>

            {typeof destinationAmount === 'number' && destinationAmount > 0 && (
                <p className="text-body-xs text-foreground-secondary">{deliveryTimeText}</p>
            )}
        </Card>
    )
}

export default ExchangeRateWidget
