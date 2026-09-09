/** @jest-environment jsdom */
// useZeroDevFlow — the module-level external store that replaced the redux
// zeroDev slice (TASK-21462). Every consumer spec mocks this module, so these
// exercise the REAL subscription contract (Chip review, PR #2950): writes fan
// out to every mounted subscriber, unmounted subscribers stop being notified,
// and reset() restores every field — the logout / pre-registration wipe both
// rely on it to drop the previous account's kernel address.
import { act, renderHook } from '@testing-library/react'
import { useZeroDevFlow, zeroDevFlowActions } from '@/hooks/useZeroDevFlow'

beforeEach(() => {
    act(() => zeroDevFlowActions.reset())
})

describe('useZeroDevFlow', () => {
    it('starts at the initial flags with no address', () => {
        const { result } = renderHook(() => useZeroDevFlow())
        expect(result.current).toEqual({
            isKernelClientReady: false,
            isRegistering: false,
            isLoggingIn: false,
            isSendingUserOp: false,
            address: undefined,
        })
    })

    it('an action fans out to EVERY mounted subscriber — the stale-reload interlock reads this live', () => {
        // useStaleDeploymentReload refuses a document reload while
        // isSendingUserOp is true; a write that failed to notify would let the
        // app reload mid-transaction.
        const first = renderHook(() => useZeroDevFlow())
        const second = renderHook(() => useZeroDevFlow())

        act(() => zeroDevFlowActions.setIsSendingUserOp(true))

        expect(first.result.current.isSendingUserOp).toBe(true)
        expect(second.result.current.isSendingUserOp).toBe(true)

        act(() => zeroDevFlowActions.setIsSendingUserOp(false))
        expect(first.result.current.isSendingUserOp).toBe(false)
        expect(second.result.current.isSendingUserOp).toBe(false)
    })

    it('a write only touches its own field — the rest of the snapshot rides along unchanged', () => {
        const { result } = renderHook(() => useZeroDevFlow())
        act(() => zeroDevFlowActions.setAddress('0xabc'))
        act(() => zeroDevFlowActions.setIsKernelClientReady(true))

        expect(result.current.address).toBe('0xabc')
        expect(result.current.isKernelClientReady).toBe(true)
        expect(result.current.isRegistering).toBe(false)
        expect(result.current.isLoggingIn).toBe(false)
    })

    it('an unmounted subscriber stops being notified; survivors still are', () => {
        const gone = renderHook(() => useZeroDevFlow())
        const stays = renderHook(() => useZeroDevFlow())
        gone.unmount()

        act(() => zeroDevFlowActions.setIsLoggingIn(true))

        expect(stays.result.current.isLoggingIn).toBe(true)
        // the unmounted hook keeps its last snapshot and, more importantly,
        // its dead listener must not throw or block the surviving fan-out
        expect(gone.result.current.isLoggingIn).toBe(false)
    })

    it('reset() restores EVERY field — logout must drop the previous account address and flags', () => {
        const { result } = renderHook(() => useZeroDevFlow())
        act(() => {
            zeroDevFlowActions.setIsKernelClientReady(true)
            zeroDevFlowActions.setIsRegistering(true)
            zeroDevFlowActions.setIsLoggingIn(true)
            zeroDevFlowActions.setIsSendingUserOp(true)
            zeroDevFlowActions.setAddress('0xprevious-user')
        })
        expect(result.current.address).toBe('0xprevious-user')

        act(() => zeroDevFlowActions.reset())

        expect(result.current).toEqual({
            isKernelClientReady: false,
            isRegistering: false,
            isLoggingIn: false,
            isSendingUserOp: false,
            address: undefined,
        })
    })
})
