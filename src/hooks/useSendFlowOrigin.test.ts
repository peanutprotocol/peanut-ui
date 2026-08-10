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
            sendFlowMethod: 'crypto',
        })
    })

    it('flags a bank send (Send → Bank)', () => {
        mockSearchParams.set('method', 'bank')
        expect(renderHook(() => useSendFlowOrigin()).result.current).toEqual({
            isFromSendFlow: true,
            isBankFromSend: true,
            isCryptoFromSend: false,
            sendFlowMethod: 'bank',
        })
    })

    it('treats a bare /withdraw as a real withdraw', () => {
        const { result } = renderHook(() => useSendFlowOrigin())
        expect(result.current.isFromSendFlow).toBe(false)
        expect(result.current.sendFlowMethod).toBeNull()
    })

    it('forwards the marker verbatim so downstream never rewrites bank to crypto', () => {
        // /withdraw?method=bank → pick Crypto → lands on /withdraw/crypto?method=bank.
        // Hard-coding 'crypto' on the way back would change the amount step's back behaviour.
        mockSearchParams.set('method', 'bank')
        expect(renderHook(() => useSendFlowOrigin()).result.current.sendFlowMethod).toBe('bank')
    })

    it('does not treat an unrecognised method as a send', () => {
        // manteca rails (pix, mercado-pago) route to their own page and are not
        // covered by this marker yet — they must not silently read as sends.
        mockSearchParams.set('method', 'pix')
        expect(renderHook(() => useSendFlowOrigin()).result.current).toEqual({
            isFromSendFlow: false,
            isBankFromSend: false,
            isCryptoFromSend: false,
            sendFlowMethod: null,
        })
    })
})
