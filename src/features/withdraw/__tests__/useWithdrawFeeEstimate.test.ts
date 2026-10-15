import { act, renderHook } from '@testing-library/react'
import { PEANUT_WALLET_CHAIN, PEANUT_WALLET_TOKEN } from '@/constants/zerodev.consts'
import { previewWithdrawFee } from '@/features/payments/shared/hooks/useCrossChainTransfer'
import { FEE_ESTIMATE_DEBOUNCE_MS, useWithdrawFeeEstimate } from '../useWithdrawFeeEstimate'

jest.mock('@/features/payments/shared/hooks/useCrossChainTransfer', () => ({
    previewWithdrawFee: jest.fn(),
}))
const preview = previewWithdrawFee as jest.MockedFunction<typeof previewWithdrawFee>

const WALLET_CHAIN = PEANUT_WALLET_CHAIN.id.toString()
const base = {
    sourceChainId: WALLET_CHAIN,
    destinationChainId: '1',
    tokenAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    tokenSymbol: 'USDT',
    recipient: '0x1111111111111111111111111111111111111111',
    depositor: '0x2222222222222222222222222222222222222222',
}

const deferred = <T>() => {
    let resolve!: (v: T) => void
    let reject!: (e: unknown) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}

const settle = async () => {
    await act(async () => {
        jest.advanceTimersByTime(FEE_ESTIMATE_DEBOUNCE_MS)
    })
}

describe('useWithdrawFeeEstimate', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        preview.mockReset()
    })
    afterEach(() => jest.useRealTimers())

    test('no amount: idle, no quote', async () => {
        const { result } = renderHook(() => useWithdrawFeeEstimate({ ...base, amountUsd: '' }))
        await settle()
        expect(result.current).toEqual({ status: 'idle' })
        expect(preview).not.toHaveBeenCalled()
    })

    test('free route: no quote needed', async () => {
        const { result } = renderHook(() =>
            useWithdrawFeeEstimate({
                ...base,
                amountUsd: '10',
                destinationChainId: WALLET_CHAIN,
                tokenAddress: PEANUT_WALLET_TOKEN,
                tokenSymbol: 'USDC',
            })
        )
        await settle()
        expect(result.current).toEqual({ status: 'free' })
        expect(preview).not.toHaveBeenCalled()
    })

    test('loading while typing settles, then the quote', async () => {
        preview.mockResolvedValue({ feeUsd: 1.2, receiveAmount: '8.8' })
        const { result } = renderHook(() => useWithdrawFeeEstimate({ ...base, amountUsd: '10' }))
        expect(result.current).toEqual({ status: 'loading' })
        await settle()
        expect(preview).toHaveBeenCalledTimes(1)
        expect(preview).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: '10', destinationChainId: '1' }))
        expect(result.current).toEqual({ status: 'ready', feeUsd: 1.2, receiveAmount: '8.8' })
    })

    test('debounced: a burst of keystrokes asks once', async () => {
        preview.mockResolvedValue({ feeUsd: 1, receiveAmount: '1' })
        const { rerender } = renderHook((amountUsd: string) => useWithdrawFeeEstimate({ ...base, amountUsd }), {
            initialProps: '',
        })
        rerender('1')
        rerender('12')
        rerender('123')
        await settle()
        expect(preview).toHaveBeenCalledTimes(1)
        expect(preview).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: '123' }))
    })

    test('failure shows failed, never a zero fee', async () => {
        preview.mockRejectedValue(new Error('rhino down'))
        const { result } = renderHook(() => useWithdrawFeeEstimate({ ...base, amountUsd: '10' }))
        await settle()
        expect(result.current).toEqual({ status: 'failed' })
    })

    test('an older response never overwrites a newer amount', async () => {
        const first = deferred<{ feeUsd: number; receiveAmount: string }>()
        const second = deferred<{ feeUsd: number; receiveAmount: string }>()
        preview.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
        const { result, rerender } = renderHook((amountUsd: string) => useWithdrawFeeEstimate({ ...base, amountUsd }), {
            initialProps: '10',
        })
        await settle()
        rerender('20')
        await settle()
        // the newer quote answers first, then the stale one arrives
        await act(async () => second.resolve({ feeUsd: 2, receiveAmount: '18' }))
        await act(async () => first.resolve({ feeUsd: 1, receiveAmount: '9' }))
        expect(result.current).toEqual({ status: 'ready', feeUsd: 2, receiveAmount: '18' })
    })

    test('a new amount shows loading, not the previous amount’s fee', async () => {
        preview.mockResolvedValueOnce({ feeUsd: 1, receiveAmount: '9' })
        const { result, rerender } = renderHook((amountUsd: string) => useWithdrawFeeEstimate({ ...base, amountUsd }), {
            initialProps: '10',
        })
        await settle()
        expect(result.current.status).toBe('ready')
        preview.mockReturnValueOnce(new Promise(() => {}))
        rerender('20')
        expect(result.current).toEqual({ status: 'loading' })
    })
})
