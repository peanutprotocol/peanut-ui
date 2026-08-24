import {
    CeremonyTimeoutError,
    PasskeyShimFailedError,
    PasskeyShimNotReadyError,
    currentCeremonyId,
    guardPasskeyCeremony,
    isCeremonyGuardError,
    isCeremonyStillActive,
    isPasskeyShimInstalled,
    markPasskeyShimFailed,
    raceCeremonyTimeout,
    waitForPasskeyShim,
} from '../passkeyCeremony.utils'
import { isCapacitor } from '@/utils/capacitor'

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(() => false) }))
const mockIsCapacitor = isCapacitor as jest.Mock

const SHIM_INSTALLED = '__capgoPasskeyShimInstalled'
const SHIM_FAILED = '__capgoPasskeyShimFailed'

const setGlobal = (key: string, value: unknown) => {
    ;(globalThis as Record<string, unknown>)[key] = value
}

afterEach(() => {
    delete (globalThis as Record<string, unknown>)[SHIM_INSTALLED]
    delete (globalThis as Record<string, unknown>)[SHIM_FAILED]
    mockIsCapacitor.mockReset()
    mockIsCapacitor.mockReturnValue(false)
    jest.useRealTimers()
})

describe('isPasskeyShimInstalled', () => {
    it('is true only for the exact boolean true', () => {
        expect(isPasskeyShimInstalled()).toBe(false)
        setGlobal(SHIM_INSTALLED, 'true')
        expect(isPasskeyShimInstalled()).toBe(false)
        setGlobal(SHIM_INSTALLED, true)
        expect(isPasskeyShimInstalled()).toBe(true)
    })
})

describe('waitForPasskeyShim', () => {
    it('resolves immediately when the shim is already installed', async () => {
        setGlobal(SHIM_INSTALLED, true)
        await expect(waitForPasskeyShim(50)).resolves.toBeUndefined()
    })

    it('resolves when the shim installs mid-wait', async () => {
        jest.useFakeTimers()
        const pending = waitForPasskeyShim(2000)
        setTimeout(() => setGlobal(SHIM_INSTALLED, true), 300)
        await jest.advanceTimersByTimeAsync(500)
        await expect(pending).resolves.toBeUndefined()
    })

    it('rejects with PasskeyShimNotReadyError when the shim never installs', async () => {
        jest.useFakeTimers()
        const pending = waitForPasskeyShim(250)
        const assertion = expect(pending).rejects.toBeInstanceOf(PasskeyShimNotReadyError)
        await jest.advanceTimersByTimeAsync(400)
        await assertion
    })

    it('rejects immediately with PasskeyShimFailedError when the install is known-dead', async () => {
        markPasskeyShimFailed()
        await expect(waitForPasskeyShim(3000)).rejects.toBeInstanceOf(PasskeyShimFailedError)
    })
})

