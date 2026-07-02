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

// shared so the hook, the page catch, and their tests can't drift apart.
export const GENERIC_ONRAMP_ERROR = 'Failed to create bank transfer. Please try again or contact support.'

export interface UseCreateOnrampReturn {
    createOnramp: (params: CreateOnrampParams) => Promise<any>
    isLoading: boolean
}

/**
 * Custom hook for creating onramp transactions.
 *
 * The specific failure reason travels via the thrown Error's message — the
 * caller shows `error.message` directly. We deliberately do NOT expose a React
 * `error` state: reading it in a synchronous catch sees the pre-flush (stale)
 * value, which is the silent-failure bug this hook was fixed for.
 */
export const useCreateOnramp = (): UseCreateOnrampReturn => {
    const [isLoading, setIsLoading] = useState(false)

    const createOnramp = useCallback(
        async ({ amount, country, chargeId, recipientAddress, usdAmount }: CreateOnrampParams) => {
            setIsLoading(true)

            try {
                const { currency, paymentRail } = getCurrencyConfig(country.id, 'onramp')
                if (usdAmount) {
                    const price = await getCurrencyPrice(currency)
                    amount = (Number(usdAmount) * price.buy).toFixed(2)
                }

                const response = await apiFetch('/bridge/onramp/create', {
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
                    // Only trust the backend's error copy for client errors (4xx) —
                    // those are deliberate, user-actionable messages from the route
                    // (ToS-not-accepted, KYC/endorsement needed, Bridge decline).
                    // 5xx bodies carry raw internal messages (the global handler only
                    // sanitizes Prisma), so surfacing them would leak internals — fall
                    // back to the generic string instead.
                    const isClientError = response.status >= 400 && response.status < 500
                    const body = isClientError ? await response.json().catch(() => null) : null
                    throw new Error(body?.error || body?.message || GENERIC_ONRAMP_ERROR)
                }

                const onrampData = await response.json()
                return onrampData
            } catch (err) {
                console.error('Error creating onramp:', err)
                throw err instanceof Error ? err : new Error(GENERIC_ONRAMP_ERROR)
            } finally {
                setIsLoading(false)
            }
        },
        []
    )

    return {
        createOnramp,
        isLoading,
    }
}
