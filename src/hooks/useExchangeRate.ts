import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from './useDebounce'
import { useQuery } from '@tanstack/react-query'
import { isCapacitor } from '@/utils/capacitor'
import { getCurrencyPrice } from '@/app/actions/currency'

type InputValue = number | ''

interface UseExchangeRateProps {
    sourceCurrency: string
    destinationCurrency: string
    initialSourceAmount?: number
    enabled?: boolean
}

interface UseExchangeRateReturn {
    sourceAmount: InputValue
    destinationAmount: InputValue
    destinationInputValue: string
    exchangeRate: number
    isLoading: boolean
    isError: boolean
    handleSourceAmountChange: (amount: InputValue) => void
    handleDestinationAmountChange: (inputValue: string, amount: InputValue) => void
    getDestinationDisplayValue: () => string
}

export function useExchangeRate({
    sourceCurrency,
    destinationCurrency,
    initialSourceAmount = 10,
    enabled = true,
}: UseExchangeRateProps): UseExchangeRateReturn {
    // State
    const [sourceAmount, setSourceAmount] = useState<InputValue>(initialSourceAmount)
    const [destinationAmount, setDestinationAmount] = useState<InputValue>('')
    const [destinationInputValue, setDestinationInputValue] = useState('')
    const [lastEditedField, setLastEditedField] = useState<'source' | 'destination' | null>(null)

    // Debounced values
    const debouncedSourceAmount = useDebounce(sourceAmount, 500)
    const debouncedDestinationAmount = useDebounce(destinationAmount, 500)

    // Utility functions
    const isValidAmount = (amount: InputValue): amount is number => typeof amount === 'number' && amount > 0

    const clearDestinationFields = () => {
        setDestinationAmount('')
        setDestinationInputValue('')
    }

    const updateDestinationFromCalculation = (calculatedAmount: number) => {
        setDestinationAmount(calculatedAmount)
        setDestinationInputValue(calculatedAmount.toFixed(2))
    }

    // Handlers
    const handleSourceAmountChange = useCallback((amount: InputValue) => {
        setSourceAmount(amount)
        setLastEditedField('source')
    }, [])

    const handleDestinationAmountChange = useCallback((inputValue: string, amount: InputValue) => {
        setDestinationInputValue(inputValue)
        setDestinationAmount(amount)
        setLastEditedField('destination')
    }, [])

    const getDestinationDisplayValue = useCallback(() => {
        if (lastEditedField === 'destination') {
            return destinationInputValue
        }

        if (destinationAmount === '') {
            return ''
        }

        return typeof destinationAmount === 'number' ? destinationAmount.toFixed(2) : String(destinationAmount)
    }, [lastEditedField, destinationInputValue, destinationAmount])

    // Client-side cached exchange rate (5 minutes)
    const {
        data: rateData,
        isFetching,
        isError,
    } = useQuery<{ rate: number }>({
        queryKey: ['exchangeRate', sourceCurrency, destinationCurrency],
        queryFn: async () => {
            if (isCapacitor()) {
                // in capacitor, no /api/ route exists. use getCurrencyPrice (client-side)
                // and frankfurter as fallback — same logic as the next.js api route
                const from = sourceCurrency.toUpperCase()
                const to = destinationCurrency.toUpperCase()
                if (from === to) return { rate: 1 }
                try {
                    const price = await getCurrencyPrice(from === 'USD' ? to : from)
                    const rate = from === 'USD' ? price.sell : 1 / price.buy
                    if (isFinite(rate) && rate > 0) return { rate }
                } catch {}
                // fallback to frankfurter (public api)
                const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
                if (res.ok) {
                    const data = await res.json()
                    return { rate: data.rates[to] * 0.995 }
                }
                throw new Error('Failed to fetch exchange rate')
            }
            const res = await fetch(`/api/exchange-rate?from=${sourceCurrency}&to=${destinationCurrency}`)
            if (!res.ok) throw new Error('Failed to fetch exchange rate')
            return res.json()
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // garbage collect after 10 minutes
        refetchOnWindowFocus: true, // Refresh rates when user returns to tab
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
        enabled: enabled && !!sourceCurrency && !!destinationCurrency,
    })

    const exchangeRate = rateData?.rate ?? 0
    const isLoading = isFetching

    // Recalculate amounts when debounced inputs or rate changes (no extra loading toggles)
    useEffect(() => {
        if (exchangeRate <= 0) return

        const hasValidSource = isValidAmount(debouncedSourceAmount)
        const hasValidDestination = isValidAmount(debouncedDestinationAmount)

        if (lastEditedField === 'source') {
            if (!hasValidSource) {
                clearDestinationFields()
                return
            }
            const calculatedAmount = debouncedSourceAmount * exchangeRate
            updateDestinationFromCalculation(calculatedAmount)
            return
        }

        if (lastEditedField === 'destination') {
            if (!hasValidDestination) {
                setSourceAmount('')
                return
            }
            const calculatedSourceAmount = debouncedDestinationAmount / exchangeRate
            setSourceAmount(parseFloat(calculatedSourceAmount.toFixed(2)))
            return
        }

        // Initial load - calculate destination from source
        if (!lastEditedField && hasValidSource) {
            const calculatedAmount = debouncedSourceAmount * exchangeRate
            updateDestinationFromCalculation(calculatedAmount)
        }
    }, [debouncedSourceAmount, debouncedDestinationAmount, lastEditedField, exchangeRate])

    // Update source amount when initial amount changes
    useEffect(() => {
        setSourceAmount(initialSourceAmount)
    }, [initialSourceAmount])

    return {
        sourceAmount,
        destinationAmount,
        destinationInputValue,
        exchangeRate,
        isLoading,
        isError,
        handleSourceAmountChange,
        handleDestinationAmountChange,
        getDestinationDisplayValue,
    }
}
