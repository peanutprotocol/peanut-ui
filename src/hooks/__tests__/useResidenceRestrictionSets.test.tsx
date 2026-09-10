/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { fetchWithSentry } from '@/utils/sentry.utils'
import {
    __resetResidenceRestrictionSetsForTests,
    useResidenceRestrictionSets,
    useResidenceRestrictionSetsWithStatus,
} from '@/hooks/useResidenceRestrictionSets'

jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: jest.fn() }))
const mockedFetch = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

describe('useResidenceRestrictionSets', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        __resetResidenceRestrictionSetsForTests()
    })

    it('starts from the bundled mirror and swaps to the server lists', async () => {
        mockedFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ full: ['xx'], cardOnly: ['yy'], bankingOnly: ['zz'] }),
        } as Response)
        const { result } = renderHook(() => useResidenceRestrictionSets())
        // bundled mirror first
        expect(result.current.full.has('RU')).toBe(true)
        await waitFor(() => expect(result.current.full.has('XX')).toBe(true))
        expect(result.current.cardOnly.has('YY')).toBe(true)
        expect(result.current.full.has('RU')).toBe(false)
    })

    it('keeps the bundled mirror when the endpoint fails or returns junk', async () => {
        mockedFetch.mockResolvedValue({ ok: true, json: async () => ({ full: 'not-a-list' }) } as Response)
        const { result } = renderHook(() => useResidenceRestrictionSets())
        await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
        expect(result.current.full.has('RU')).toBe(true)
        expect(result.current.bankingOnly.has('JP')).toBe(true)
    })

    it('settles only when a server list was actually parsed', async () => {
        mockedFetch.mockResolvedValue({
            ok: true,
            json: async () => ({ full: ['xx'], cardOnly: [], bankingOnly: [] }),
        } as Response)
        const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
        expect(result.current.settled).toBe(false)
        await waitFor(() => expect(result.current.settled).toBe(true))
        expect(result.current.sets.full.has('XX')).toBe(true)
    })

    it('stays unsettled after a failed or malformed lookup', async () => {
        // The mirror alone must never back a definitive claim: a failed
        // lookup keeps the data non-authoritative rather than "settled".
        mockedFetch.mockResolvedValue({ ok: false } as Response)
        const { result } = renderHook(() => useResidenceRestrictionSetsWithStatus())
        await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(result.current.settled).toBe(false)
        expect(result.current.sets.full.has('RU')).toBe(true)
    })
})
