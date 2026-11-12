import { apiFetch } from '@/utils/api-fetch'
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

export type UsernameReservationResult = 'reserved' | 'taken' | 'invalid' | 'unavailable'

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
            })
            if (response.ok) return 'reserved'
            const body = await response.json().catch(() => ({}))
            if (response.status === 409 && ['USERNAME_TAKEN', 'USERNAME_RESERVED'].includes(body?.code)) return 'taken'
            if (response.status === 400 && body?.code === 'USERNAME_INVALID') return 'invalid'
            if (response.status === 400 && body?.code === 'HOLD_TOKEN_REQUIRED' && attempt === 0) {
                token = await getUsernameHoldToken(true)
                continue
            }
            return 'unavailable'
        }
    } catch {}
    return 'unavailable'
}

export async function releaseUsernameReservation(): Promise<void> {
    const token = await restoreSignupValue(TOKEN_KEY)
    if (!token || !TOKEN.test(token)) return
    try {
        await apiFetch('/users/username/reservations', {
            method: 'DELETE',
            headers: { 'x-username-hold': token },
            includeAuth: false,
            timeoutMs: 5000,
            redactTelemetry: true,
        })
    } catch {}
}
