/**
 * Manteca withdraw + QR pay sign the spend here and let the BACKEND broadcast
 * it, so a Rain leg that fails after signing never reaches this client's own
 * catch. Both callers therefore hand `submitSignedSpend` the repair callback
 * exercised below: cache-only, outcome-preserving, never a retry.
 */
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { submitSignedSpend } from '../signSpendRetry'
import { useRainControllerRepair } from '../useRainControllerRepair'
import { rainApi } from '@/services/rain'
import type { SpendStrategy } from '../spendPreflight'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/app/actions/clients', () => ({ peanutPublicClient: {} }))
jest.mock('@/services/rain', () => ({ rainApi: { refreshControllerAddress: jest.fn() } }))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))

const mockRefreshController = rainApi.refreshControllerAddress as jest.Mock

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
    jest.clearAllMocks()
    queryClient = new QueryClient()
    mockRefreshController.mockResolvedValue({ coordinatorAddress: `0x${'a'.repeat(40)}`, changed: false })
})

/** The exact wiring used by withdraw/manteca/page.tsx and useQrPayFlow.ts. */
function submitAs<T>(strategy: SpendStrategy, submit: () => Promise<T>): Promise<T> {
    const { result } = renderHook(() => useRainControllerRepair(), { wrapper })
    return submitSignedSpend({ strategy }, submit, (failure) => void result.current({ strategy, error: failure }))
}

const REVERTED = { error: 'Failed to broadcast UserOp', message: 'USER_OP_REVERTED: signed operation reverted' }

it('repairs the cache once when the backend reports a confirmed revert, and still returns it', async () => {
    mockRefreshController.mockResolvedValue({ coordinatorAddress: `0x${'b'.repeat(40)}`, changed: true })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')
    const submit = jest.fn(async () => REVERTED)

    await expect(submitAs('mixed', submit)).resolves.toBe(REVERTED)

    expect(mockRefreshController).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    // The controller moved — refresh what the card surface displays.
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] }))
})

it('an ambiguous rejection keeps its outcome, repairs once and re-submits nothing', async () => {
    const failure = new Error('UserOp receipt timeout - transaction may still be pending')
    const submit = jest.fn(async () => {
        throw failure
    })
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries')

    await expect(submitAs('collateral-only', submit)).rejects.toBe(failure)

    expect(mockRefreshController).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledTimes(1)
    // changed: false — nothing displayed moved, so nothing is invalidated.
    await mockRefreshController.mock.results[0].value
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['rain-card-overview'] })
})

it('a successful or still-pending submission never repairs', async () => {
    await expect(submitAs('mixed', async () => ({ status: 'PENDING' }))).resolves.toEqual({ status: 'PENDING' })
    await expect(submitAs('collateral-only', async () => ({ ok: true }))).resolves.toEqual({ ok: true })
    expect(mockRefreshController).not.toHaveBeenCalled()
})

it('a wallet-only (smart-only) failure never repairs — no Rain leg was involved', async () => {
    const failure = new Error('bundler 502')
    await expect(
        submitAs('smart-only', async () => {
            throw failure
        })
    ).rejects.toBe(failure)
    expect(mockRefreshController).not.toHaveBeenCalled()
})
