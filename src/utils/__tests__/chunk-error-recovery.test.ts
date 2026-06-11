import { CHUNK_ERROR_RECOVERY_SCRIPT, isChunkLoadError, recoverFromChunkError } from '../chunk-error-recovery'

type Listener = (event: { reason?: unknown; error?: unknown; message?: string }) => void

/**
 * Executes the inline script string against shadowed globals so we test the
 * exact code that ships in the HTML, without fighting jsdom's read-only
 * window.location.
 */
function bootScript({
    standalone = false,
    brokenStorage = false,
}: { standalone?: boolean; brokenStorage?: boolean } = {}) {
    const listeners: Record<string, Listener[]> = {}
    const reload = jest.fn()
    const store = new Map<string, string>()
    const win = {
        addEventListener: (type: string, fn: Listener) => {
            ;(listeners[type] = listeners[type] || []).push(fn)
        },
        matchMedia: (_query: string) => ({ matches: standalone }),
        location: { reload },
    }
    const sessionStorage = brokenStorage
        ? {
              getItem: () => {
                  throw new Error('denied')
              },
              setItem: () => {
                  throw new Error('denied')
              },
          }
        : {
              getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
              setItem: (k: string, v: string) => {
                  store.set(k, v)
              },
          }
    new Function('window', 'sessionStorage', 'navigator', CHUNK_ERROR_RECOVERY_SCRIPT)(win, sessionStorage, {})

    const emitRejection = (reason: unknown) => listeners['unhandledrejection'].forEach((fn) => fn({ reason }))
    const emitError = (event: { error?: unknown; message?: string }) => listeners['error'].forEach((fn) => fn(event))
    return { reload, store, emitRejection, emitError }
}

const chunkError = () =>
    Object.assign(new Error('Loading chunk 110 failed.\n(error: https://peanut.me/_next/static/chunks/110-x.js)'), {
        name: 'ChunkLoadError',
    })

describe('CHUNK_ERROR_RECOVERY_SCRIPT', () => {
    it('reloads once on an unhandled ChunkLoadError rejection', () => {
        const { reload, emitRejection } = bootScript()
        emitRejection(chunkError())
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('matches by message when the error name is lost (minified rethrow)', () => {
        const { reload, emitRejection } = bootScript()
        emitRejection(new Error('Loading chunk 5142 failed.\n(timeout: https://peanut.me/_next/static/chunks/x.js)'))
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('catches chunk errors surfaced through window.onerror', () => {
        const { reload, emitError } = bootScript()
        emitError({ message: 'Uncaught ChunkLoadError: Loading CSS chunk 42 failed' })
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('does not reload again within the guard window (no reload loop)', () => {
        const { reload, emitRejection } = bootScript()
        emitRejection(chunkError())
        emitRejection(chunkError())
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('ignores non-chunk errors', () => {
        const { reload, emitRejection, emitError } = bootScript()
        emitRejection(new Error('Failed to fetch'))
        emitRejection('some string rejection')
        emitRejection(undefined)
        emitError({ message: 'ResizeObserver loop limit exceeded' })
        expect(reload).not.toHaveBeenCalled()
    })

    it('does not auto-reload in standalone PWA mode (Android redirect-loop hazard)', () => {
        const { reload, emitRejection } = bootScript({ standalone: true })
        emitRejection(chunkError())
        expect(reload).not.toHaveBeenCalled()
    })

    it('does not auto-reload when sessionStorage is unavailable (no loop protection)', () => {
        const { reload, emitRejection } = bootScript({ brokenStorage: true })
        emitRejection(chunkError())
        expect(reload).not.toHaveBeenCalled()
    })
})

describe('isChunkLoadError', () => {
    it.each([
        ['ChunkLoadError by name', chunkError()],
        ['message-only chunk failure', new Error('Loading chunk 9654 failed.\n(error: https://x/9654.js)')],
        ['CSS chunk failure', new Error('Loading CSS chunk 42 failed')],
        ['dynamic import failure', new Error('Failed to fetch dynamically imported module: https://x/y.js')],
        ['string form', 'ChunkLoadError: Loading chunk 1 failed'],
    ])('matches %s', (_label, error) => {
        expect(isChunkLoadError(error)).toBe(true)
    })

    it.each([
        ['plain fetch failure', new Error('Failed to fetch')],
        ['undefined', undefined],
        ['null', null],
        ['unrelated string', 'something broke'],
    ])('rejects %s', (_label, error) => {
        expect(isChunkLoadError(error)).toBe(false)
    })
})

describe('recoverFromChunkError', () => {
    const originalLocation = window.location
    let reload: jest.Mock

    beforeEach(() => {
        sessionStorage.clear()
        reload = jest.fn()
        Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, writable: true })
    })

    afterEach(() => {
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    })

    it('reloads once for a chunk error and returns true', () => {
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('returns false and skips reload for non-chunk errors', () => {
        expect(recoverFromChunkError(new Error('Failed to fetch'))).toBe(false)
        expect(reload).not.toHaveBeenCalled()
    })

    it('shares the guard with the inline script (no second reload within 60s)', () => {
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(recoverFromChunkError(chunkError())).toBe(false)
        expect(reload).toHaveBeenCalledTimes(1)
    })
})
