// tests for the module-level app-lock registry

type LockModule = typeof import('../app-lock-state')
let lock: LockModule

function loadModule(): void {
    jest.isolateModules(() => {
        lock = require('../app-lock-state')
    })
}

describe('app-lock-state', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        loadModule()
    })

    it('starts unlocked', () => {
        expect(lock.getLockState()).toBe('unlocked')
    })

    it('notifies subscribers on every transition and supports unsubscribe', () => {
        const cb = jest.fn()
        const unsubscribe = lock.subscribeLockState(cb)

        lock.setLockState('locked')
        expect(lock.getLockState()).toBe('locked')
        expect(cb).toHaveBeenCalledTimes(1)

        // no-op transition does not notify
        lock.setLockState('locked')
        expect(cb).toHaveBeenCalledTimes(1)

        unsubscribe()
        lock.setLockState('unlocked')
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it('dispatches the app-lock:changed window event with the new state', () => {
        const events: unknown[] = []
        const listener = (e: Event) => events.push((e as CustomEvent).detail)
        window.addEventListener(lock.APP_LOCK_CHANGED_EVENT, listener)

        lock.setLockState('locked')
        lock.setLockState('unlocked')
        expect(events).toEqual(['locked', 'unlocked'])

        window.removeEventListener(lock.APP_LOCK_CHANGED_EVENT, listener)
    })
})
