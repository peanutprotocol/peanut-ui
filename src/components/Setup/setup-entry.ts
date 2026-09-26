import { USER_PREFERENCES_KEY_SUFFIX, WEB_AUTHN_COOKIE_KEY } from '@/constants/auth.consts'
import type { ScreenId } from './Setup.types'

export type SetupEntryStep = Extract<ScreenId, 'landing' | 'signup'>

export interface SetupEntryInput {
    /** An invite code from the store, the cookie or `?code=`. */
    hasInviteCode: boolean
    /** The legacy `?step=` param: `signup` skips the invite gate, `login` lands on Log In. */
    stepParam: string | null
    /** Native-migration notice window on web: signups are closed, so nothing may skip the landing gate. */
    webSignupClosed: boolean
    /** Durable passkey credentials on this device (see hasKnownDeviceCredentials). */
    knownDevice: boolean
}

/**
 * The first screen /setup shows. Pure so the routing rules are testable; the
 * page only maps the result to a step index.
 *
 * A live session never reaches this decision — the existing-session effect on
 * the page redirects or prompts before any step renders — so `knownDevice`
 * means "credentials without a session": a returning user who must be able to
 * log in, whatever invite code or `?step=` the entry link carries.
 */
export function resolveSetupEntryStep(input: SetupEntryInput): SetupEntryStep {
    if (input.knownDevice || input.stepParam === 'login') return 'landing'
    // ?step=signup is what every campaign entrypoint sends. Neither it nor an
    // invite may skip the landing gate while web signups are closed.
    const skipInviteGate = (input.hasInviteCode || input.stepParam === 'signup') && !input.webSignupClosed
    return skipInviteGate ? 'signup' : 'landing'
}

function hasCookie(key: string): boolean {
    return document.cookie.split(';').some((entry) => {
        const [name, ...value] = entry.trim().split('=')
        return name === key && value.join('=') !== ''
    })
}

/**
 * True when this device holds a passkey credential from an earlier
 * registration: the `web-authn-key` cookie, or a `webAuthnKey` inside any
 * `<userId>:user-preferences` entry (the cookie can expire first).
 */
function hasStoredWebAuthnKey(raw: string | null): boolean {
    try {
        const prefs: unknown = JSON.parse(raw ?? 'null')
        return !!prefs && typeof prefs === 'object' && !!(prefs as { webAuthnKey?: unknown }).webAuthnKey
    } catch {
        return false
    }
}

export function hasKnownDeviceCredentials(): boolean {
    if (typeof document === 'undefined') return false
    try {
        if (hasCookie(WEB_AUTHN_COOKIE_KEY)) return true
        for (let index = 0; index < localStorage.length; index++) {
            const key = localStorage.key(index)
            if (key?.endsWith(USER_PREFERENCES_KEY_SUFFIX) && hasStoredWebAuthnKey(localStorage.getItem(key))) {
                return true
            }
        }
    } catch {
        // storage unavailable — treat as an unknown device
    }
    return false
}
