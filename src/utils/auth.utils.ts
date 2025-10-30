import { removeFromCookie, updateUserPreferences } from './general.utils'
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
export const clearAuthState = (userId?: string) => {
    try {
        // Clear user preferences if userId available
        if (userId) {
            updateUserPreferences(userId, { webAuthnKey: undefined })
        }

        // Clear cookies (always do this, even if no userId)
        removeFromCookie('web-authn-key')

        // Clear JWT cookie
        if (typeof document !== 'undefined') {
            document.cookie = 'jwt-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;'
        }

        console.log('Cleared auth state', { userId: userId || 'none' })
    } catch (error) {
        Sentry.captureException(error)
        console.error('Error clearing auth state:', error)
    }
}
