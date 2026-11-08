/** Holds an abandoned SDK flow until its options/verify continuation stops or its grace runs out. */
let enabled = false
export const enableAndroidPasskeyScopes = () => {
    enabled = true
}
export const androidPasskeyScopesEnabled = () => enabled
export type AndroidPasskeyScope = { expired: boolean; cancel?: () => void }
let active: { scope: AndroidPasskeyScope; finished: Promise<void> } | undefined
export const currentAndroidPasskeyScope = () => active?.scope

/** Waits, at most `ms`, for an expired flow to stop before a new one retires it. */
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

/*
 * A native call is attributed to the flow whose options response carried its challenge, not to
 * whichever scope is current when it arrives: a retired flow that wakes up under a newer scope
 * must still be refused. Signing passes its challenge to native in the tick its scope begins.
 */
const MAX_SCOPE_CHALLENGES = 16
const challengeScopes = new Map<string, AndroidPasskeyScope>()
const normalizeChallenge = (challenge: string) => challenge.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function registerScopeChallenge(scope: AndroidPasskeyScope | undefined, challenge: unknown): void {
    if (!scope || typeof challenge !== 'string' || !challenge) return
    const key = normalizeChallenge(challenge)
    challengeScopes.delete(key)
    challengeScopes.set(key, scope)
    if (challengeScopes.size > MAX_SCOPE_CHALLENGES) challengeScopes.delete(challengeScopes.keys().next().value!)
}

export const scopeForChallenge = (challenge: unknown): AndroidPasskeyScope | undefined =>
    typeof challenge === 'string' ? challengeScopes.get(normalizeChallenge(challenge)) : undefined

export const scopeChallengeCount = () => challengeScopes.size

export function beginAndroidPasskeyScope() {
    if (!enabled) return undefined
    // An expired flow the caller has already waited out is retired; its challenges stay fenced.
    if (active && !active.scope.expired)
        throw Object.assign(new Error('A previous passkey flow is still pending'), { name: 'CeremonyConflictError' })
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
            for (const [challenge, owner] of challengeScopes) if (owner === scope) challengeScopes.delete(challenge)
            markFinished()
        },
    }
}
