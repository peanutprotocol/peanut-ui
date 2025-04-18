/**
 * checks if there's a valid JWT token in cookies and if it hasn't expired
 * @returns boolean indicating if a valid JWT token exists
 */
export const hasValidJwtToken = (): boolean => {
    if (typeof document === 'undefined') return false

    const cookies = document.cookie.split(';')
    const jwtCookie = cookies.find((cookie) => cookie.trim().startsWith('jwt-token='))

    if (!jwtCookie) return false

    const token = jwtCookie.split('=')[1]
    if (!token) return false

    // validation - check if token has three parts separated by dots
    const parts = token.split('.')
    if (parts.length !== 3) return false

    try {
        // decode payload (middle part) to check expiration
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))

        // check if token has an expiration claim
        if (!payload.exp) return true // if no expiration, consider it valid

        // check if token has expired
        const expirationTime = payload.exp * 1000 // convert to milliseconds
        const currentTime = Date.now()

        return currentTime < expirationTime
    } catch (error) {
        console.error('Error parsing JWT token:', error)
        return false
    }
}
