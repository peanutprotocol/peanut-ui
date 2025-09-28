import { useState, useCallback } from 'react'
import Cookies from 'js-cookie'
import { getCurrencyConfig } from '@/utils/bridge.utils'
import { CountryData } from '@/components/AddMoney/consts'
import type { Address } from 'viem'
import { getCurrencyPrice } from '@/app/actions/currency'

export type CreateOnrampParams = {
    country: CountryData
    chargeId?: string
    recipientAddress?: Address
} & (
    | {
          amount: string
          usdAmount?: undefined
      }
    | {
          amount?: undefined
          usdAmount: string
      }
)

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

    const createOnramp = useCallback(
        async ({ amount, country, chargeId, recipientAddress, usdAmount }: CreateOnrampParams) => {
            setIsLoading(true)
            setError(null)

            try {
                const jwtToken = Cookies.get('jwt-token')

                const { currency, paymentRail } = getCurrencyConfig(country.id, 'onramp')
                if (usdAmount) {
                    // Get currency configuration for the country
                    const price = await getCurrencyPrice(currency)
                    amount = (Number(usdAmount) * price).toFixed(2)
                }

                // Call backend to create onramp via proxy route
                const response = await fetch('/api/proxy/bridge/onramp/create', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${jwtToken}`,
                    },
                    body: JSON.stringify({
                        amount,
                        chargeId,
                        source: {
                            currency,
                            paymentRail,
                        },
                        recipientAddress,
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
        },
        []
    )

    return {
        createOnramp,
        isLoading,
        error,
    }
}
