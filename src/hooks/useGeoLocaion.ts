'use client'
import { useEffect, useState } from 'react'

/**
 * Used to get the user's country code from ipapi.co
 * @returns {object} An object containing the country code, whether the request is loading, and any error that occurred
 */
export const useGeoLocaion = () => {
    const [countryCode, setCountryCode] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        // use ipapi.co to get the user's country code
        const fetchCountry = async () => {
            try {
                const response = await fetch('https://ipapi.co/country')
                if (!response.ok) {
                    throw new Error('Failed to fetch country')
                }
                const countryCode = await response.text()
                setCountryCode(countryCode)
            } catch (err: any) {
                setError(err.message)
            } finally {
                setIsLoading(false)
            }
        }

        fetchCountry()
    }, [])

    return { countryCode, isLoading, error }
}
