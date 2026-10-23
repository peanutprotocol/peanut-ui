/** Holds an abandoned SDK flow until its options/verify continuation has stopped. */
let enabled = false
export const enableAndroidPasskeyScopes = () => {
    enabled = true
}
export const androidPasskeyScopesEnabled = () => enabled
export type AndroidPasskeyScope = { expired: boolean; cancel?: () => void }
let active: AndroidPasskeyScope | undefined
export const currentAndroidPasskeyScope = () => active
export function beginAndroidPasskeyScope() {
    if (!enabled) return undefined
    if (active)
        throw Object.assign(new Error('A previous passkey flow is still pending'), {
            name: active.expired ? 'PasskeyCleanupPendingError' : 'CeremonyConflictError',
        })
    const scope: AndroidPasskeyScope = { expired: false }
    active = scope
    return {
        expire() {
            scope.expired = true
            scope.cancel?.()
        },
        finish() {
            if (active === scope) active = undefined
        },
    }
}
