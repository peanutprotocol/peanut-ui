import { cookies } from 'next/headers'

// TODO: Consider migrating to a more secure cookie architecture:
// 1. Set cookie with `domain: '.peanut.me'` so it's sent to all subdomains
// 2. Use `credentials: 'include'` in fetch calls instead of manual Authorization headers
// 3. Update backend CORS to allow credentials + read JWT from Cookie header
// 4. Re-enable httpOnly once client-side code no longer needs to read the token
// This would eliminate the need for js-cookie reads while maintaining httpOnly security.

export async function getJWTCookie() {
    const cookieStore = await cookies()
    const cookie = cookieStore.get('jwt-token')

    if (cookie?.value) {
        try {
            cookieStore.set('jwt-token', cookie.value, {
                httpOnly: false, // Required for client-side services to read token (see TODO above)
                secure: process.env.NODE_ENV === 'production',
                path: '/',
                sameSite: 'lax',
                maxAge: 30 * 24 * 60 * 60,
            })
        } catch (error) {
            console.warn('Failed to refresh JWT cookie:', error)
        }
    }

    return cookie
}
