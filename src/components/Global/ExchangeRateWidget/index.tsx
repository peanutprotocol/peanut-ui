import CurrencySelect from '@/components/LandingPage/CurrencySelect'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'
import { useDebounce } from '@/hooks/useDebounce'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { type FC, useCallback, useEffect, useMemo } from 'react'
import { Icon, type IconName } from '../Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'

interface IExchangeRateWidgetProps {
    ctaLabel: string
    ctaIcon: IconName
    ctaAction: (sourceCurrency: string, destinationCurrency: string) => void
}

const ExchangeRateWidget: FC<IExchangeRateWidgetProps> = ({ ctaLabel, ctaIcon, ctaAction }) => {
    const searchParams = useSearchParams()
    const router = useRouter()

    // Get values from URL or use defaults
    const sourceCurrency = searchParams.get('from') || 'USD'
    const destinationCurrency = searchParams.get('to') || 'EUR'
    const rawAmount = searchParams.get('amount')
    const parsedAmount = rawAmount !== null ? Number(rawAmount) : 10
    const urlSourceAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 10

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

    // Function to update URL parameters
    const updateUrlParams = useCallback(
        (params: { from?: string; to?: string; amount?: number }) => {
            const newSearchParams = new URLSearchParams(searchParams.toString())

            if (params.from) newSearchParams.set('from', params.from)
            if (params.to) newSearchParams.set('to', params.to)
            if (params.amount !== undefined) newSearchParams.set('amount', params.amount.toString())

            router.replace(`?${newSearchParams.toString()}`, { scroll: false })
        },
        [searchParams, router]
    )

    // Setter functions that update URL
    // USD must always be one of the two currencies in the pair
    const setSourceCurrency = useCallback(
        (currency: string) => {
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
        (currency: string) => {
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

    // Enforce USD rule: at least one currency must be USD
    useEffect(() => {
        if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
            // Neither is USD, set source to USD and keep destination as user specified
            updateUrlParams({ from: 'USD' })
        }
    }, [sourceCurrency, destinationCurrency, updateUrlParams])

    // Update URL when source amount changes (only for valid numbers)
    useEffect(() => {
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
    const deliveryTimeText = useMemo(() => {
        return destinationCurrency === 'USD' ? 'Should arrive in hours.' : 'Should arrive in minutes.'
    }, [destinationCurrency])

    return (
        <div className="btn btn-shadow-primary-4 mx-auto mt-12 flex h-fit w-full flex-col items-center justify-center gap-4 bg-white p-7 md:w-[420px]">
            <div className="w-full">
                <h2 className="text-left text-sm">You Send</h2>
                <div className="btn btn-shadow-primary-4 mt-2 flex w-full items-center justify-center gap-4 bg-white p-4">
                    {isLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-8 w-40 animate-pulse rounded-full bg-grey-2" />
                        </div>
                    ) : (
                        <input
                            min={0}
                            placeholder="0"
                            value={sourceAmount === '' ? '' : sourceAmount}
                            onChange={(e) => {
                                const inputValue = e.target.value
                                if (inputValue === '') {
                                    handleSourceAmountChange('')
                                } else {
                                    const value = parseFloat(inputValue)
                                    handleSourceAmountChange(isNaN(value) ? '' : value)
                                }
                            }}
                            type="number"
                            className="w-full bg-transparent outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={sourceCurrency}
                        setSelectedCurrency={setSourceCurrency}
                        // excludeCurrencies={[destinationCurrency]}
                        trigger={
                            <button className="flex w-20 items-center gap-2">
                                <Image
                                    src={`https://flagcdn.com/w320/${sourceCurrencyFlag}.png`}
                                    alt={`${sourceCurrencyFlag} flag`}
                                    width={160}
                                    height={160}
                                    className="size-4 rounded-full object-cover"
                                />
                                {sourceCurrency} <Icon name="chevron-down" className="text-gray-1" size={10} />
                            </button>
                        }
                    />
                </div>
            </div>

            <div className="w-full">
                <h2 className="text-left text-sm">Recipient Gets</h2>
                <div className="btn btn-shadow-primary-4 mt-2 flex w-full items-center justify-center gap-4 bg-white p-4">
                    {isLoading ? (
                        <div className="flex w-full items-center">
                            <div className="h-8 w-40 animate-pulse rounded-full bg-grey-2" />
                        </div>
                    ) : (
                        <input
                            min={0}
                            placeholder="0"
                            value={getDestinationDisplayValue()}
                            onChange={(e) => {
                                const inputValue = e.target.value
                                if (inputValue === '') {
                                    handleDestinationAmountChange('', '')
                                } else {
                                    const value = parseFloat(inputValue)
                                    handleDestinationAmountChange(inputValue, isNaN(value) ? '' : value)
                                }
                            }}
                            type="number"
                            className="w-full bg-transparent outline-none"
                        />
                    )}
                    <CurrencySelect
                        selectedCurrency={destinationCurrency}
                        setSelectedCurrency={setDestinationCurrency}
                        trigger={
                            <button className="flex w-20 items-center gap-2">
                                <Image
                                    src={`https://flagcdn.com/w320/${destinationCurrencyFlag}.png`}
                                    alt={`${destinationCurrencyFlag} flag`}
                                    width={160}
                                    height={160}
                                    className="size-4 rounded-full object-cover"
                                />
                                {destinationCurrency} <Icon name="chevron-down" className="text-gray-1" size={10} />
                            </button>
                        }
                    />
                </div>
            </div>

            <div className="rounded-full bg-grey-4 px-2 py-[2px] text-xs font-bold text-gray-1">
                {isLoading ? (
                    <div className="mx-auto h-3 w-28 animate-pulse rounded-full bg-grey-2" />
                ) : isError ? (
                    <span>Rate currently unavailable</span>
                ) : (
                    <>
                        1 {sourceCurrency} = {exchangeRate.toFixed(4)} {destinationCurrency}
                    </>
                )}
            </div>

            {typeof destinationAmount === 'number' && destinationAmount > 0 && (
                <div className="flex w-full flex-col gap-3 rounded-sm border-[1.15px] border-black px-4 py-2">
                    <div className="flex items-center justify-between">
                        <h2 className="text-left text-sm font-normal">Bank fee</h2>
                        <h2 className="text-left text-sm font-normal">Free!</h2>
                    </div>

                    <div className="flex items-center justify-between">
                        <h2 className="text-left text-sm font-normal">Peanut fee</h2>
                        <h2 className="text-left text-sm font-normal">Free!</h2>
                    </div>
                </div>
            )}

            <Button
                onClick={() => ctaAction(sourceCurrency, destinationCurrency)}
                icon={ctaIcon}
                iconSize={13}
                shadowSize="4"
                className="w-full text-base font-bold"
            >
                {ctaLabel}
            </Button>

            {typeof destinationAmount === 'number' && destinationAmount > 0 && (
                <div className="flex items-center">
                    <Icon name="info" className="text-gray-1" size={10} />
                    <p className="text-xs text-gray-1">{deliveryTimeText}</p>
                </div>
            )}
        </div>
    )
}

export default ExchangeRateWidget
