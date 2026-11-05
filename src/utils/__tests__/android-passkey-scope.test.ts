jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
jest.mock('@/utils/auth-token', () => ({ setAuthToken: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ openCredentialCall: () => undefined }))
import {
    beginAndroidPasskeyScope,
    currentAndroidPasskeyScope,
    enableAndroidPasskeyScopes,
    registerScopeChallenge,
    scopeChallengeCount,
    scopeForChallenge,
} from '../android-passkey-scope'
import { guardPasskeyCeremony, isCeremonyGuardError } from '../passkeyCeremony.utils'

beforeEach(() => {
    jest.useFakeTimers()
    enableAndroidPasskeyScopes()
    ;(globalThis as Record<string, unknown>).__capgoPasskeyShimInstalled = true
})
afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
})

it('expires the owning scope, waits out the grace, then retires it so a retry runs without a restart', async () => {
    let finish!: () => void
    const raw = new Promise<void>((resolve) => {
        finish = resolve
    })
    const result = guardPasskeyCeremony(() => raw).catch((error: Error) => error)
    await jest.advanceTimersByTimeAsync(0)
    const old = currentAndroidPasskeyScope()!
    const cancel = jest.fn()
    old.cancel = cancel
    await jest.advanceTimersByTimeAsync(60000)
    await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(old.expired).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(1)
    let settleRetry!: (value: string) => void
    const retry = jest.fn(() => new Promise<string>((resolve) => (settleRetry = resolve)))
    const next = guardPasskeyCeremony(retry)
    await jest.advanceTimersByTimeAsync(1_999)
    expect(retry).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(retry).toHaveBeenCalledTimes(1)
    const current = currentAndroidPasskeyScope()
    expect(current).not.toBe(old)
    expect(current?.expired).toBe(false)
    // The retired flow ending later leaves the newer scope in place.
    finish()
    await jest.advanceTimersByTimeAsync(0)
    expect(currentAndroidPasskeyScope()).toBe(current)
    settleRetry('new')
    await expect(next).resolves.toBe('new')
    expect(currentAndroidPasskeyScope()).toBeUndefined()
})

it('a tap during the short wait starts as soon as the expired flow stops', async () => {
    let finish!: () => void
    const raw = new Promise<void>((resolve) => {
        finish = resolve
    })
    void guardPasskeyCeremony(() => raw).catch(() => {})
    await jest.advanceTimersByTimeAsync(60000)
    const retry = guardPasskeyCeremony(async () => 'new')
    await jest.advanceTimersByTimeAsync(500)
    finish()
    await expect(retry).resolves.toBe('new')
})

it('recognizes a still-closing request as a guard error', () => {
    expect(isCeremonyGuardError(Object.assign(new Error(), { name: 'PasskeyRequestSettlingError' }))).toBe(true)
})

it('recognizes cleanup uncertainty as a signup guard error with restart handling', () => {
    expect(isCeremonyGuardError(Object.assign(new Error(), { name: 'PasskeyCleanupPendingError' }))).toBe(true)
})

it('a live scope still refuses a second flow', () => {
    const live = beginAndroidPasskeyScope()!
    expect(() => beginAndroidPasskeyScope()).toThrow(expect.objectContaining({ name: 'CeremonyConflictError' }))
    live.finish()
})

it("keeps a retired flow's challenges fenced and drops each flow's challenges when it finishes", () => {
    const retired = beginAndroidPasskeyScope()!
    const retiredScope = currentAndroidPasskeyScope()
    registerScopeChallenge(retiredScope, 'old+/challenge==')
    retired.expire()
    const next = beginAndroidPasskeyScope()!
    registerScopeChallenge(currentAndroidPasskeyScope(), 'new-challenge')
    // Server and shim may differ in base64 alphabet and padding; both name the same flow.
    expect(scopeForChallenge('old-_challenge')).toBe(retiredScope)
    expect(scopeForChallenge('old-_challenge')?.expired).toBe(true)
    next.finish()
    expect(scopeForChallenge('new-challenge')).toBeUndefined()
    expect(scopeForChallenge('old-_challenge')).toBe(retiredScope)
    retired.finish()
    expect(scopeForChallenge('old-_challenge')).toBeUndefined()
    expect(scopeChallengeCount()).toBe(0)
})

it('bounds the challenge registry, evicting the oldest entry first', () => {
    const scope = { expired: true }
    for (let i = 0; i < 20; i++) registerScopeChallenge(scope, `challenge-${i}`)
    expect(scopeChallengeCount()).toBe(16)
    expect(scopeForChallenge('challenge-3')).toBeUndefined()
    expect(scopeForChallenge('challenge-4')).toBe(scope)
    expect(scopeForChallenge('challenge-19')).toBe(scope)
})
