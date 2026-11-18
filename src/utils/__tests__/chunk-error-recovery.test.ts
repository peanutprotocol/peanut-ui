import {
    CHUNK_ERROR_RECOVERY_SCRIPT,
    importWithChunkRetry,
    isChunkLoadError,
    recoverFromChunkError,
} from '../chunk-error-recovery'

type Listener = (event: { reason?: unknown; error?: unknown; message?: string }) => void

/**
 * Executes the inline script string against shadowed globals so we test the
 * exact code that ships in the HTML, without fighting jsdom's read-only
 * window.location.
 */
function bootScript({
    standalone = false,
    brokenStorage = false,
    markerFailure = false,
    domFailure = false,
    timerFailure = false,
}: {
    standalone?: boolean
    brokenStorage?: boolean
    markerFailure?: boolean
    domFailure?: boolean
    timerFailure?: boolean
} = {}) {
    const listeners: Record<string, Listener[]> = {}
    const reload = jest.fn()
    const store = new Map<string, string>()
    const style = { visibility: '' }
    const document = {
        get documentElement() {
            if (domFailure) throw new Error('DOM unavailable')
            return { style }
        },
    }
    const schedule = (fn: () => void, ms: number) => {
        if (timerFailure) throw new Error('timer unavailable')
        return setTimeout(fn, ms)
    }
    const location = {
        reload,
        pathname: '/send',
        search: '?secret=abc',
        hash: '#private',
        href: 'https://peanut.me/send?secret=abc#private',
    }
    const win = {
        document,
        setTimeout: schedule,
        addEventListener: (type: string, fn: Listener) => {
            ;(listeners[type] = listeners[type] || []).push(fn)
        },
        matchMedia: (_query: string) => ({ matches: standalone }),
        location,
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
                  if (markerFailure && k === 'peanut-chunk-reload-report') throw new Error('quota')
                  store.set(k, v)
              },
          }
    new Function(
        'window',
        'sessionStorage',
        'navigator',
        'document',
        'location',
        'setTimeout',
        CHUNK_ERROR_RECOVERY_SCRIPT
    )(win, sessionStorage, {}, document, location, schedule)

    const emitRejection = (reason: unknown) => listeners['unhandledrejection'].forEach((fn) => fn({ reason }))
    const emitError = (event: { error?: unknown; message?: string }) => listeners['error'].forEach((fn) => fn(event))
    return { reload, store, style, emitRejection, emitError }
}

const chunkError = () =>
    Object.assign(new Error('Loading chunk 110 failed.\n(error: https://peanut.me/_next/static/chunks/110-x.js)'), {
        name: 'ChunkLoadError',
    })

