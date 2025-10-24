'use client'
import { useMemo } from 'react'
import { useGeoLocation } from './useGeoLocation'
import { ACTION_METHODS, type PaymentMethod } from '@/constants/actionlist.consts'

/**
 * hook to filter and sort payment options based on user's geolocation
 *
 * filters pix to show only in brazil (BR) and mercado pago to show everywhere except brazil
 * optionally sorts payment methods to move unavailable ones to the end of the list
 *
 * @param options - configuration object
 * @param options.methods - array of payment methods to filter (defaults to ACTION_METHODS)
 * @param options.sortUnavailable - whether to sort unavailable methods to the end (defaults to false)
 * @param options.isMethodUnavailable - optional function to determine if a method is unavailable for custom sorting logic
 * @returns object containing filtered and sorted payment methods and loading state
 *
 * @example
 * // basic usage with default ACTION_METHODS
 * const { filteredMethods, isLoading } = useGeoFilteredPaymentOptions()
 *
 * @example
 * // with custom methods and sorting
 * const { filteredMethods } = useGeoFilteredPaymentOptions({
 *   methods: customMethods,
 *   sortUnavailable: true,
 *   isMethodUnavailable: (method) => method.soon || method.requiresVerification
 * })
 */
export const useGeoFilteredPaymentOptions = (
    options: {
        methods?: PaymentMethod[]
        sortUnavailable?: boolean
        isMethodUnavailable?: (method: PaymentMethod) => boolean
    } = {}
) => {
    const { methods = ACTION_METHODS, sortUnavailable = false, isMethodUnavailable } = options
    const { countryCode, isLoading } = useGeoLocation()

    const filteredAndSortedMethods = useMemo(() => {
        // filter methods based on geolocation
        const filtered = methods.filter((method) => {
            // show pix only in brazil
            if (countryCode === 'BR' && method.id === 'mercadopago') {
                return false
            }
            // show mercado pago everywhere except brazil
            if (countryCode !== 'BR' && method.id === 'pix') {
                return false
            }
            return true
        })

        // optionally sort unavailable methods to the end
        if (sortUnavailable && isMethodUnavailable) {
            return [...filtered].sort((a, b) => {
                const aIsUnavailable = isMethodUnavailable(a)
                const bIsUnavailable = isMethodUnavailable(b)

                // keep original order if both are available or both are unavailable
                if (aIsUnavailable === bIsUnavailable) {
                    return 0
                }
                // move unavailable methods to the end
                return aIsUnavailable ? 1 : -1
            })
        }

        return filtered
    }, [countryCode, methods, sortUnavailable, isMethodUnavailable])

    return {
        filteredMethods: filteredAndSortedMethods,
        isLoading,
        countryCode,
    }
}
