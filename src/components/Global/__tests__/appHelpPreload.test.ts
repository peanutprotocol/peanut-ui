/** @jest-environment jsdom */
import { scheduleAboutHelpPreload } from '../appHelpPreload'

const mockLoad = jest.fn<Promise<{ title: string; body: [] }>, unknown[]>(() =>
    Promise.resolve({ title: 'Terms', body: [] })
)
const mockDrawerImport = jest.fn()
jest.mock('../appHelpArticle', () => ({ loadAppHelpArticle: (...args: unknown[]) => mockLoad(...args) }))
jest.mock('../AppHelpDrawer', () => {
    mockDrawerImport()
    return { __esModule: true, default: () => null }
})

let idleJobs: Map<number, IdleRequestCallback>
let nextId = 0
const flush = async () => {
    for (let i = 0; i < 15; i++) await Promise.resolve()
}
const runIdle = async () => {
    const [id, callback] = [...idleJobs][0]
    idleJobs.delete(id)
    callback({ didTimeout: false, timeRemaining: () => 20 })
    await flush()
}

beforeEach(() => {
    jest.useFakeTimers()
    mockLoad.mockClear()
    mockDrawerImport.mockClear()
    idleJobs = new Map()
    window.requestIdleCallback = jest.fn((callback) => {
        idleJobs.set(++nextId, callback)
        return nextId
    })
    window.cancelIdleCallback = jest.fn((id) => {
        idleJobs.delete(id)
    })
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    Object.defineProperty(navigator, 'connection', { configurable: true, value: undefined })
})
afterEach(() => jest.useRealTimers())

it('defers warmup and loads one current-locale article per idle period at low priority', async () => {
    const cancel = scheduleAboutHelpPreload('es-ar')
    expect(mockLoad).not.toHaveBeenCalled()
    expect(window.requestIdleCallback).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1000)
    expect(mockLoad).not.toHaveBeenCalled()
    await runIdle() // drawer code first
    expect(mockLoad).not.toHaveBeenCalled()
    await runIdle()
    expect(mockLoad.mock.calls).toEqual([['terms', 'es-ar', 'low']])
    await runIdle()
    expect(mockLoad).toHaveBeenLastCalledWith('privacy', 'es-ar', 'low')
    cancel()
    expect(idleJobs.size).toBe(0)
})

it.each(['saveData', '2g', 'slow-2g', 'hidden', 'offline'])('does not preload on %s', (condition) => {
    if (condition === 'hidden') Object.defineProperty(document, 'visibilityState', { value: 'hidden' })
    else if (condition === 'offline') Object.defineProperty(navigator, 'onLine', { value: false })
    else
        Object.defineProperty(navigator, 'connection', {
            value: condition === 'saveData' ? { saveData: true } : { effectiveType: condition },
        })
    const cancel = scheduleAboutHelpPreload('en')
    jest.advanceTimersByTime(10000)
    expect(window.requestIdleCallback).not.toHaveBeenCalled()
    expect(mockLoad).not.toHaveBeenCalled()
    cancel()
})

it('does not schedule more work after the user leaves during a fetch', async () => {
    let finish!: () => void
    mockLoad.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = () => resolve({ title: 'Terms', body: [] })
            })
    )
    const cancel = scheduleAboutHelpPreload('en')
    jest.advanceTimersByTime(1000)
    await runIdle()
    await runIdle()
    expect(mockLoad).toHaveBeenCalledTimes(1)
    cancel()
    finish()
    await flush()
    expect(idleJobs.size).toBe(0)
})

it('silently tolerates a failed prefetch and continues the queue', async () => {
    mockLoad.mockRejectedValueOnce(new Error('offline'))
    const cancel = scheduleAboutHelpPreload('en')
    jest.advanceTimersByTime(1000)
    await runIdle()
    await runIdle()
    await runIdle()
    expect(mockLoad).toHaveBeenCalledTimes(2)
    cancel()
})

it('cancels the timer fallback when leaving before idle support is available', () => {
    window.requestIdleCallback = undefined as unknown as typeof window.requestIdleCallback
    const cancel = scheduleAboutHelpPreload('en')
    jest.advanceTimersByTime(1000)
    cancel()
    jest.advanceTimersByTime(10000)
    expect(mockLoad).not.toHaveBeenCalled()
})
