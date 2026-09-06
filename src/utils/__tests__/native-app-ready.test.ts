import { NATIVE_APP_READY_SCRIPT, markNativeBootComplete } from '../native-app-ready'

/**
 * The whole point of this script is that it runs with no chunk loaded, so it
 * is tested the way it ships: the raw string, executed against shadowed
 * globals, exactly like the chunk-error-recovery script next to it.
 */
function bootScript({
    plugin = true,
    failures,
    brokenStorage = false,
}: { plugin?: boolean; failures?: number; brokenStorage?: boolean } = {}) {
    const notifyAppReady = jest.fn()
    const reset = jest.fn()
    const store = new Map<string, string>()
    if (failures !== undefined) store.set('peanutNativeBootIncomplete', String(failures))

    const localStorage = brokenStorage
        ? {
              getItem: () => {
                  throw new Error('denied')
              },
              setItem: () => {
                  throw new Error('denied')
              },
              removeItem: () => {
                  throw new Error('denied')
              },
          }
        : {
              getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
              setItem: (k: string, v: string) => {
                  store.set(k, v)
              },
              removeItem: (k: string) => {
                  store.delete(k)
              },
          }

    const win = {
        Capacitor: plugin ? { Plugins: { CapacitorUpdater: { notifyAppReady, reset } } } : undefined,
        localStorage,
    }
    new Function('window', 'localStorage', NATIVE_APP_READY_SCRIPT)(win, localStorage)
    return { notifyAppReady, reset, store }
}

describe('NATIVE_APP_READY_SCRIPT', () => {
    it('calls notifyAppReady straight off the bridge stub, with no chunk loaded', () => {
        const { notifyAppReady } = bootScript()
        expect(notifyAppReady).toHaveBeenCalled()
    })

    it('no-ops off native, where the bridge exposes no plugin', () => {
        const { notifyAppReady, reset } = bootScript({ plugin: false })
        expect(notifyAppReady).not.toHaveBeenCalled()
        expect(reset).not.toHaveBeenCalled()
    })

    it('counts the launch as incomplete until the app clears it', () => {
        const { store } = bootScript()
        expect(store.get('peanutNativeBootIncomplete')).toBe('1')
    })

    /*
     * Calling notifyAppReady this early gives up Capgo's rollback net, and this
     * is what replaces it. Capgo could not tell a bundle whose JS is broken from
     * one the OS froze mid-boot and rolled back on both; a frozen boot resumes
     * and clears the counter, a broken one never does.
     */
    it('falls back to the builtin bundle after three launches that never rendered', () => {
        const { notifyAppReady, reset, store } = bootScript({ failures: 3 })
        expect(reset).toHaveBeenCalled()
        expect(notifyAppReady).not.toHaveBeenCalled()
        expect(store.has('peanutNativeBootIncomplete')).toBe(false)
    })

    it('keeps marking ready below the limit, so one slow launch costs nothing', () => {
        const { notifyAppReady, reset } = bootScript({ failures: 2 })
        expect(notifyAppReady).toHaveBeenCalled()
        expect(reset).not.toHaveBeenCalled()
    })

    it('still marks ready when storage is unavailable', () => {
        // No storage means the counter never accumulates either, so there is
        // nothing to protect against — refusing to notify would roll back every
        // bundle on a private-mode or storage-less WebView.
        const { notifyAppReady, reset } = bootScript({ brokenStorage: true })
        expect(notifyAppReady).toHaveBeenCalled()
        expect(reset).not.toHaveBeenCalled()
    })
})

describe('markNativeBootComplete', () => {
    it('clears the counter, so only consecutive dead launches accumulate', () => {
        window.localStorage.setItem('peanutNativeBootIncomplete', '2')
        markNativeBootComplete()
        expect(window.localStorage.getItem('peanutNativeBootIncomplete')).toBeNull()
    })
})
