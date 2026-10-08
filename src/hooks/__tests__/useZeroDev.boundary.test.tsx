/**
 * TASK-21815 review — the REAL handleSendUserOpEncoded must fire
 * onBroadcastAttempt at the transport boundary: encode, preparation, and
 * signature failures leave the marker untouched; a transport rejection
 * observes it exactly once, fired before the send.
 */
import { renderHook } from '@testing-library/react'
import { useZeroDev } from '../useZeroDev'

jest.mock('@/hooks/useZeroDevFlow', () => ({
    useZeroDevFlow: () => ({
        isKernelClientReady: true,
        isRegistering: false,
        isLoggingIn: false,
        isSendingUserOp: false,
        address: undefined,
    }),
    zeroDevFlowActions: {
        reset: jest.fn(),
        setIsKernelClientReady: jest.fn(),
        setIsRegistering: jest.fn(),
        setIsLoggingIn: jest.fn(),
        setIsSendingUserOp: jest.fn(),
        setAddress: jest.fn(),
    },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn() }) }))
const fakeClient: Record<string, jest.Mock | { encodeCalls: jest.Mock; signUserOperation: jest.Mock }> = {} as never
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        setWebAuthnKey: jest.fn(),
        getClientForChain: () => fakeClient,
        ensureClientForChain: jest.fn(async () => undefined),
    }),
}))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/services/invites', () => ({ invitesApi: {} }))
jest.mock('@/services/badge-campaigns', () => ({}))

describe('handleSendUserOpEncoded — real broadcast boundary', () => {
    function wireClient(overrides: { encode?: jest.Mock; prepare?: jest.Mock; sign?: jest.Mock; send?: jest.Mock }) {
        const encode = overrides.encode ?? jest.fn(async () => '0xencoded')
        const prepare = overrides.prepare ?? jest.fn(async () => ({ callData: '0xencoded', callGasLimit: 1n }))
        const sign = overrides.sign ?? jest.fn(async () => `0x${'e'.repeat(130)}`)
        const send = overrides.send ?? jest.fn(async () => '0x' + 'f'.repeat(64))
        fakeClient.account = { encodeCalls: encode, signUserOperation: sign } as never
        fakeClient.prepareUserOperation = prepare
        fakeClient.sendUserOperation = send
        fakeClient.waitForUserOperationReceipt = jest.fn(async () => ({
            success: true,
            receipt: { status: 'success' },
        }))
        return { encode, prepare, sign, send }
    }

    const calls = [
        { to: '0x0000000000000000000000000000000000000001' as `0x${string}`, value: 0n, data: '0x' as `0x${string}` },
    ]

    it.each([
        [
            'encode',
            () =>
                wireClient({
                    encode: jest.fn(async () => {
                        throw new Error('encode boom')
                    }),
                }),
        ],
        [
            'prepare',
            () =>
                wireClient({
                    prepare: jest.fn(async () => {
                        throw new Error('prepare boom')
                    }),
                }),
        ],
        [
            'sign',
            () =>
                wireClient({
                    sign: jest.fn(async () => {
                        throw new Error('sign boom')
                    }),
                }),
        ],
    ] as const)('a %s failure never fires the marker', async (_stage, wire) => {
        wire()
        const marker = jest.fn()
        const { result } = renderHook(() => useZeroDev())
        await expect(
            result.current.handleSendUserOpEncoded(calls, '42161', { onBroadcastAttempt: marker })
        ).rejects.toThrow('boom')
        expect(marker).not.toHaveBeenCalled()
    })

    it('a transport rejection observes the marker exactly once, fired before the send', async () => {
        const marker = jest.fn()
        const send = jest.fn(async () => {
            expect(marker).toHaveBeenCalledTimes(1)
            throw new Error('bundler down')
        })
        wireClient({ send })
        const { result } = renderHook(() => useZeroDev())
        await expect(
            result.current.handleSendUserOpEncoded(calls, '42161', { onBroadcastAttempt: marker })
        ).rejects.toThrow('bundler down')
        expect(send).toHaveBeenCalledTimes(1)
        expect(marker).toHaveBeenCalledTimes(1)
    })
})
