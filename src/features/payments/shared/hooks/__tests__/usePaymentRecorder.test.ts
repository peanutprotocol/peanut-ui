import { renderHook, act, waitFor } from '@testing-library/react'
import { usePaymentRecorder } from '@/features/payments/shared/hooks/usePaymentRecorder'
import { chargesApi } from '@/services/charges'
import type { Address } from 'viem'

jest.mock('@/services/charges', () => ({
    chargesApi: { createPayment: jest.fn() },
}))

const mockedCreatePayment = chargesApi.createPayment as jest.MockedFunction<typeof chargesApi.createPayment>

const PARAMS = {
    chargeId: 'charge-1',
    chainId: '42161',
    txHash: '0xaaa',
    tokenAddress: '0xUSDC' as Address,
    payerAddress: '0xPayer' as Address,
}

beforeEach(() => {
    mockedCreatePayment.mockReset()
})

describe('usePaymentRecorder — post-on-chain safety gate', () => {
    test('submittedTxHash is null until recordPayment is invoked', () => {
        const { result } = renderHook(() => usePaymentRecorder())
        expect(result.current.submittedTxHash).toBeNull()
    })

    test('submittedTxHash is set BEFORE the BE call resolves (timing matters)', async () => {
        // The safety contract: the gate must fire as soon as the on-chain
        // hash is recorded, NOT after the BE ack returns. Otherwise a timeout
        // would surface as error → user retries → double-pay.
        let resolveBE: (v: unknown) => void = () => {}
        const pending = new Promise((resolve) => {
            resolveBE = resolve
        })
        mockedCreatePayment.mockReturnValueOnce(pending as never)

        const { result } = renderHook(() => usePaymentRecorder())
        let recordPromise: Promise<unknown> | undefined
        act(() => {
            recordPromise = result.current.recordPayment(PARAMS)
        })

        // BE call is still in flight, but the gate is already engaged.
        await waitFor(() => expect(result.current.submittedTxHash).toBe('0xaaa'))
        expect(result.current.isRecording).toBe(true)

        await act(async () => {
            resolveBE({ id: 'p-1' })
            await recordPromise
        })
        expect(result.current.submittedTxHash).toBe('0xaaa')
    })

    test('submittedTxHash stays set when recordPayment throws (timeout / 5xx / network)', async () => {
        // Konrad-shape: BE call fails AFTER the on-chain hash is in flight.
        // The gate must NOT clear — re-running the parent handler would
        // re-fire sendMoney() and double-pay.
        mockedCreatePayment.mockRejectedValueOnce(new Error('Request timed out after 60000ms'))

        const { result } = renderHook(() => usePaymentRecorder())
        await act(async () => {
            await expect(result.current.recordPayment(PARAMS)).rejects.toThrow(/timed out/)
        })
        expect(result.current.submittedTxHash).toBe('0xaaa')
        expect(result.current.isRecording).toBe(false)
        expect(result.current.error).toMatch(/timed out/)
    })

    test('markSubmitted gates the UI for skip-recordPayment flows (e.g. Rain collateral)', () => {
        // Crypto withdraw on same-chain Rain-collateral path skips
        // recordPayment (Rain webhook reconciles instead). The caller must
        // still set the gate so a retry can't re-fire sendMoney.
        const { result } = renderHook(() => usePaymentRecorder())
        act(() => result.current.markSubmitted('0xrain'))
        expect(result.current.submittedTxHash).toBe('0xrain')
    })

    test('reset clears the gate so a fresh flow can start', () => {
        const { result } = renderHook(() => usePaymentRecorder())
        act(() => result.current.markSubmitted('0xaaa'))
        expect(result.current.submittedTxHash).toBe('0xaaa')
        act(() => result.current.reset())
        expect(result.current.submittedTxHash).toBeNull()
        expect(result.current.error).toBeNull()
        expect(result.current.payment).toBeNull()
    })

    test('happy path: recordPayment resolves, gate stays set, payment is exposed', async () => {
        mockedCreatePayment.mockResolvedValueOnce({ id: 'p-1' } as never)
        const { result } = renderHook(() => usePaymentRecorder())
        await act(async () => {
            await result.current.recordPayment(PARAMS)
        })
        expect(result.current.submittedTxHash).toBe('0xaaa')
        expect(result.current.payment).toEqual({ id: 'p-1' })
        expect(result.current.error).toBeNull()
    })
})
