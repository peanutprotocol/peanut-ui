'use client'
import { useEffect, useState } from 'react'

// cache key for session storage
const GEO_CACHE_KEY = 'user_geo_country_code'
const GEO_CACHE_TIMESTAMP_KEY = 'user_geo_country_code_timestamp'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
// The lookup only sorts lists. Past this it answers "unknown", so no screen
// waits on a third party that has stopped answering (TASK-22967).
export const GEO_LOOKUP_TIMEOUT_MS = 3000

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
const hasFreshMemoryCache = (): boolean => !!memoryCache && Date.now() - memoryCache.timestamp < CACHE_DURATION
const freshMemoryCountry = (): string | null => (hasFreshMemoryCache() ? memoryCache!.countryCode : null)

export const useGeoLocation = () => {
    const [countryCode, setCountryCode] = useState<string | null>(freshMemoryCountry)
    const [isLoading, setIsLoading] = useState(() => !hasFreshMemoryCache())
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const controller = new AbortController()
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            controller.abort()
        }, GEO_LOOKUP_TIMEOUT_MS)
        const fetchCountry = async () => {
            try {
                // check memory cache first (fastest)
                if (hasFreshMemoryCache()) {
                    setCountryCode(memoryCache!.countryCode)
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
                const response = await fetch('https://ipapi.co/country', { signal: controller.signal })
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
                // A timed-out lookup is remembered as "unknown" for this session
                // (memory only), so the next mount does not wait another 3 s.
                if (timedOut) memoryCache = { countryCode: null, timestamp: Date.now() }
                setError(err instanceof Error ? err.message : String(err))
            } finally {
                clearTimeout(timeout)
                setIsLoading(false)
            }
        }

        fetchCountry()
        return () => {
            clearTimeout(timeout)
            controller.abort()
        }
    }, [])

    return { countryCode, isLoading, error }
}
