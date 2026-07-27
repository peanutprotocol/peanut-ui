import { removeFromCookie, updateUserPreferences } from './general.utils'
import { clearAuthToken } from './auth-token'
import * as Sentry from '@sentry/nextjs'

/**
 * Clears authentication state without making API calls or showing UI feedback.
 * Useful for cleaning up after failed registration attempts.
 *
 * This prevents users from getting stuck in an unrecoverable state where
 * auth cookies exist but no backend user record exists.
 *
 * @param userId - Optional user ID for clearing user-scoped preferences
 */
export const clearAuthState = async (userId?: string) => {
    try {
        // Clear user preferences if userId available
        if (userId) {
            updateUserPreferences(userId, { webAuthnKey: undefined })
        }

        // Clear cookies (always do this, even if no userId)
        removeFromCookie('web-authn-key')

        // Clear the JWT everywhere it can live — on native that's Preferences +
        // the in-memory cache, not the cookie this used to expire by hand.
        await clearAuthToken()

        console.log('Cleared auth state', { userId: userId || 'none' })
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error clearing auth state:', error)
    }
}
