import { renderHook as renderRawHook, act, waitFor } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { type ReactNode } from 'react'
import { NextIntlClientProvider } from 'next-intl'
import esMessages from '@/i18n/app/messages/es-419.json'
import ptMessages from '@/i18n/app/messages/pt-BR.json'
import posthog from 'posthog-js'
import { useCardReveal } from '@/hooks/useCardReveal'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { rainApi, RainCardRateLimitError, type RainCardDetailsResponse } from '@/services/rain'

let nativeListener: ((state: { isActive: boolean }) => void) | undefined
const removeNativeListener = jest.fn()
jest.mock('@capacitor/app', () => ({
    App: {
        addListener: (_event: string, cb: (state: { isActive: boolean }) => void) => {
            nativeListener = cb
            return Promise.resolve({ remove: removeNativeListener })
        },
    },
}))
let onNative = false
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => onNative }))

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
        onNative = false
        nativeListener = undefined
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

    it('ignores a second reveal while the first is still in flight', async () => {
        let resolveDetails!: (v: RainCardDetailsResponse) => void
        mockedGetCardDetails.mockImplementationOnce(
            () =>
                new Promise<RainCardDetailsResponse>((resolve) => {
                    resolveDetails = resolve
                })
        )
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        let first!: Promise<void>
        act(() => {
            first = result.current.reveal()
        })
        await act(async () => {
            await result.current.reveal()
        })
        expect(mockedGetCardDetails).toHaveBeenCalledTimes(1)

        await act(async () => {
            resolveDetails(details)
            await first
        })
        expect(result.current.revealed).toEqual(details)
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
        expect(result.current.error).toBe('Card details are temporarily unavailable. Please try again later.')
        expect(result.current.revealed).toBeNull()
    })

    it('shows a friendly message and reports only a bounded slice of the raw error', async () => {
        const captureSpy = jest.spyOn(posthog, 'capture')
        // A real backend 500 forwards the upstream Rain body — long and detailed.
        const rawError =
            'Rain API error 500 on GET /v1/issuing/cards/abc/secrets: ' +
            '{"message":"We had an issue with your request","error":"InternalServerError","correlationId":"deadbeef-cafe"}'
        mockedGetCardDetails.mockRejectedValueOnce(new Error(rawError))
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))

        await act(async () => {
            await result.current.reveal()
        })

        // The user never sees the raw upstream/internal error text.
        expect(result.current.error).toBe('Could not load card details. Please try again or contact support.')
        expect(result.current.isRateLimited).toBe(false)
        // Telemetry gets a bounded slice — enough to segment, but the full
        // upstream body (correlationId etc.) never reaches client analytics.
        expect(captureSpy).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_PAN_FAILED, {
            error_message: rawError.slice(0, 120),
        })
        expect(captureSpy.mock.calls.at(-1)?.[1]?.error_message).not.toContain('correlationId')
    })

    it('covers details while hidden and shows them again on resume without a refetch', async () => {
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))
        await act(async () => {
            await result.current.reveal()
        })

        // Backgrounded: the task-switcher snapshot must not see the PAN.
        act(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
            document.dispatchEvent(new Event('visibilitychange'))
            window.dispatchEvent(new Event('blur'))
        })
        expect(result.current.revealed).toBeNull()

        // Back from the merchant app: same payload, no second (rate-limited) fetch.
        act(() => {
            Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
            document.dispatchEvent(new Event('visibilitychange'))
        })
        expect(result.current.revealed).toEqual(details)
        expect(mockedGetCardDetails).toHaveBeenCalledTimes(1)
    })

    it('does not mask on blur alone (native fires it spuriously)', async () => {
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))
        await act(async () => {
            await result.current.reveal()
        })
        act(() => window.dispatchEvent(new Event('blur')))
        expect(result.current.revealed).toEqual(details)
    })

    it('covers details from the native lifecycle, which Android reports instead of visibilitychange', async () => {
        onNative = true
        mockedGetCardDetails.mockResolvedValueOnce(details)
        const { result } = renderHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }))
        await act(async () => {
            await result.current.reveal()
        })
        await waitFor(() => expect(nativeListener).toBeDefined())

        // no visibilitychange on this path — the app lifecycle is the only signal
        act(() => nativeListener!({ isActive: false }))
        expect(result.current.revealed).toBeNull()

        act(() => nativeListener!({ isActive: true }))
        expect(result.current.revealed).toEqual(details)
        expect(mockedGetCardDetails).toHaveBeenCalledTimes(1)
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

describe.each([
    ['es-419', esMessages],
    ['pt-BR', ptMessages],
] as const)('card reveal localization: %s', (locale, messages) => {
    test.each([false, true])(
        'localizes cancelled/failed and rate-limited requests (rate limit: %s)',
        async (limited) => {
            mockedGetCardDetails
                .mockReset()
                .mockRejectedValueOnce(
                    limited
                        ? new RainCardRateLimitError('Raw English provider message')
                        : new Error('Authentication cancelled')
                )
            const wrapper = ({ children }: { children: ReactNode }) => (
                <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
                    {children}
                </NextIntlClientProvider>
            )
            const { result } = renderRawHook(() => useCardReveal({ cardId: 'c1', autoMaskMs: 0 }), { wrapper })
            await act(async () => {
                await result.current.reveal()
            })
            expect(result.current.error).toBe(
                limited ? messages.card.reveal.rateLimited : messages.card.reveal.loadFailed
            )
            expect(result.current.error).not.toContain('Raw English')
        }
    )
})
