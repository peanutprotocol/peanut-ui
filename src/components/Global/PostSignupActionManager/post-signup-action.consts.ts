import { type IconName } from '../Icons/Icon'

function isRequestDestination(destination: string): boolean {
    if (!destination.startsWith('/') || destination.startsWith('//')) return false
    try {
        const url = new URL(destination, 'https://peanut.invalid')
        const path = url.pathname.replace(/\/$/, '')
        if (path === '/pay-request' || path === '/request/pay') {
            return !!(url.searchParams.get('chargeId')?.trim() || url.searchParams.get('id')?.trim())
        }
        return /^\/[^/]+\/[^/]+$/.test(path) && !!url.searchParams.get('chargeId')?.trim()
    } catch {
        return false
    }
}

/** `copyKey` picks the copy under `home.postVerification` in the app catalogs. */
export const POST_SIGNUP_ACTIONS = [
    {
        // this regex will match any path that contains the word "claim", this helps in determing if the user is coming from a claim link
        pathPattern: /claim/,
        config: {
            copyKey: 'claim',
            icon: 'check' as IconName,
        },
    },
    {
        pathPattern: { test: isRequestDestination },
        config: {
            copyKey: 'request',
            icon: 'check' as IconName,
        },
    },
] as const
