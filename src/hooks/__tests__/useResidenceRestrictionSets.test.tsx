/** @jest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { fetchWithSentry } from '@/utils/sentry.utils'
import {
    __resetResidenceRestrictionSetsForTests,
    useResidenceRestrictionSets,
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
})
