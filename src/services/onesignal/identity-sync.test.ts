/** Frozen spec-only acceptance tests. Source: /private/tmp/peanut-push-spec/spec.md. */
import { createPushIdentitySync } from '@/services/onesignal/identity-sync'

function deferred() {
    let resolve!: () => void
    let reject!: (error: Error) => void
    const promise = new Promise<void>((yes, no) => {
        resolve = yes
        reject = no
    })
    return { promise, resolve, reject }
}

function fixture(initialIdentity: string | null = 'persisted-account') {
    const state = { identity: initialIdentity, pushEnabled: true, permission: 'granted' }
    const adapter = {
        init: jest.fn(async (): Promise<void> => undefined),
        login: jest.fn(async (id: string) => { state.identity = id }),
        logout: jest.fn(async () => { state.identity = null }),
        optOut: jest.fn(async () => { state.pushEnabled = false }),
        revokePermission: jest.fn(async () => { state.permission = 'denied' }),
    }
    const getAdapter = jest.fn(async () => adapter)
    const sync = createPushIdentitySync(getAdapter)
    const expectGenericPush = () => {
        expect(state.pushEnabled).toBe(true)
        expect(state.permission).toBe('granted')
        expect(adapter.optOut).not.toHaveBeenCalled()
        expect(adapter.revokePermission).not.toHaveBeenCalled()
    }
    return { state, adapter, getAdapter, sync, expectGenericPush }
}

// Deterministic microtask budget, with no provider calls or wall-clock sleeps.
async function until(predicate: () => boolean) {
    for (let i = 0; i < 100 && !predicate(); i += 1) await Promise.resolve()
    expect(predicate()).toBe(true)
}

