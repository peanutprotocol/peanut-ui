import { useState, useEffect, useCallback } from 'react'
import { useDebounce } from './useDebounce'

type InputValue = number | ''

interface UseExchangeRateProps {
    sourceCurrency: string
    destinationCurrency: string
    initialSourceAmount?: number
}

interface UseExchangeRateReturn {
    sourceAmount: InputValue
    destinationAmount: InputValue
    destinationInputValue: string
    exchangeRate: number
    isLoading: boolean
    handleSourceAmountChange: (amount: InputValue) => void
    handleDestinationAmountChange: (inputValue: string, amount: InputValue) => void
    getDestinationDisplayValue: () => string
}

export function useExchangeRate({
    sourceCurrency,
    destinationCurrency,
    initialSourceAmount = 10,
}: UseExchangeRateProps): UseExchangeRateReturn {
    // State
    const [sourceAmount, setSourceAmount] = useState<InputValue>(initialSourceAmount)
    const [destinationAmount, setDestinationAmount] = useState<InputValue>('')
    const [destinationInputValue, setDestinationInputValue] = useState('')
    const [exchangeRate, setExchangeRate] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
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

    // Exchange rate API call and calculations
    useEffect(() => {
        const fetchExchangeRateAndCalculate = async () => {
            setIsLoading(true)

            try {
                const response = await fetch(`/api/exchange-rate?from=${sourceCurrency}&to=${destinationCurrency}`)
                const data = await response.json()
                setExchangeRate(data.rate)

                // Handle empty field clearing after we have the exchange rate
                if (lastEditedField === 'source' && !isValidAmount(debouncedSourceAmount)) {
                    clearDestinationFields()
                    return
                }

                if (lastEditedField === 'destination' && !isValidAmount(debouncedDestinationAmount)) {
                    setSourceAmount('')
                    return
                }

                // Check if we have valid amounts to calculate with
                const hasValidSource = isValidAmount(debouncedSourceAmount)
                const hasValidDestination = isValidAmount(debouncedDestinationAmount)

                // Calculate based on which field was last edited
                if (lastEditedField === 'source' && hasValidSource) {
                    const calculatedAmount = debouncedSourceAmount * data.rate
                    updateDestinationFromCalculation(calculatedAmount)
                } else if (lastEditedField === 'destination' && hasValidDestination) {
                    const calculatedSourceAmount = debouncedDestinationAmount / data.rate
                    setSourceAmount(parseFloat(calculatedSourceAmount.toFixed(2)))
                } else if (!lastEditedField && hasValidSource) {
                    // Initial load - calculate destination from source
                    const calculatedAmount = debouncedSourceAmount * data.rate
                    updateDestinationFromCalculation(calculatedAmount)
                }
            } catch (error) {
                console.error('Error fetching exchange rate:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchExchangeRateAndCalculate()
    }, [sourceCurrency, destinationCurrency, debouncedSourceAmount, debouncedDestinationAmount, lastEditedField])

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
        handleSourceAmountChange,
        handleDestinationAmountChange,
        getDestinationDisplayValue,
    }
}
