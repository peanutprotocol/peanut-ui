import {
    CeremonyTimeoutError,
    PasskeyShimNotReadyError,
    isPasskeyShimInstalled,
    raceCeremonyTimeout,
    waitForPasskeyShim,
} from '../passkeyCeremony.utils'

const SHIM_FLAG = '__capgoPasskeyShimInstalled'

const setShimFlag = (value: unknown) => {
    ;(globalThis as Record<string, unknown>)[SHIM_FLAG] = value
}

afterEach(() => {
    delete (globalThis as Record<string, unknown>)[SHIM_FLAG]
    jest.useRealTimers()
})

describe('isPasskeyShimInstalled', () => {
    it('is true only for the exact boolean true', () => {
        expect(isPasskeyShimInstalled()).toBe(false)
        setShimFlag('true')
        expect(isPasskeyShimInstalled()).toBe(false)
        setShimFlag(true)
        expect(isPasskeyShimInstalled()).toBe(true)
    })
})

describe('waitForPasskeyShim', () => {
    it('resolves immediately when the shim is already installed', async () => {
        setShimFlag(true)
        await expect(waitForPasskeyShim(50)).resolves.toBeUndefined()
    })

    it('resolves when the shim installs mid-wait', async () => {
        const pending = waitForPasskeyShim(2000)
        setTimeout(() => setShimFlag(true), 150)
        await expect(pending).resolves.toBeUndefined()
    })

    it('rejects with PasskeyShimNotReadyError when the shim never installs', async () => {
        await expect(waitForPasskeyShim(250)).rejects.toBeInstanceOf(PasskeyShimNotReadyError)
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
