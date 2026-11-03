import { act, renderHook, waitFor } from '@testing-library/react'
import {
    __resetResidenceRestrictionSetsForTests,
    useResidenceRestrictionSets,
    useResidenceRestrictionSetsWithStatus,
} from '@/hooks/useResidenceRestrictionSets'
import { getResidenceRestrictionSets } from '@/utils/residence-restriction-sets'
import { apiFetch } from '@/utils/api-fetch'
import { isDemoMode } from '@/utils/demo'

const { renderToString } = require('react-dom/server.node') as typeof import('react-dom/server')
const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')!

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))
const fetchMock = apiFetch as jest.MockedFunction<typeof apiFetch>
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn() }))
const demoMock = isDemoMode as jest.MockedFunction<typeof isDemoMode>
const key = 'peanut:residenceRestrictions'
const cached = {
    full: ['us'],
    cardOnly: ['gb'],
    bankingOnly: ['ca'],
    refusedIdIssuers: ['fr'],
    bankingNewCustomersOnly: ['de'],
}
const fresh = { full: ['jp'], cardOnly: [], bankingOnly: ['au'], refusedIdIssuers: [], bankingNewCustomersOnly: ['nz'] }
const asSets = (value: typeof cached) =>
    Object.fromEntries(Object.entries(value).map(([k, v]) => [k, new Set(v.map((x) => x.toUpperCase()))]))