describe('push identity accepted contract', () => {
    test('initial signed-out state removes a persisted account while preserving generic push', async () => {
        const f = fixture()
        await f.sync.setExternalId(null)
        expect(f.state.identity).toBeNull()
        expect(f.adapter.logout).toHaveBeenCalledTimes(1)
        f.expectGenericPush()
    })

    test('a nonempty account ID becomes the SDK identity', async () => {
        const f = fixture(null)
        await f.sync.setExternalId('account-A')
        expect(f.state.identity).toBe('account-A')
        expect(f.adapter.login).toHaveBeenCalledWith('account-A')
        f.expectGenericPush()
    })

    test('empty ID never reaches SDK login, whether rejected or normalized', async () => {
        const f = fixture(null)
        await f.sync.setExternalId('').catch(() => undefined)
        expect(f.adapter.login).not.toHaveBeenCalled()
        expect(f.state.identity).not.toBe('')
        f.expectGenericPush()
    })

    test.each([null, 'account-A'])('successful duplicates are idempotent: %s', async (id) => {
        const f = fixture()
        await f.sync.setExternalId(id)
        const calls = { init: f.adapter.init.mock.calls.length, login: f.adapter.login.mock.calls.length, logout: f.adapter.logout.mock.calls.length }
        await f.sync.setExternalId(id)
        expect(f.state.identity).toBe(id)
        expect(f.adapter.init).toHaveBeenCalledTimes(calls.init)
        expect(f.adapter.login).toHaveBeenCalledTimes(calls.login)
        expect(f.adapter.logout).toHaveBeenCalledTimes(calls.logout)
        f.expectGenericPush()
    })

    test.each([null, 'account-A'])('pending duplicates join the same SDK operation: %s', async (id) => {
        const f = fixture()
        const gate = deferred()
        const started = deferred()
        const operation = async () => { started.resolve(); await gate.promise; f.state.identity = id }
        if (id === null) f.adapter.logout.mockImplementationOnce(operation)
        else f.adapter.login.mockImplementationOnce(operation)
        const first = f.sync.setExternalId(id)
        await started.promise
        let secondSettled = false
        const second = f.sync.setExternalId(id).then(() => { secondSettled = true })
        for (let i = 0; i < 20; i += 1) await Promise.resolve()
        expect(secondSettled).toBe(false)
        gate.resolve()
        await Promise.all([first, second])
        expect(f.state.identity).toBe(id)
        expect(id === null ? f.adapter.logout : f.adapter.login).toHaveBeenCalledTimes(1)
        f.expectGenericPush()
    })

    test('failed unlink rejects and an identical request retries', async () => {
        const f = fixture()
        const error = new Error('unlink unavailable')
        f.adapter.logout.mockRejectedValueOnce(error)
        await expect(f.sync.setExternalId(null)).rejects.toThrow('unlink unavailable')
        expect(f.state.identity).toBe('persisted-account')
        await f.sync.setExternalId(null)
        expect(f.state.identity).toBeNull()
        expect(f.adapter.logout).toHaveBeenCalledTimes(2)
        f.expectGenericPush()
    })

    test('failed login rejects and an identical request retries', async () => {
        const f = fixture(null)
        f.adapter.login.mockRejectedValueOnce(new Error('login unavailable'))
        await expect(f.sync.setExternalId('account-A')).rejects.toThrow('login unavailable')
        expect(f.state.identity).toBeNull()
        await f.sync.setExternalId('account-A')
        expect(f.state.identity).toBe('account-A')
        expect(f.adapter.login).toHaveBeenCalledTimes(2)
        f.expectGenericPush()
    })

    test('failed initialization rejects and does not poison identical retry', async () => {
        const f = fixture()
        f.adapter.init.mockRejectedValueOnce(new Error('init unavailable'))
        await expect(f.sync.setExternalId(null)).rejects.toThrow('init unavailable')
        expect(f.state.identity).toBe('persisted-account')
        await f.sync.setExternalId(null)
        expect(f.adapter.init).toHaveBeenCalledTimes(2)
        expect(f.state.identity).toBeNull()
        f.expectGenericPush()
    })

    test('logout requested during initialization wins after initialization completes', async () => {
        const f = fixture()
        const gate = deferred()
        f.adapter.init.mockImplementationOnce(() => gate.promise)
        const login = f.sync.setExternalId('account-A')
        await until(() => f.adapter.init.mock.calls.length === 1)
        const logout = f.sync.setExternalId(null)
        gate.resolve()
        await Promise.all([login, logout])
        expect(f.state.identity).toBeNull()
        f.expectGenericPush()
    })

    test.each([null, 'account-B'])('latest identity %s wins over an in-flight login', async (latest) => {
        const f = fixture()
        const gate = deferred()
        f.adapter.login.mockImplementationOnce(async (id) => { await gate.promise; f.state.identity = id })
        const first = f.sync.setExternalId('account-A')
        await until(() => f.adapter.login.mock.calls.length === 1)
        const next = f.sync.setExternalId(latest)
        gate.resolve()
        await Promise.all([first, next])
        expect(f.state.identity).toBe(latest)
        f.expectGenericPush()
    })

    test('returning to the former identity while logout is pending reapplies the latest desire', async () => {
        const f = fixture(null)
        await f.sync.setExternalId('account-A')
        const gate = deferred()
        f.adapter.logout.mockImplementationOnce(async () => { await gate.promise; f.state.identity = null })
        const logout = f.sync.setExternalId(null)
        await until(() => f.adapter.logout.mock.calls.length === 1)
        const login = f.sync.setExternalId('account-A')
        gate.resolve()
        await Promise.all([logout, login])
        expect(f.state.identity).toBe('account-A')
        f.expectGenericPush()
    })

    test('factory instances have independent identity state', async () => {
        const one = fixture()
        const two = fixture()
        await one.sync.setExternalId(null)
        await two.sync.setExternalId(null)
        expect(one.state.identity).toBeNull()
        expect(two.state.identity).toBeNull()
        expect(one.adapter.logout).toHaveBeenCalledTimes(1)
        expect(two.adapter.logout).toHaveBeenCalledTimes(1)
        one.expectGenericPush()
        two.expectGenericPush()
    })

    test('all 81 length-four sequential operation sequences converge at every step', async () => {
        const alphabet = [null, 'account-A', 'account-B'] as const
        for (let seed = 0; seed < 81; seed += 1) {
            const f = fixture()
            let code = seed
            for (let step = 0; step < 4; step += 1) {
                const desired = alphabet[code % 3]
                code = Math.floor(code / 3)
                await f.sync.setExternalId(desired)
                expect({ seed, step, identity: f.state.identity }).toEqual({ seed, step, identity: desired })
                f.expectGenericPush()
            }
        }
    })
})