describe('CHUNK_ERROR_RECOVERY_SCRIPT', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        jest.setSystemTime(1_800_000_000_000)
    })
    afterEach(() => {
        jest.clearAllTimers()
        jest.useRealTimers()
    })

    it.each(['rejection', 'error-object', 'error-message', 'string'])(
        'records and hides before reload for %s',
        (form) => {
            const harness = bootScript()
            const message = 'Loading chunk 42 failed ' + 'x'.repeat(400)
            harness.reload.mockImplementation(() => {
                expect(JSON.parse(harness.store.get('peanut-chunk-reload-report')!)).toEqual({
                    at: Date.now(),
                    path: '/send',
                    source: 'inline',
                    message: message.slice(0, 300),
                })
                expect(harness.style.visibility).toBe('hidden')
            })
            if (form === 'rejection') harness.emitRejection(new Error(message))
            if (form === 'error-object') harness.emitError({ error: new Error(message) })
            if (form === 'error-message') harness.emitError({ message })
            if (form === 'string') harness.emitRejection(message)
            expect(harness.reload).toHaveBeenCalledTimes(1)
            jest.advanceTimersByTime(3999)
            expect(harness.style.visibility).toBe('hidden')
            jest.advanceTimersByTime(1)
            expect(harness.style.visibility).toBe('')
        }
    )

    it.each([{ standalone: true }, { brokenStorage: true }])('suppresses new effects when blocked: %p', (options) => {
        const harness = bootScript(options)
        harness.emitRejection(chunkError())
        expect(harness.store.has('peanut-chunk-reload-report')).toBe(false)
        expect(harness.style.visibility).toBe('')
        expect(jest.getTimerCount()).toBe(0)
    })

    it('still reloads when only marker writing fails', () => {
        const harness = bootScript({ markerFailure: true })
        expect(() => harness.emitRejection(chunkError())).not.toThrow()
        expect(harness.reload).toHaveBeenCalledTimes(1)
    })

    it.each([{ domFailure: true }, { timerFailure: true }])(
        'still reloads on optional browser operation failure: %p',
        (options) => {
            const harness = bootScript(options)
            expect(() => harness.emitRejection(chunkError())).not.toThrow()
            expect(harness.reload).toHaveBeenCalledTimes(1)
        }
    )

    it('keeps an existing marker and leaves the page visible when the guard blocks reload', () => {
        const harness = bootScript()
        harness.store.set('peanut-chunk-reload-at', String(Date.now()))
        harness.store.set('peanut-chunk-reload-report', 'existing')
        harness.emitRejection(chunkError())
        expect(harness.reload).not.toHaveBeenCalled()
        expect(harness.store.get('peanut-chunk-reload-report')).toBe('existing')
        expect(harness.style.visibility).toBe('')
    })

    it('writes no marker, hides nothing, and schedules nothing when the guard blocks', () => {
        const harness = bootScript()
        harness.store.set('peanut-chunk-reload-at', String(Date.now()))
        harness.emitRejection(chunkError())
        expect(harness.store.has('peanut-chunk-reload-report')).toBe(false)
        expect(harness.style.visibility).toBe('')
        expect(jest.getTimerCount()).toBe(0)
        expect(harness.reload).not.toHaveBeenCalled()
    })
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

    it('does not reload an installed PWA', () => {
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
        jest.useFakeTimers()
        jest.setSystemTime(1_800_000_000_000)
        document.documentElement.style.visibility = ''
        sessionStorage.clear()
        reload = jest.fn()
        Object.defineProperty(window, 'location', {
            value: { ...originalLocation, pathname: '/send', search: '?secret=abc', hash: '#private', reload },
            writable: true,
        })
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: false })),
        })
    })

    afterEach(() => {
        jest.restoreAllMocks()
        jest.clearAllTimers()
        jest.useRealTimers()
        document.documentElement.style.visibility = ''
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true })
    })

    it('records a bounded boundary report and hides before reload, then restores', () => {
        const message = 'Loading chunk 42 failed ' + 'x'.repeat(400)
        reload.mockImplementation(() => {
            expect(JSON.parse(sessionStorage.getItem('peanut-chunk-reload-report')!)).toEqual({
                at: Date.now(),
                path: '/send',
                source: 'boundary',
                message: message.slice(0, 300),
            })
            expect(document.documentElement.style.visibility).toBe('hidden')
        })
        expect(recoverFromChunkError(message)).toBe(true)
        jest.advanceTimersByTime(3999)
        expect(document.documentElement.style.visibility).toBe('hidden')
        jest.advanceTimersByTime(1)
        expect(document.documentElement.style.visibility).toBe('')
    })

    it('still reloads when only marker storage fails', () => {
        const originalSetItem = Storage.prototype.setItem
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
            this: Storage,
            key: string,
            value: string
        ) {
            if (key === 'peanut-chunk-reload-report') throw new Error('quota')
            originalSetItem.call(this, key, value)
        })
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it.each(['DOM', 'timer'])('still reloads when the optional %s operation throws', (operation) => {
        if (operation === 'DOM')
            jest.spyOn(document, 'documentElement', 'get').mockImplementation(() => {
                throw new Error('DOM unavailable')
            })
        else
            jest.spyOn(window, 'setTimeout').mockImplementation(() => {
                throw new Error('timer unavailable')
            })
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it.each(['non-chunk', 'guard', 'PWA', 'storage'])('suppresses all new effects for %s', (reason) => {
        if (reason === 'guard') sessionStorage.setItem('peanut-chunk-reload-at', String(Date.now()))
        if (reason === 'PWA') (window.matchMedia as jest.Mock).mockReturnValue({ matches: true })
        if (reason === 'storage')
            jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('denied')
            })
        expect(recoverFromChunkError(reason === 'non-chunk' ? new Error('unrelated') : chunkError())).toBe(false)
        jest.restoreAllMocks()
        expect(sessionStorage.getItem('peanut-chunk-reload-report')).toBeNull()
        expect(document.documentElement.style.visibility).toBe('')
        expect(jest.getTimerCount()).toBe(0)
    })

    it('reloads once for a chunk error and returns true', () => {
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(reload).toHaveBeenCalledTimes(1)
    })

    it('returns false and skips reload for non-chunk errors', () => {
        expect(recoverFromChunkError(new Error('Failed to fetch'))).toBe(false)
        expect(reload).not.toHaveBeenCalled()
    })

    it('returns false and skips reload for an installed PWA', () => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: jest.fn(() => ({ matches: true })),
        })
        expect(recoverFromChunkError(chunkError())).toBe(false)
        expect(reload).not.toHaveBeenCalled()
    })

    it('shares the guard with the inline script (no second reload within 60s)', () => {
        expect(recoverFromChunkError(chunkError())).toBe(true)
        expect(recoverFromChunkError(chunkError())).toBe(false)
        expect(reload).toHaveBeenCalledTimes(1)
    })
})

describe('importWithChunkRetry', () => {
    /*
     * A frozen process resuming fires every overdue timer at once, webpack's
     * chunkLoadTimeout included, so an import() that was merely in flight
     * rejects for a local file that is intact (PEANUT-UI-SVT).
     */
    it('retries once when the chunk load timed out', async () => {
        const load = jest
            .fn()
            .mockRejectedValueOnce(new Error('Loading chunk 8789 failed.\n(timeout: https://localhost/_next/x.js)'))
            .mockResolvedValue('module')
        await expect(importWithChunkRetry(load)).resolves.toBe('module')
        expect(load).toHaveBeenCalledTimes(2)
    })

    it('rethrows a non-chunk failure untouched, so it is not a general retry', async () => {
        const load = jest.fn().mockRejectedValue(new Error('boom'))
        await expect(importWithChunkRetry(load)).rejects.toThrow('boom')
        expect(load).toHaveBeenCalledTimes(1)
    })

    it('gives up after the second attempt rather than looping', async () => {
        const load = jest.fn().mockRejectedValue(new Error('ChunkLoadError'))
        await expect(importWithChunkRetry(load)).rejects.toThrow('ChunkLoadError')
        expect(load).toHaveBeenCalledTimes(2)
    })
})
