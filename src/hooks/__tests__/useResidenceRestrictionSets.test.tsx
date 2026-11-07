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
    it('starts unknown on the server render without touching storage', () => {
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
        expect(localStorage.getItem(key)).toBeNull()
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

    it.each(['non-ok', 'rejected', 'malformed'] as const)('stays unknown on %s response', async (failure) => {
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
    })

    it.each([
        ['a valid list', JSON.stringify(cached)],
        ['invalid data', '{'],
    ])('ignores %s stored under the key by an earlier build', async (_label, stored) => {
        localStorage.setItem(key, stored)
        const read = jest.spyOn(Storage.prototype, 'getItem')
        const pending = deferred()
        fetchMock.mockReturnValue(pending.promise)
        const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(result.current).toEqual({ sets: null, settled: false })
        await act(async () => {
            pending.reject(new Error('offline'))
            await pending.promise.catch(() => undefined)
        })
        expect(result.current).toEqual({ sets: null, settled: false })
        expect(getResidenceRestrictionSets()).toBeNull()
        expect(read).not.toHaveBeenCalledWith(key)
    })

    it('reuses a live answer on later mounts without fetching again', async () => {
        fetchMock.mockResolvedValue(response(fresh))
        const first = renderHook(() => useResidenceRestrictionSetsWithStatus())
        await waitFor(() => expect(first.result.current).toEqual({ sets: asSets(fresh), settled: true }))
        first.unmount()
        const second = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(second.result.current).toEqual({ sets: asSets(fresh), settled: true })
        expect(fetchMock).toHaveBeenCalledTimes(1)
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

    it('keeps a demo backend answer out of the session memory', async () => {
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
