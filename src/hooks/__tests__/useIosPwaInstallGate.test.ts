/** @jest-environment jsdom */
// useIosPwaInstallGate — the sessionStorage latch behind the ForceIOSPWAInstall
// full-screen wall (TASK-21460; was a redux field). The (setup) layout arms it,
// the (mobile-ui) layout reads it — different route groups, so the latch must
// survive a remount/full page load within the session (a DELIBERATE lifetime
// change from the redux version, which any full load reset). These exercise the
// real module — its consumers' specs mock it (Chip review, PR #2949).
import { act, renderHook } from '@testing-library/react'
import { useIosPwaInstallGate } from '@/hooks/useIosPwaInstallGate'

const STORAGE_KEY = 'peanut.showIosPwaInstallScreen'

beforeEach(() => {
    sessionStorage.clear()
})

describe('useIosPwaInstallGate', () => {
    it('defaults to not showing the wall', () => {
        const { result } = renderHook(() => useIosPwaInstallGate())
        expect(result.current.showIosPwaInstallScreen).toBe(false)
    })

    it('arming survives a remount — the cross-layout (setup → mobile-ui) hand-off', () => {
        const armer = renderHook(() => useIosPwaInstallGate())
        act(() => armer.result.current.setShowIosPwaInstallScreen(true))
        armer.unmount()

        // fresh mount in the other route group's layout reads the same latch
        const reader = renderHook(() => useIosPwaInstallGate())
        expect(reader.result.current.showIosPwaInstallScreen).toBe(true)
    })

    it('disarming ("continue in the browser" / existing-session entry) sticks for the session', () => {
        const { result } = renderHook(() => useIosPwaInstallGate())
        act(() => result.current.setShowIosPwaInstallScreen(true))
        act(() => result.current.setShowIosPwaInstallScreen(false))
        expect(result.current.showIosPwaInstallScreen).toBe(false)

        const remounted = renderHook(() => useIosPwaInstallGate())
        expect(remounted.result.current.showIosPwaInstallScreen).toBe(false)
    })

    it('a write notifies an already-mounted subscriber in the other layout', () => {
        const reader = renderHook(() => useIosPwaInstallGate())
        const writer = renderHook(() => useIosPwaInstallGate())
        act(() => writer.result.current.setShowIosPwaInstallScreen(true))
        expect(reader.result.current.showIosPwaInstallScreen).toBe(true)
    })

    it('storage unavailable (private mode): the wall never arms and nothing throws', () => {
        const getSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied')
        })
        const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('denied')
        })
        try {
            const { result } = renderHook(() => useIosPwaInstallGate())
            expect(result.current.showIosPwaInstallScreen).toBe(false)
            expect(() => {
                act(() => result.current.setShowIosPwaInstallScreen(true))
            }).not.toThrow()
            expect(result.current.showIosPwaInstallScreen).toBe(false)
        } finally {
            getSpy.mockRestore()
            setSpy.mockRestore()
        }
    })

    it('uses the documented storage key (support/debugging contract)', () => {
        const { result } = renderHook(() => useIosPwaInstallGate())
        act(() => result.current.setShowIosPwaInstallScreen(true))
        expect(sessionStorage.getItem(STORAGE_KEY)).toBe('true')
    })
})
