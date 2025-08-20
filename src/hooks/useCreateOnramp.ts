import { useState, useCallback } from 'react'
import Cookies from 'js-cookie'
import { getCurrencyConfig } from '@/utils/onramp.utils'
import { CountryData } from '@/components/AddMoney/consts'

export interface CreateOnrampParams {
    amount: string
    country: CountryData
}

export interface UseCreateOnrampReturn {
    createOnramp: (params: CreateOnrampParams) => Promise<any>
    isLoading: boolean
    error: string | null
}

/**
 * Custom hook for creating onramp transactions
 */
export const useCreateOnramp = (): UseCreateOnrampReturn => {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const createOnramp = useCallback(async ({ amount, country }: CreateOnrampParams) => {
        setIsLoading(true)
        setError(null)

        try {
            const jwtToken = Cookies.get('jwt-token')

            // Get currency configuration for the country
            const { currency, paymentRail } = getCurrencyConfig(country.id)

            // Call backend to create onramp via proxy route
            const response = await fetch('/api/proxy/bridge/onramp/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${jwtToken}`,
                },
                body: JSON.stringify({
                    amount,
                    source: {
                        currency,
                        paymentRail,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const onrampData = await response.json()
            return onrampData
        } catch (error) {
            console.error('Error creating onramp:', error)
            setError('Failed to create bank transfer. Please try again.')
            throw error
        } finally {
            setIsLoading(false)
        }
    }, [])

    return {
        createOnramp,
        isLoading,
        error,
    }
}
