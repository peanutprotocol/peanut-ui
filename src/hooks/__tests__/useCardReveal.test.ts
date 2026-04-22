import { renderHook, act, waitFor } from '@testing-library/react'
import { useCardReveal } from '@/hooks/useCardReveal'
import { rainApi, RainCardRateLimitError, type RainCardDetailsResponse } from '@/services/rain'

jest.mock('@/services/rain', () => {
    const actual = jest.requireActual('@/services/rain')
    return {
        ...actual,
        rainApi: { ...actual.rainApi, getCardDetails: jest.fn() },
    }
})

const mockedGetCardDetails = rainApi.getCardDetails as jest.MockedFunction<typeof rainApi.getCardDetails>

const details: RainCardDetailsResponse = {
    pan: '6969042088800420',
    cvv: '933',
    expiryMonth: 6,
    expiryYear: 2069,
    last4: '0420',
    network: 'visa',
}

describe('useCardReveal', () => {
    beforeEach(() => {
        mockedGetCardDetails.mockReset()
    })

    it('fetches and stores card details on reveal', async () => {
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        await act(async () => {
            await result.current.reveal()
        })

        expect(mockedGetCardDetails).toHaveBeenCalledWith('c1')
        expect(result.current.revealed).toEqual(details)
        expect(result.current.error).toBeNull()
    })

    it('hides revealed details on hide()', async () => {
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))
        await act(async () => {
            await result.current.reveal()
        })
        act(() => result.current.hide())
        expect(result.current.revealed).toBeNull()
    })

    it('toggle cycles reveal and hide', async () => {
        mockedGetCardDetails.mockResolvedValue(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        await act(async () => {
            await result.current.toggle()
        })
        expect(result.current.revealed).toEqual(details)

        await act(async () => {
            await result.current.toggle()
        })
        expect(result.current.revealed).toBeNull()
    })

    it('surfaces rate-limit errors with the rateLimited flag', async () => {
        mockedGetCardDetails.mockRejectedValueOnce(new RainCardRateLimitError('Too many requests'))
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        await act(async () => {
            await result.current.reveal()
        })

        expect(result.current.isRateLimited).toBe(true)
        expect(result.current.error).toBe('Too many requests')
        expect(result.current.revealed).toBeNull()
    })

    it('surfaces generic errors', async () => {
        mockedGetCardDetails.mockRejectedValueOnce(new Error('boom'))
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        await act(async () => {
            await result.current.reveal()
        })

        expect(result.current.error).toBe('boom')
        expect(result.current.isRateLimited).toBe(false)
    })

    it('auto-masks after the configured timeout', async () => {
        jest.useFakeTimers()
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 5_000 }))

        await act(async () => {
            await result.current.reveal()
        })
        expect(result.current.revealed).toEqual(details)

        act(() => {
            jest.advanceTimersByTime(5_001)
        })
        await waitFor(() => expect(result.current.revealed).toBeNull())
        jest.useRealTimers()
    })
})
