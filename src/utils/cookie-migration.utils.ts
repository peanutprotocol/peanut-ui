import { cookies } from 'next/headers'

export async function getJWTCookie() {
    const cookieStore = await cookies()
    const cookie = cookieStore.get('jwt-token')

    if (cookie?.value) {
        try {
            cookieStore.set('jwt-token', cookie.value, {
                httpOnly: true,
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
