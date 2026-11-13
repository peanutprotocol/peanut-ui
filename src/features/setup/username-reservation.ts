import { apiFetch } from '@/utils/api-fetch'
import { captureMessage } from '@/utils/sentry-lazy'
import { restoreSignupValue, storeSignupValue } from './signup-storage'

const TOKEN_KEY = 'peanut:username-hold:v1'
const TOKEN = /^[A-Za-z0-9_-]{43}$/
let preparingToken: Promise<string> | null = null
let sessionToken: string | null = null

function newToken(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

export async function getUsernameHoldToken(regenerate = false): Promise<string> {
    if (preparingToken) return preparingToken
    const prepare = async () => {
        const stored = regenerate ? null : await restoreSignupValue(TOKEN_KEY)
        const token = stored && TOKEN.test(stored) ? stored : !regenerate && sessionToken ? sessionToken : newToken()
        sessionToken = token
        await storeSignupValue(TOKEN_KEY, token)
        return token
    }
    preparingToken = prepare()
    try {
        return await preparingToken
    } finally {
        preparingToken = null
    }
}

// 'refused': the name is off limits (a route, a campaign code, or one that
// impersonates Peanut, e.g. contains "peanut"), not malformed.
// 404: the API that serves holds is not deployed yet. Anything else unexpected is reported here,
// since the calls opt out of the fetch layer's own failure events.
function reportHoldFailure(operation: 'reserve' | 'release', status: number | 'network'): void {
    if (status === 404) return
    try {
        captureMessage('username hold request failed', {
            level: 'warning',
            tags: { feature: 'username_hold', operation, status: String(status) },
        })
    } catch {}
}

export type UsernameReservationResult = 'reserved' | 'taken' | 'refused' | 'invalid' | 'unavailable'

const RESERVED_REASON = 'This username is reserved'

export async function reserveUsername(username: string): Promise<UsernameReservationResult> {
    try {
        let token = await getUsernameHoldToken()
        for (let attempt = 0; attempt < 2; attempt++) {
            const response = await apiFetch('/users/username/reservations', {
                method: 'POST',
                headers: { 'x-username-hold': token },
                body: JSON.stringify({ username }),
                includeAuth: false,
                timeoutMs: 5000,
                redactTelemetry: true,
                callerReportsFailures: true,
            })
            if (response.ok) return 'reserved'
            const body = await response.json().catch(() => ({}))
            if (response.status === 409 && ['USERNAME_TAKEN', 'USERNAME_RESERVED'].includes(body?.code)) return 'taken'
            if (response.status === 400 && body?.code === 'USERNAME_INVALID')
                return body?.reason === RESERVED_REASON ? 'refused' : 'invalid'
            if (response.status === 400 && body?.code === 'HOLD_TOKEN_REQUIRED' && attempt === 0) {
                token = await getUsernameHoldToken(true)
                continue
            }
            reportHoldFailure('reserve', response.status)
            return 'unavailable'
        }
    } catch {
        reportHoldFailure('reserve', 'network')
    }
    return 'unavailable'
}

export async function clearUsernameHoldToken(): Promise<void> {
    // Join a restore already in flight so it cannot put the old token back.
    await preparingToken?.catch(() => {})
    sessionToken = null
    await storeSignupValue(TOKEN_KEY, null)
}

export async function releaseUsernameReservation(): Promise<void> {
    try {
        const token = await restoreSignupValue(TOKEN_KEY)
        if (!token || !TOKEN.test(token)) return
        const response = await apiFetch('/users/username/reservations', {
            method: 'DELETE',
            headers: { 'x-username-hold': token },
            includeAuth: false,
            timeoutMs: 5000,
            redactTelemetry: true,
            callerReportsFailures: true,
        })
        if (!response.ok) reportHoldFailure('release', response.status)
    } catch {
        // The server-side hold expires even if release cannot reach the API.
        reportHoldFailure('release', 'network')
    } finally {
        await clearUsernameHoldToken()
    }
}
