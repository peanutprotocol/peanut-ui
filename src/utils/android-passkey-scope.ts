/** Holds an abandoned SDK flow until its options/verify continuation has stopped. */
let enabled = false
export const enableAndroidPasskeyScopes = () => {
    enabled = true
}
export const androidPasskeyScopesEnabled = () => enabled
export type AndroidPasskeyScope = { expired: boolean; cancel?: () => void }
let active: { scope: AndroidPasskeyScope; finished: Promise<void> } | undefined
export const currentAndroidPasskeyScope = () => active?.scope

/** Waits, at most `ms`, for an expired flow to stop before a new one may begin. */
export function waitForExpiredAndroidPasskeyScope(ms: number): Promise<void> | undefined {
    const pending = active
    if (!pending?.scope.expired) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([
        pending.finished,
        new Promise<void>((resolve) => {
            timer = setTimeout(resolve, ms)
        }),
    ]).finally(() => clearTimeout(timer))
}

export function beginAndroidPasskeyScope() {
    if (!enabled) return undefined
    if (active)
        // An expired flow that has not stopped could still open a prompt; it ends on its own, so retrying works.
        throw Object.assign(new Error('A previous passkey flow is still pending'), {
            name: active.scope.expired ? 'PasskeyRequestSettlingError' : 'CeremonyConflictError',
        })
    const scope: AndroidPasskeyScope = { expired: false }
    let markFinished!: () => void
    const entry = { scope, finished: new Promise<void>((resolve) => (markFinished = resolve)) }
    active = entry
    return {
        expire() {
            scope.expired = true
            scope.cancel?.()
        },
        finish() {
            if (active === entry) active = undefined
            markFinished()
        },
    }
}
