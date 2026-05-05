import { useState, useCallback } from 'react'
import { getCurrencyConfig } from '@/utils/bridge.utils'
import { type CountryData } from '@/components/AddMoney/consts'
import type { Address } from 'viem'
import { getCurrencyPrice } from '@/app/actions/currency'
import { apiFetch } from '@/utils/api-fetch'

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
                const { currency, paymentRail } = getCurrencyConfig(country.id, 'onramp')
                if (usdAmount) {
                    const price = await getCurrencyPrice(currency)
                    amount = (Number(usdAmount) * price.buy).toFixed(2)
                }

                const response = await apiFetch('/bridge/onramp/create', '/api/proxy/bridge/onramp/create', {
                    method: 'POST',
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
                    // parse error body from backend to get specific message
                    let errorMessage = 'Failed to create bank transfer. Please try again or contact support.'
                    setError(errorMessage)
                    throw new Error(errorMessage)
                }

                const onrampData = await response.json()
                return onrampData
            } catch (err) {
                console.error('Error creating onramp:', err)
                // only set generic fallback if no specific error was already set by the !response.ok block
                setError((prev) => prev ?? 'Failed to create bank transfer. Please try again or contact support.')
                throw err
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