const response = (value: unknown, ok = true) => ({ ok, json: async () => value }) as Response
const deferred = () => {
    let resolve!: (value: Response) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<Response>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

beforeEach(() => {
    jest.restoreAllMocks()
    localStorage.clear()
    __resetResidenceRestrictionSetsForTests()
    fetchMock.mockReset()
    demoMock.mockReturnValue(false)
})

afterEach(() => {
    jest.restoreAllMocks()
    Object.defineProperty(window, 'localStorage', realStorage)
    localStorage.clear()
    __resetResidenceRestrictionSetsForTests()
})

describe('residence restriction hooks', () => {
    it('does not read storage while rendering on the server and starts unknown', () => {
        localStorage.setItem(key, JSON.stringify(cached))
        const read = jest.spyOn(Storage.prototype, 'getItem')
        const states: unknown[] = []
        function Probe() {
            states.push(useResidenceRestrictionSetsWithStatus())
            return null
        }
        renderToString(<Probe />)
        expect(states).toEqual([{ sets: null, settled: false }])
        expect(read).not.toHaveBeenCalled()
        expect(fetchMock).not.toHaveBeenCalled()
    })

    it('starts unknown, fetches without auth, and exposes successful data to both hooks and memory', async () => {
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const seen: unknown[] = []
        const { result } = renderHook(() => {
            const status = useResidenceRestrictionSetsWithStatus()
            seen.push(status)
            return { status, sets: useResidenceRestrictionSets() }
        })
        expect(seen[0]).toEqual({ sets: null, settled: false })
        expect(result.current.sets).toBeNull()
        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ includeAuth: false }))
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        await waitFor(() => expect(result.current.status).toEqual({ sets: asSets(fresh), settled: true }))
        expect(result.current.sets).toEqual(asSets(fresh))
        expect(getResidenceRestrictionSets()).toEqual(asSets(fresh))
        const stored = JSON.parse(localStorage.getItem(key)!)
        expect(Object.keys(stored).sort()).toEqual(Object.keys(fresh).sort())
        expect(asSets(stored)).toEqual(asSets(fresh))
    })

    it('restores cached data after first render, refreshes it, and reuses fresh memory on later mounts', async () => {
        localStorage.setItem(key, JSON.stringify(cached))
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const seen: unknown[] = []
        const first = renderHook(() => {
            const status = useResidenceRestrictionSetsWithStatus()
            seen.push(status)
            return status
        })
        expect(seen[0]).toEqual({ sets: null, settled: false })
        expect(first.result.current).toEqual({ sets: asSets(cached), settled: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        await waitFor(() => expect(first.result.current).toEqual({ sets: asSets(fresh), settled: true }))
        expect(asSets(JSON.parse(localStorage.getItem(key)!))).toEqual(asSets(fresh))
        first.unmount()
        const second = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(second.result.current).toEqual({ sets: asSets(fresh), settled: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('shares a single in-flight request across simultaneous mounts', async () => {
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const one = renderHook(() => useResidenceRestrictionSetsWithStatus())
        const two = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(fetchMock).toHaveBeenCalledTimes(1)
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        await waitFor(() => {
            expect(one.result.current).toEqual({ sets: asSets(fresh), settled: true })
            expect(two.result.current).toEqual({ sets: asSets(fresh), settled: true })
        })
    })

    it.each(['non-ok', 'rejected', 'malformed'] as const)(
        'keeps cached data settled on %s response',
        async (failure) => {
            localStorage.setItem(key, JSON.stringify(cached))
            const pending = deferred()
            fetchMock.mockReturnValue(pending.promise)
            const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
            await act(async () => {
                if (failure === 'rejected') pending.reject(new Error('offline'))
                else pending.resolve(response(failure === 'malformed' ? { full: [] } : fresh, failure !== 'non-ok'))
                await pending.promise.catch(() => undefined)
            })
            expect(result.current).toEqual({ sets: asSets(cached), settled: true })
            expect(asSets(JSON.parse(localStorage.getItem(key)!))).toEqual(asSets(cached))
        }
    )

    it.each(['non-ok', 'rejected', 'malformed'] as const)(
        'stays unknown without cache on %s response',
        async (failure) => {
            const pending = deferred()
            fetchMock.mockReturnValue(pending.promise)
            const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
            await act(async () => {
                if (failure === 'rejected') pending.reject(new Error('offline'))
                else pending.resolve(response(failure === 'malformed' ? { full: [] } : fresh, failure !== 'non-ok'))
                await pending.promise.catch(() => undefined)
            })
            expect(result.current).toEqual({ sets: null, settled: false })
            expect(getResidenceRestrictionSets()).toBeNull()
        }
    )

    it.each([
        '{',
        JSON.stringify({ full: ['US'] }),
        JSON.stringify({ full: [], cardOnly: [], bankingOnly: [], bankingNewCustomersOnly: [] }),
        JSON.stringify({ ...cached, bankingOnly: [1] }),
    ])('removes invalid stored data and still fetches: %s', async (bad) => {
        localStorage.setItem(key, bad)
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(localStorage.getItem(key)).toBeNull()
        expect(result.current).toEqual({ sets: null, settled: false })
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        await waitFor(() => expect(result.current).toEqual({ sets: asSets(fresh), settled: true }))
    })

    it.each(['getItem', 'setItem', 'removeItem'] as const)(
        'fetches successfully when storage %s throws',
        async (method) => {
            if (method === 'removeItem') localStorage.setItem(key, '{')
            jest.spyOn(Storage.prototype, method).mockImplementation(() => {
                throw new Error('storage unavailable')
            })
            const pending = deferred()
            fetchMock.mockReturnValue(pending.promise)
            const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
            await act(async () => {
                pending.resolve(response(fresh))
                await pending.promise
            })
            await waitFor(() => expect(result.current).toEqual({ sets: asSets(fresh), settled: true }))
        }
    )

    it('restores storage only once per session across mounts', () => {
        localStorage.setItem(key, JSON.stringify(cached))
        fetchMock.mockReturnValue(deferred().promise)
        const read = jest.spyOn(Storage.prototype, 'getItem')
        renderHook(() => useResidenceRestrictionSetsWithStatus())
        renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(read).toHaveBeenCalledTimes(1)
        expect(read).toHaveBeenCalledWith(key)
    })

    it('fetches successfully when the localStorage getter throws', async () => {
        jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
            throw new Error('storage unavailable')
        })
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        await waitFor(() => expect(result.current).toEqual({ sets: asSets(fresh), settled: true }))
    })

    it('does not update an unmounted subscriber when the request completes', async () => {
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const seen: unknown[] = []
        const { unmount } = renderHook(() => {
            const value = useResidenceRestrictionSetsWithStatus()
            seen.push(value)
            return value
        })
        unmount()
        const count = seen.length
        await act(async () => {
            pending.resolve(response(fresh))
            await pending.promise
        })
        expect(seen).toHaveLength(count)
    })

    it('keeps a demo backend answer out of the session memory and the device cache', async () => {
        demoMock.mockReturnValue(true)
        fetchMock.mockResolvedValue(response(fresh))
        const demo = renderHook(() => useResidenceRestrictionSetsWithStatus())
        await waitFor(() => expect(demo.result.current).toEqual({ sets: asSets(fresh), settled: true }))
        expect(getResidenceRestrictionSets()).toBeNull()
        expect(localStorage.getItem(key)).toBeNull()
        demo.unmount()

        demoMock.mockReturnValue(false)
        fetchMock.mockResolvedValue(response(cached))
        const real = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(real.result.current).toEqual({ sets: null, settled: false })
        await waitFor(() => expect(real.result.current).toEqual({ sets: asSets(cached), settled: true }))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })
})
