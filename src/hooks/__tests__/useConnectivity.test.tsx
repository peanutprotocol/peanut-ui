import { act, renderHook } from '@testing-library/react'
import { useConnectivity } from '../useConnectivity'
import { reportNetworkError, reportNetworkOk } from '@/utils/connectivity'

beforeEach(() => {
    reportNetworkOk()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

describe('useConnectivity', () => {
    it('is quiet when online and requests succeed', () => {
        const { result } = renderHook(() => useConnectivity())
        expect(result.current.show).toBe(false)
    })

    it('flags the API unreachable only after the failure threshold', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError()
        })
        expect(result.current.isApiUnreachable).toBe(false) // one blip isn't enough

        act(() => {
            reportNetworkError()
        })
        expect(result.current.isApiUnreachable).toBe(true)
        expect(result.current.show).toBe(true)
    })

    it('clears once a request succeeds again', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            reportNetworkError()
            reportNetworkError()
        })
        expect(result.current.show).toBe(true)

        act(() => {
            reportNetworkOk()
        })
        expect(result.current.show).toBe(false)
    })

    it('shows offline when the device drops connectivity', () => {
        const { result } = renderHook(() => useConnectivity())

        act(() => {
            Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
            window.dispatchEvent(new Event('offline'))
        })

        expect(result.current.isOffline).toBe(true)
        expect(result.current.show).toBe(true)
    })
})
