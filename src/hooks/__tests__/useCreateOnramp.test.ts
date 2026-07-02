import { renderHook, act } from '@testing-library/react'
import { useCreateOnramp } from '@/hooks/useCreateOnramp'
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

    it('surfaces the backend error body on a non-ok response', async () => {
        apiFetchMock.mockResolvedValue({
            ok: false,
            json: async () => ({ error: 'Could not create transfer: customer is under review' }),
        })
        const { result } = renderHook(() => useCreateOnramp())

        await act(async () => {
            await expect(result.current.createOnramp({ amount: '100', country })).rejects.toThrow(
                'Could not create transfer: customer is under review'
            )
        })
        expect(result.current.error).toBe('Could not create transfer: customer is under review')
    })

    it('falls back to the generic message when the error body is unparseable', async () => {
        apiFetchMock.mockResolvedValue({
            ok: false,
            json: async () => {
                throw new Error('not json')
            },
        })
        const { result } = renderHook(() => useCreateOnramp())

        await act(async () => {
            await expect(result.current.createOnramp({ amount: '100', country })).rejects.toThrow(
                'Failed to create bank transfer. Please try again or contact support.'
            )
        })
        expect(result.current.error).toBe('Failed to create bank transfer. Please try again or contact support.')
    })

    it('returns the onramp data on success', async () => {
        const data = { transferId: 't-1', depositInstructions: { amount: '100', currency: 'eur' } }
        apiFetchMock.mockResolvedValue({ ok: true, json: async () => data })
        const { result } = renderHook(() => useCreateOnramp())

        let response: unknown
        await act(async () => {
            response = await result.current.createOnramp({ amount: '100', country })
        })
        expect(response).toEqual(data)
        expect(result.current.error).toBeNull()
    })
})
