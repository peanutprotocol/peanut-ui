import CurrencySelect from '@/components/LandingPage/CurrencySelect'
import countryCurrencyMappings, { getFlagUrl } from '@/constants/countryCurrencyMapping'
import {
    resolveExchangeCurrencyPair,
    toDisplayCurrency,
    toSupportedExchangeCurrency,
} from '@/constants/exchange-currencies.consts'
import { useDebounce } from '@/hooks/useDebounce'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { toRoutePayloadAmount, type ExchangeRateWidgetMinimumPolicy } from '@/utils/exchangeRateWidget.utils'
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
    /** Under a landed quote: the rate is indicative, fees are shown at confirmation. Never a fee claim. */
    rateNote: string
    arrivesHours: string
    arrivesMinutes: string
    selectCurrency: string
}

// English defaults keep marketing callers (landing page, MDX) unchanged;
// product-UI callers pass translated labels.
const DEFAULT_LABELS: ExchangeRateWidgetLabels = {
    youSend: 'You Send',
    recipientGets: 'Recipient Gets',
    swapCurrencies: 'Swap currencies',
    rateUnavailable: 'Rate currently unavailable',
    rateNote:
        'The rate is an estimate and may include conversion costs. Review the rate and any fees before confirming.',
    arrivesHours: 'Should arrive in hours.',
    arrivesMinutes: 'Should arrive in minutes.',
    selectCurrency: 'Select currency',
}

interface IExchangeRateWidgetProps {
    ctaLabel: string
    ctaIcon: IconName
    // `sourceAmount` is the amount on screen at the tap — the URL copy lags it
    // by the debounce, so a caller that needs the amount must take it here.
    ctaAction: (sourceCurrency: string, destinationCurrency: string, sourceAmount: number | null) => void
    ctaDisabled?: boolean
    labels?: Partial<ExchangeRateWidgetLabels>
    // Marketing send-to pages seed the URL with currencies that only need a
    // quote (see the comment on `sourceCurrency` below). Product callers whose
    // CTA routes into a country flow — currently just /profile/exchange-rate —
    // need the URL clamped to the six routable currencies instead, or a stale
    // `?to=PLN` shows a rate the dropdown never offers and the CTA can only
    // route by falling back to the default pair.
    restrictToRoutable?: boolean
    // Marketing/landing pages keep the hard drop shadow (matches the rest of
    // that page's brutalist button styling); the in-app /profile/exchange-rate
    // screen drops it — not used on any other in-app card (TASK-22121).
    shadow?: boolean
    // The floor the route behind the CTA enforces, resolved with this widget's
    // rate: below it the CTA is disabled and the note names the limit in its
    // own unit (TASK-22235, TASK-22297). Product callers only.
    minimumPolicy?: ExchangeRateWidgetMinimumPolicy
}

