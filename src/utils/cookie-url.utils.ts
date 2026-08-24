/**
 * Cookie read/write and same-origin redirect sanitising.
 *
 * Kept apart from `general.utils` so the handful of modules that need only
 * these — deep-link handling, deferred links — don't pull that module's chain
 * and token catalogs (189 KB of JSON) into their bundle. `general.utils`
 * re-exports them, so existing importers are unaffected.
 */
import * as Sentry from '@/utils/sentry-lazy'
export function jsonStringify(data: unknown): string {
    return JSON.stringify(data, (_key, value) => {
        if ('bigint' === typeof value) {
            return {
                '@type': 'BigInt',
                value: value.toString(),
            }
        }
        return value
    })
}

export function jsonParse<T = ReturnType<typeof JSON.parse>>(data: string): T {
    return JSON.parse(data, (_key, value) => {
        if (value && typeof value === 'object' && value['@type'] === 'BigInt') {
            return BigInt(value.value)
        }
        return value
    })
}

export const saveToCookie = (key: string, data: unknown, expiryDays?: number) => {
    if (typeof document === 'undefined') return
    try {
        // Convert the data to a string before storing it in cookies
        const serializedData = jsonStringify(data)

        let cookieString = `${key}=${encodeURIComponent(serializedData)}`

        if (expiryDays) {
            const expiryDate = new Date(new Date().getTime() + expiryDays * 24 * 60 * 60 * 1000)
            cookieString += `; expires=${expiryDate.toUTCString()}`
        }

        // Add default cookie attributes for security
        // Only add Secure flag in HTTPS contexts to avoid breaking local development
        const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'
        cookieString += `; path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`

        document.cookie = cookieString
        console.log(`Saved ${key} to cookie:`, data)
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error saving to cookie:', error)
    }
}

export const getFromCookie = (key: string) => {
    if (typeof document === 'undefined') return
    try {
        const cookies = document.cookie.split(';')
        const targetCookie = cookies.find((cookie) => {
            const [cookieKey] = cookie.trim().split('=')
            return cookieKey === key
        })

        if (!targetCookie) {
            console.log(`No data found in cookie for ${key}`)
            return null
        }

        const [, ...cookieValueParts] = targetCookie.split('=')
        const cookieValue = cookieValueParts.join('=') // Handle cases where value contains '='
        const decodedValue = decodeURIComponent(cookieValue)

        const parsedData = jsonParse(decodedValue)
        console.log(`Retrieved ${key} from cookie:`, parsedData)
        return parsedData
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error getting data from cookie:', error)
        return null
    }
}

export const sanitizeRedirectURL = (redirectUrl: string): string | null => {
    try {
        const u = new URL(redirectUrl, window.location.origin)
        // Only allow same-origin URLs
        if (u.origin === window.location.origin) {
            return u.pathname + u.search + u.hash
        }
        console.log('Rejecting off-origin URL:', redirectUrl)
        // Reject off-origin URLs
        return null
    } catch {
        // For strings that can't be parsed as URLs, only allow relative paths
        if (redirectUrl.startsWith('/') && !redirectUrl.startsWith('//')) {
            // Additional check: ensure it doesn't contain a protocol
            if (!redirectUrl.includes('://')) {
                return redirectUrl
            }
        }
        // Reject anything else (including protocol-relative URLs like //evil.com)
        return null
    }
}
