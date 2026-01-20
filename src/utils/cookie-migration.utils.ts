import { cookies } from 'next/headers'

/**
 * Migration utility to refresh JWT cookies from sameSite='strict' to sameSite='lax'
 * 
 * This function should be called whenever we successfully read a JWT token from cookies.
 * It re-sets the cookie with the correct sameSite attribute, ensuring users with old
 * 'strict' cookies get automatically migrated to 'lax' on their next successful request.
 * 
 * Context: Security PR added sameSite='strict' which broke authentication flows.
 * This auto-migration ensures existing users don't get stuck when we deploy the fix.
 * 
 * Can be safely removed after all production users have been migrated (estimated: 30 days after deploy)
 */
export async function refreshJWTCookieIfNeeded(token: string) {
    try {
        const cookieStore = await cookies()
        
        // Re-set the cookie with the correct sameSite='lax' attribute
        // This will overwrite the old cookie and update its sameSite setting
        cookieStore.set('jwt-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax', // Migration: strict → lax
            maxAge: 30 * 24 * 60 * 60, // 30 days (same as backend)
        })
    } catch (error) {
        // Don't fail the request if cookie refresh fails
        console.warn('Failed to refresh JWT cookie:', error)
    }
}
