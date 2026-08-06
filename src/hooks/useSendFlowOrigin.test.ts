/**
 * useSendFlowOrigin — the single owner of the send-vs-withdraw marker.
 *
 * The send flow has no destination screens of its own; it navigates into the
 * withdraw routes carrying `?method=`. This rule used to be re-derived in four
 * places with three different definitions, which is exactly how the copy drifted
 * apart between consecutive screens.
 */
import { renderHook } from '@testing-library/react'
import { useSendFlowOrigin } from './useSendFlowOrigin'

const mockSearchParams = new Map<string, string>()

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
}))

describe('useSendFlowOrigin', () => {
    beforeEach(() => mockSearchParams.clear())

    it('flags a crypto send (Send → Exchange or Wallet)', () => {
        mockSearchParams.set('method', 'crypto')
        expect(renderHook(() => useSendFlowOrigin()).result.current).toEqual({
            isFromSendFlow: true,
            isBankFromSend: false,
            isCryptoFromSend: true,
        })
    })

    it('flags a bank send (Send → Bank)', () => {
        mockSearchParams.set('method', 'bank')
        expect(renderHook(() => useSendFlowOrigin()).result.current).toEqual({
            isFromSendFlow: true,
            isBankFromSend: true,
            isCryptoFromSend: false,
        })
    })

    it('treats a bare /withdraw as a real withdraw', () => {
        expect(renderHook(() => useSendFlowOrigin()).result.current.isFromSendFlow).toBe(false)
    })

    it('does not treat an unrecognised method as a send', () => {
        // manteca rails (pix, mercado-pago) route to their own page and are not
        // covered by this marker yet — they must not silently read as sends.
        mockSearchParams.set('method', 'pix')
        expect(renderHook(() => useSendFlowOrigin()).result.current).toEqual({
            isFromSendFlow: false,
            isBankFromSend: false,
            isCryptoFromSend: false,
        })
    })
})