const ExchangeRateWidget: FC<IExchangeRateWidgetProps> = ({
    ctaLabel,
    ctaIcon,
    ctaAction,
    ctaDisabled = false,
    labels,
    restrictToRoutable = false,
    shadow = true,
    minimumPolicy,
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
    // Resolved as a pair, not two independently-defaulted sides — see
    // resolveExchangeCurrencyPair. A page that derives its own label or
    // redirect from this same URL before the widget mounts (currently just
    // /profile/exchange-rate) must call this exact function too, or its
    // fallback can disagree with what the widget ends up showing.
    const [sourceCurrency, destinationCurrency] = resolveExchangeCurrencyPair(query.from, query.to, resolveCurrency)
    const urlSourceAmount = query.amount > 0 ? query.amount : 10
    // What the next pair change this widget makes starts from; a fresh object
    // per request so the hook can tell it from the URL amount even when equal.
    const [sourceAmountIntent, setSourceAmountIntent] = useState<{ value: number | '' }>()

    // Exchange rate hook handles all the conversion logic. A withdrawal pair
    // (USD → EUR, GBP, MXN, COP) shows the rate the withdrawal is quoted at,
    // Peanut's FX margin inside it, so the widget does no fee arithmetic.
    // Deposits and every other pair show the indicative display rate.
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
        sourceAmountIntent,
        withdrawalRate: true,
    })

    const debouncedSourceAmount = useDebounce(sourceAmount, 500)

    // Track whether the user is actively typing in the destination field so we can
    // echo their input verbatim instead of formatting the converted value over it.
    const [isEditingDestination, setIsEditingDestination] = useState(false)

    const destinationDisplayValue = useMemo<string>(() => {
        if (isEditingDestination) return getDestinationDisplayValue()
        if (typeof destinationAmount !== 'number') return ''
        return destinationAmount.toFixed(2)
    }, [isEditingDestination, getDestinationDisplayValue, destinationAmount])

    // `intent` is the amount the new pair starts from (a picker: the field as
    // it is, '' included; a swap: the amount it carries). Recorded only when
    // the pair really changes, so the hook consumes it in that same render.
    const updateUrlParams = useCallback(
        (params: { from?: string; to?: string; amount?: number }, intent?: { value: number | '' }) => {
            const pairChanges =
                (params.from ?? sourceCurrency) !== sourceCurrency ||
                (params.to ?? destinationCurrency) !== destinationCurrency
            if (intent && pairChanges) setSourceAmountIntent(intent)
            setQuery(params)
        },
        [setQuery, sourceCurrency, destinationCurrency]
    )

    // A pick keeps the field as it is: the URL gets the amount when there is
    // one (its copy lags typing by the debounce), the intent carries '' too.
    const liveSourceAmount = typeof sourceAmount === 'number' && sourceAmount > 0 ? sourceAmount : undefined

    // Setter functions that update URL
    // USD must always be one of the two currencies in the pair
    const setSourceCurrency = useCallback(
        (raw: string) => {
            // CurrencySelect only renders supported rows, so this is a type
            // narrowing rather than a real filter — but it is the same door the
            // URL comes through, and one of them had no guard at all.
            const currency = toSupportedExchangeCurrency(raw)
            if (!currency) return
            const amount = liveSourceAmount
            const intent = { value: liveSourceAmount ?? ('' as const) }
            if (currency === 'USD') {
                // If setting source to USD and destination is already USD, switch destination
                if (destinationCurrency === 'USD') {
                    updateUrlParams({ from: currency, to: 'EUR', amount }, intent) // fallback to EUR
                } else {
                    updateUrlParams({ from: currency, amount }, intent)
                }
            } else {
                updateUrlParams({ from: currency, to: 'USD', amount }, intent)
            }
        },
        [updateUrlParams, destinationCurrency, liveSourceAmount]
    )

    const setDestinationCurrency = useCallback(
        (raw: string) => {
            const currency = toSupportedExchangeCurrency(raw)
            if (!currency) return
            const amount = liveSourceAmount
            const intent = { value: liveSourceAmount ?? ('' as const) }
            if (currency === 'USD') {
                if (sourceCurrency === 'USD') {
                    updateUrlParams({ from: 'EUR', to: currency, amount }, intent) // fallback to EUR
                } else {
                    updateUrlParams({ to: currency, amount }, intent)
                }
            } else {
                updateUrlParams({ from: 'USD', to: currency, amount }, intent)
            }
        },
        [updateUrlParams, sourceCurrency, liveSourceAmount]
    )

    // A swap carries the displayed "You get" over as the new source, so it needs
    // a usable quote: none while loading, on error, or with nothing to carry.
    // The reversed pair may then be pending, which disables the next swap
    // until its rate lands (a cached one swaps back at once).
    const hasUsableQuote = !isLoading && !isError && typeof destinationAmount === 'number' && destinationAmount > 0
    const swapCurrencies = useCallback(() => {
        if (!hasUsableQuote) return
        setIsEditingDestination(false)
        const newAmount = Math.round(destinationAmount * 100) / 100
        updateUrlParams({ from: destinationCurrency, to: sourceCurrency, amount: newAmount }, { value: newAmount })
    }, [hasUsableQuote, sourceCurrency, destinationCurrency, destinationAmount, updateUrlParams])

    const showLoading = isLoading

    // Enforce USD rule: at least one currency must be USD
    useEffect(() => {
        if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
            // Neither is USD, set source to USD and keep destination as user specified
            updateUrlParams({ from: 'USD' })
        }
    }, [sourceCurrency, destinationCurrency, updateUrlParams])

    // Update URL when the typed source amount settles. Only a change of the
    // debounced value writes — a swap moves the URL on its own, and the
    // still-debouncing old amount must not write back over it.
    const lastSyncedAmountRef = useRef(debouncedSourceAmount)
    useEffect(() => {
        if (debouncedSourceAmount === lastSyncedAmountRef.current) return
        lastSyncedAmountRef.current = debouncedSourceAmount
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

    // Space is reserved whenever there is an amount, but a CLAIM about that
    // corridor (the delivery time) needs a landed, routable quote; the rate
    // note only qualifies the estimate shown. Marketing callers do not pass
    // restrictToRoutable and seed ~20 currencies the FX feed quotes but no rail
    // supports (see the prop comment), so "arrives in minutes" gated on the
    // typed amount alone promised fulfilment on corridors with neither a rate
    // nor a route — including while loading and alongside "rate unavailable".
    const hasAmount = typeof sourceAmount === 'number' && sourceAmount > 0
    // A quote is not a route. The FX feed prices ~20 currencies no rail serves,
    // so a marketing page can land a positive destinationAmount for a corridor
    // Peanut cannot fulfil — checked here rather than via `restrictToRoutable`,
    // which only says whether the CALLER clamps its URL, not whether this
    // particular pair is servable.
    const isRoutablePair =
        toSupportedExchangeCurrency(sourceCurrency) !== null &&
        toSupportedExchangeCurrency(destinationCurrency) !== null
    const hasQuote = typeof destinationAmount === 'number' && destinationAmount > 0 && !isError && isRoutablePair

    // The amount the CTA hands on: the on-screen source amount at the token's
    // payload precision, never the debounced URL copy.
    const ctaSourceAmount =
        typeof sourceAmount === 'number' && sourceAmount > 0 ? toRoutePayloadAmount(sourceAmount) : null

    // What the payload amount above actually funds at this rate — not the typed
    // "You get" figure, which a rounded source can fall short of.
    const fundedDestinationAmount = ctaSourceAmount !== null && exchangeRate > 0 ? ctaSourceAmount * exchangeRate : null

    // The route's floor, checked against the side it is stated in: a USD floor
    // against the payload amount, a local one (1 BRL for PIX) against the cents
    // that amount funds. Both truncate, never round up: 0.995 USD is below a $1
    // floor here exactly as it is on the route.
    // Resolved with or without a display quote: a USD floor (Bridge, fixed) does
    // not depend on it. Without a quote the resolver gets no rate (0), and a
    // local-currency floor gives no verdict — there is no funded amount to judge.
    const routeMinimum = minimumPolicy ? minimumPolicy.resolve(hasQuote ? exchangeRate : 0) : null
    const belowMinimum = useMemo(() => {
        if (!routeMinimum) return false
        if (routeMinimum.currency === sourceCurrency) {
            return ctaSourceAmount !== null && ctaSourceAmount < routeMinimum.amount
        }
        if (routeMinimum.currency === destinationCurrency && hasQuote && fundedDestinationAmount !== null) {
            return Math.floor(fundedDestinationAmount * 100 + 1e-9) / 100 < routeMinimum.amount
        }
        return false
    }, [routeMinimum, sourceCurrency, destinationCurrency, ctaSourceAmount, hasQuote, fundedDestinationAmount])
    // The route's floor is not known (rate pending or failed): the CTA waits,
    // whatever the display quote says. Only a failure is announced.
    const minimumBlocked = minimumPolicy?.blocked
    const minimumUnavailable = minimumBlocked === 'unavailable' && hasQuote

    // no exchange-rate board exists in figma (checked 2026-08-20) — container
    // rebuilt on the DS Card primitive (board 17802:61536) as the conservative
    // recipe; a dedicated board can restyle the internals later.
    return (
        <Card
            shadowSize={shadow ? '4' : undefined}
            className="mx-auto mt-12 h-fit w-full items-center justify-center gap-4 p-6 md:w-[420px]"
        >
            <div className="w-full">
                <h2 className="text-left text-body-s">{l.youSend}</h2>
                <div className="mt-2 flex w-full items-center justify-center gap-4 rounded-sm border border-border-default bg-background-default p-4 outline-action-focus focus-within:border-transparent focus-within:outline-[3px] focus-within:outline-action-focus focus-within:outline-solid">
                    {showLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-5 w-40 animate-pulse rounded-full bg-foreground-primary/10" />
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
                            // h-5 pins the field to its own line box so the skeleton
                            // it swaps with is exactly as tall
                            className="h-5 w-full bg-transparent text-body-m-semibold text-foreground-primary outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={sourceCurrency}
                        setSelectedCurrency={setSourceCurrency}
                        label={l.selectCurrency}
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
                disabled={!hasUsableQuote}
                className="flex h-8 w-8 items-center justify-center self-center rounded-full hover:bg-background-disabled disabled:opacity-40 disabled:hover:bg-transparent"
                aria-label={l.swapCurrencies}
            >
                <Icon name="arrow-exchange" size={20} className="rotate-90 transition-transform duration-moderate" />
            </button>

            <div className="w-full">
                <h2 className="text-left text-body-s">{l.recipientGets}</h2>
                <div className="mt-2 flex w-full items-center justify-center gap-4 rounded-sm border border-border-default bg-background-default p-4 outline-action-focus focus-within:border-transparent focus-within:outline-[3px] focus-within:outline-action-focus focus-within:outline-solid">
                    {showLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-5 w-40 animate-pulse rounded-full bg-foreground-primary/10" />
                        </div>
                    ) : (
                        <input
                            min={0}
                            placeholder="0"
                            value={destinationDisplayValue}
                            onChange={(e) => {
                                const inputValue = e.target.value
                                setIsEditingDestination(true)
                                if (inputValue === '') {
                                    handleDestinationAmountChange('', '')
                                } else {
                                    const value = parseFloat(inputValue)
                                    handleDestinationAmountChange(inputValue, isNaN(value) ? '' : value)
                                }
                            }}
                            type="number"
                            // h-5 pins the field to its own line box so the skeleton
                            // it swaps with is exactly as tall
                            className="h-5 w-full bg-transparent text-body-m-semibold text-foreground-primary outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={destinationCurrency}
                        setSelectedCurrency={setDestinationCurrency}
                        label={l.selectCurrency}
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

            {showLoading ? (
                // one skeleton pill sized like the loaded pill — no tint-on-tint
                <div className="h-5 w-32 animate-pulse rounded-full bg-foreground-primary/10" />
            ) : (
                <div
                    className="rounded-full bg-background-disabled px-2 py-[2px] text-label-m text-foreground-secondary"
                    // the settled state a screenshot waits for (dev fixtures)
                    data-testid="exchange-rate-pill"
                >
                    {isError ? (
                        <span>{l.rateUnavailable}</span>
                    ) : (
                        <>
                            1 {sourceCurrency} = {exchangeRate.toFixed(4)} {destinationCurrency}
                        </>
                    )}
                </div>
            )}

            {hasAmount && (
                <div className="flex min-h-17 w-full flex-col justify-center gap-3 rounded-sm border border-border-default px-4 py-2">
                    {/* /fx/rate is an indicative display rate; the widget holds no
                        fee data, so the only honest line here is that fees are
                        shown at confirmation (TASK-21104). It goes with any
                        estimate on screen, routable or not (a marketing THB quote
                        is still an estimate); route claims stay on hasQuote. */}
                    {hasUsableQuote && (
                        <p
                            className="text-left text-body-xs text-foreground-secondary"
                            data-testid="exchange-rate-note"
                        >
                            {l.rateNote}
                        </p>
                    )}
                </div>
            )}

            <Button
                disabled={ctaDisabled || belowMinimum || !!minimumBlocked}
                onClick={() => {
                    if (belowMinimum || minimumBlocked) return
                    ctaAction(sourceCurrency, destinationCurrency, ctaSourceAmount)
                }}
                icon={ctaIcon}
                shadowSize="4"
                className="w-full"
            >
                {ctaLabel}
            </Button>

            {hasAmount && (
                <p
                    className="min-h-4 text-body-xs text-foreground-secondary"
                    data-testid={
                        belowMinimum
                            ? 'exchange-rate-minimum'
                            : minimumUnavailable
                              ? 'exchange-rate-minimum-unavailable'
                              : undefined
                    }
                >
                    {belowMinimum && routeMinimum
                        ? minimumPolicy?.label(routeMinimum)
                        : minimumUnavailable
                          ? l.rateUnavailable
                          : hasQuote
                            ? deliveryTimeText
                            : ''}
                </p>
            )}
        </Card>
    )
}

export default ExchangeRateWidget
