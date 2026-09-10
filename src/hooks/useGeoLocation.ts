'use client'
import { useEffect, useState } from 'react'

// cache key for session storage
const GEO_CACHE_KEY = 'user_geo_country_code'
const GEO_CACHE_TIMESTAMP_KEY = 'user_geo_country_code_timestamp'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

// in-memory cache to share across all hook instances in the same session
let memoryCache: { countryCode: string | null; timestamp: number } | null = null

/**
 * used to get the user's country code from ipapi.co with caching
 * caches result in sessionStorage and memory to avoid refetching on every mount
 * @returns {object} an object containing the country code, whether the request is loading, and any error that occurred
 */
/**
 * The in-memory hit, read during render so a warm cache paints the country on
 * the FIRST frame instead of flipping a select from its placeholder one frame
 * later. Deliberately NOT sessionStorage: this is also read during prerender,
 * where storage does not exist and a client-only value would desync hydration.
 * memoryCache is null on the server and on the first client render, so both
 * sides agree.
 */
const freshMemoryCountry = (): string | null =>
    memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION ? memoryCache.countryCode : null

export const useGeoLocation = () => {
    const [countryCode, setCountryCode] = useState<string | null>(freshMemoryCountry)
    const [isLoading, setIsLoading] = useState(() => freshMemoryCountry() === null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchCountry = async () => {
            try {
                // check memory cache first (fastest)
                if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION) {
                    setCountryCode(memoryCache.countryCode)
                    setIsLoading(false)
                    return
                }

                // check sessionStorage cache (survives component unmount/remount)
                const cachedCode = sessionStorage.getItem(GEO_CACHE_KEY)
                const cachedTimestamp = sessionStorage.getItem(GEO_CACHE_TIMESTAMP_KEY)

                if (cachedCode && cachedTimestamp) {
                    const timestamp = parseInt(cachedTimestamp, 10)
                    if (Date.now() - timestamp < CACHE_DURATION) {
                        // use cached value
                        setCountryCode(cachedCode)
                        memoryCache = { countryCode: cachedCode, timestamp }
                        setIsLoading(false)
                        return
                    }
                }

                // no valid cache, fetch from api
                const response = await fetch('https://ipapi.co/country')
                if (!response.ok) {
                    throw new Error('Failed to fetch country')
                }
                const fetchedCountryCode = await response.text()
                const timestamp = Date.now()

                // save to both caches
                setCountryCode(fetchedCountryCode)
                sessionStorage.setItem(GEO_CACHE_KEY, fetchedCountryCode)
                sessionStorage.setItem(GEO_CACHE_TIMESTAMP_KEY, timestamp.toString())
                memoryCache = { countryCode: fetchedCountryCode, timestamp }
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err))
            } finally {
                setIsLoading(false)
            }
        }

        fetchCountry()
    }, [])

    return { countryCode, isLoading, error }
}
