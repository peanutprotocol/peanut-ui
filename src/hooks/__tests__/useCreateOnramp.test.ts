import { renderHook, act } from '@testing-library/react'
import { useCreateOnramp, GENERIC_ONRAMP_ERROR } from '@/hooks/useCreateOnramp'
import { type CountryData } from '@/components/AddMoney/consts'

// regression test for the eea-uplift silent-failure incident: the backend
// returns { error: '...' } on 400 (e.g. "Could not create transfer: customer
// under review") but the hook used to throw a hardcoded generic message
// without reading the body — users retried blind with no reason shown.
const apiFetchMock = jest.fn()
jest.mock('@/utils/api-fetch', () => ({
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
}))

jest.mock('@/utils/bridge.utils', () => ({
    getCurrencyConfig: () => ({ currency: 'eur', paymentRail: 'sepa' }),
}))

jest.mock('@/app/actions/currency', () => ({
    getCurrencyPrice: jest.fn(),
}))

const country = { id: 'DE', type: 'country', path: 'germany' } as unknown as CountryData

describe('useCreateOnramp', () => {
    beforeEach(() => {
        apiFetchMock.mockReset()
        jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('throws the backend error body on a 4xx response', async () => {
        apiFetchMock.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => ({ error: 'Could not create transfer: customer is under review' }),
        })
        const { result } = renderHook(() => useCreateOnramp())

        await act(async () => {
            await expect(result.current.createOnramp({ amount: '100', country })).rejects.toThrow(
                'Could not create transfer: customer is under review'
            )
        })
    })

    // the leak guard: a 500's body carries raw internal text (the BE global
    // handler only sanitizes Prisma), so it must NOT be surfaced — the user
    // gets the generic string and the body is never even read.
    it('does not surface a 5xx error body, uses the generic message', async () => {
        const jsonSpy = jest.fn(async () => ({ error: 'Request failed with status code 401 at /internal/bridge' }))
        apiFetchMock.mockResolvedValue({ ok: false, status: 500, json: jsonSpy })
        const { result } = renderHook(() => useCreateOnramp())

        await act(async () => {
            await expect(result.current.createOnramp({ amount: '100', country })).rejects.toThrow(GENERIC_ONRAMP_ERROR)
        })
        expect(jsonSpy).not.toHaveBeenCalled()
    })

    it('falls back to the generic message when a 4xx body is unparseable', async () => {
        apiFetchMock.mockResolvedValue({
            ok: false,
            status: 400,
            json: async () => {
                throw new Error('not json')
            },
        })
        const { result } = renderHook(() => useCreateOnramp())

        await act(async () => {
            await expect(result.current.createOnramp({ amount: '100', country })).rejects.toThrow(GENERIC_ONRAMP_ERROR)
        })
    })

    it('returns the onramp data on success', async () => {
        const data = { transferId: 't-1', depositInstructions: { amount: '100', currency: 'eur' } }
        apiFetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => data })
        const { result } = renderHook(() => useCreateOnramp())

        let response: unknown
        await act(async () => {
            response = await result.current.createOnramp({ amount: '100', country })
        })
        expect(response).toEqual(data)
    })
})
