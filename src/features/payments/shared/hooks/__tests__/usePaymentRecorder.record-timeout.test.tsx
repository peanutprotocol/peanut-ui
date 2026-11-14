import { act, renderHook } from '@testing-library/react'
import { ConnectionTimeoutError, MutationResponseTimeoutError } from '@/utils/connection-timeout-error'
import { usePaymentRecorder } from '../usePaymentRecorder'

const mockCreatePayment = jest.fn()
jest.mock('@/services/charges', () => ({
    chargesApi: { createPayment: (...args: unknown[]) => mockCreatePayment(...args) },
}))

const params = {
    chargeId: 'charge-1',
    chainId: '42161',
    txHash: '0xspent-once',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    payerAddress: '0x2222222222222222222222222222222222222222',
} as const

const mutationTimeout = () =>
    Object.assign(Object.create(MutationResponseTimeoutError.prototype), {
        name: 'MutationResponseTimeoutError',
        message: 'Response body timed out after headers',
        responseReceived: true,
        outcomeUnknown: true,
        status: 201,
    }) as MutationResponseTimeoutError

const connectionTimeout = () =>
    Object.assign(Object.create(ConnectionTimeoutError.prototype), {
        name: 'ConnectionTimeoutError',
        message: 'No response arrived before the deadline',
    }) as ConnectionTimeoutError

beforeEach(() => jest.clearAllMocks())

it.each([
    ['unknown mutation outcome', mutationTimeout, null],
    ['no-response connection timeout', connectionTimeout, 'No response arrived before the deadline'],
    ['ordinary recording failure', () => new Error('Payment recording failed'), 'Payment recording failed'],
] as const)(
    'preserves the thrown %s and clears recording with the appropriate error state',
    async (_case, makeError, expectedError) => {
        let rejectRecording!: (reason: Error) => void
        mockCreatePayment.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    rejectRecording = reject
                })
        )
        const failure = makeError()
        const { result } = renderHook(() => usePaymentRecorder())
        let observedFailure: unknown
        let done: Promise<unknown> | undefined

        act(() => {
            done = result.current.recordPayment(params).catch((error: unknown) => {
                observedFailure = error
            })
        })
        expect(result.current.isRecording).toBe(true)
        expect(result.current.error).toBeNull()
        expect(mockCreatePayment).toHaveBeenCalledTimes(1)

        await act(async () => {
            rejectRecording(failure)
            await done
        })

        expect(observedFailure).toBe(failure)
        expect(result.current.isRecording).toBe(false)
        expect(result.current.error).toBe(expectedError)
        expect(mockCreatePayment).toHaveBeenCalledTimes(1)
    }
)
