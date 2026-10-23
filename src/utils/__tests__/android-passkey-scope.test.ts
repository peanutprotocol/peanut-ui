jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => true }))
jest.mock('@/utils/auth-token', () => ({ setAuthToken: jest.fn() }))
jest.mock('@/utils/sentry-lazy', () => ({ captureException: jest.fn(), addBreadcrumb: jest.fn() }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({ openCredentialCall: () => undefined }))
import { enableAndroidPasskeyScopes, currentAndroidPasskeyScope } from '../android-passkey-scope'
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

it('expires the owning scope, blocks retries until the raw SDK stops, then allows a new ceremony', async () => {
    let finish!: () => void
    const raw = new Promise<void>((resolve) => {
        finish = resolve
    })
    const result = guardPasskeyCeremony(() => raw).catch((error: Error) => error)
    await jest.advanceTimersByTimeAsync(0)
    const cancel = jest.fn()
    currentAndroidPasskeyScope()!.cancel = cancel
    await jest.advanceTimersByTimeAsync(60000)
    await expect(result).resolves.toMatchObject({ name: 'CeremonyTimeoutError' })
    expect(currentAndroidPasskeyScope()?.expired).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(1)
    const retry = jest.fn(async () => 'unsafe')
    await expect(guardPasskeyCeremony(retry)).rejects.toMatchObject({ name: 'PasskeyCleanupPendingError' })
    expect(retry).not.toHaveBeenCalled()
    finish()
    await jest.advanceTimersByTimeAsync(0)
    await expect(guardPasskeyCeremony(async () => 'new')).resolves.toBe('new')
})

it('recognizes cleanup uncertainty as a signup guard error with restart handling', () => {
    expect(isCeremonyGuardError(Object.assign(new Error(), { name: 'PasskeyCleanupPendingError' }))).toBe(true)
})