describe('raceCeremonyTimeout', () => {
    it('passes through a resolving promise', async () => {
        await expect(raceCeremonyTimeout(Promise.resolve('key'), 1000)).resolves.toBe('key')
    })

    it('passes through a rejecting promise', async () => {
        await expect(raceCeremonyTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom')
    })

    it('rejects with CeremonyTimeoutError when the ceremony never settles', async () => {
        jest.useFakeTimers()
        const never = new Promise<never>(() => {})
        const raced = raceCeremonyTimeout(never, 60_000)
        const assertion = expect(raced).rejects.toBeInstanceOf(CeremonyTimeoutError)
        jest.advanceTimersByTime(60_000)
        await assertion
    })

    it('a late resolution after timeout is discarded (rejection already settled the race)', async () => {
        jest.useFakeTimers()
        let resolveLate!: (v: string) => void
        const late = new Promise<string>((resolve) => {
            resolveLate = resolve
        })
        const raced = raceCeremonyTimeout(late, 1_000)
        const assertion = expect(raced).rejects.toBeInstanceOf(CeremonyTimeoutError)
        jest.advanceTimersByTime(1_000)
        await assertion
        resolveLate('too-late') // must not turn the settled rejection into a success
        await expect(raced).rejects.toBeInstanceOf(CeremonyTimeoutError)
    })
})

describe('guardPasskeyCeremony', () => {
    it('web: runs the ceremony unraced and untracked-gated (no shim requirement)', async () => {
        await expect(guardPasskeyCeremony(() => Promise.resolve('ok'))).resolves.toBe('ok')
    })

    it('native: rejects before starting the ceremony when the shim install failed', async () => {
        mockIsCapacitor.mockReturnValue(true)
        markPasskeyShimFailed()
        const ceremony = jest.fn()
        await expect(guardPasskeyCeremony(ceremony)).rejects.toBeInstanceOf(PasskeyShimFailedError)
        expect(ceremony).not.toHaveBeenCalled()
    })

    it('native: runs and resolves when the shim is installed', async () => {
        mockIsCapacitor.mockReturnValue(true)
        setGlobal(SHIM_INSTALLED, true)
        await expect(guardPasskeyCeremony(() => Promise.resolve('key'))).resolves.toBe('key')
    })

    it('registers a ceremony id only while in flight (token-capture window)', async () => {
        expect(currentCeremonyId()).toBeNull()
        let resolveCeremony!: (v: string) => void
        const pending = guardPasskeyCeremony(
            () =>
                new Promise<string>((resolve) => {
                    resolveCeremony = resolve
                })
        )
        // ceremony started (web path: no shim wait, so the window is open synchronously-ish)
        await Promise.resolve()
        const id = currentCeremonyId()
        expect(id).not.toBeNull()
        expect(isCeremonyStillActive(id)).toBe(true)
        resolveCeremony('done')
        await pending
        expect(currentCeremonyId()).toBeNull()
        expect(isCeremonyStillActive(id)).toBe(false)
    })

    it('closes the window when the ceremony times out (late token must not be captured)', async () => {
        mockIsCapacitor.mockReturnValue(true)
        setGlobal(SHIM_INSTALLED, true)
        jest.useFakeTimers()
        const pending = guardPasskeyCeremony(() => new Promise<never>(() => {}))
        const assertion = expect(pending).rejects.toBeInstanceOf(CeremonyTimeoutError)
        await Promise.resolve()
        const idA = currentCeremonyId()
        await jest.advanceTimersByTimeAsync(60_000)
        await assertion
        expect(isCeremonyStillActive(idA)).toBe(false)
        expect(currentCeremonyId()).toBeNull()
    })

    it('A times out, retry B starts, A’s late verify must still be rejected while B is active', async () => {
        mockIsCapacitor.mockReturnValue(true)
        setGlobal(SHIM_INSTALLED, true)
        jest.useFakeTimers()
        // ceremony A: hangs, times out at 60s
        const pendingA = guardPasskeyCeremony(() => new Promise<never>(() => {}))
        const assertionA = expect(pendingA).rejects.toBeInstanceOf(CeremonyTimeoutError)
        await Promise.resolve()
        const idA = currentCeremonyId() // what A's verify request was issued under
        await jest.advanceTimersByTimeAsync(60_000)
        await assertionA
        // ceremony B (the retry) starts and is in flight
        let resolveB!: (v: string) => void
        const pendingB = guardPasskeyCeremony(
            () =>
                new Promise<string>((resolve) => {
                    resolveB = resolve
                })
        )
        await Promise.resolve()
        const idB = currentCeremonyId()
        // A's late verify response lands now: bound to idA, NOT accepted just
        // because B holds the window open
        expect(isCeremonyStillActive(idA)).toBe(false)
        expect(isCeremonyStillActive(idB)).toBe(true)
        resolveB('done')
        await pendingB
    })
})

describe('isCeremonyGuardError', () => {
    it('recognizes exactly the guard errors', () => {
        expect(isCeremonyGuardError(new CeremonyTimeoutError(1))).toBe(true)
        expect(isCeremonyGuardError(new PasskeyShimNotReadyError(1))).toBe(true)
        expect(isCeremonyGuardError(new PasskeyShimFailedError())).toBe(true)
        expect(isCeremonyGuardError(new Error('NotAllowedError'))).toBe(false)
        expect(isCeremonyGuardError('nope')).toBe(false)
    })
})
