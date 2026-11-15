/**
 * useCardCollateralReturn — the wiring around the return: the kernel signing
 * guard, the client the root path actually signs with, the request flags that
 * keep global modals out of the flow, and error state per identity.
 */
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { rainApi, type PrepareRainWithdrawalInput } from '@/services/rain'
import { SIG, cardOverview, preparedWithdrawal, resetPreparations } from '@/test-utils/cardReturnFixtures'

const WALLET = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'
const OTHER_WALLET = '0x1111111111111111111111111111111111111111'
const TX = `0x${'ee'.repeat(32)}`
const USER_OP = `0x${'77'.repeat(32)}`

jest.mock('@/services/rain', () => ({
    ...jest.requireActual('@/services/rain'),
    rainApi: {
        getOverview: jest.fn(),
        prepareWithdrawal: jest.fn(),
        submitWithdrawal: jest.fn(),
        stampWithdrawal: jest.fn(),
        getWithdrawalStatus: jest.fn(),
        cancelPreparation: jest.fn(),
    },
}))
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
const mockEnsureClientForChain = jest.fn()
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        ensureClientForChain: mockEnsureClientForChain,
        getClientForChain: jest.fn(),
        rebuildClientForChain: jest.fn(),
    }),
}))
const mockHandleSendUserOpEncoded = jest.fn()
let mockConnectedAddress = WALLET
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ handleSendUserOpEncoded: mockHandleSendUserOpEncoded, address: mockConnectedAddress }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('@/utils/webauthn-ceremony-telemetry', () => ({
    withCeremonyPurpose: (_purpose: string, run: () => unknown) => run(),
}))
const mockPreflight = jest.fn()
jest.mock('../spendPreflight', () => ({
    ...jest.requireActual('../spendPreflight'),
    runCollateralSpendPreflight: (...args: unknown[]) => mockPreflight(...args),
}))

import { beginKernelMigration } from '@/utils/kernelSigningGuard'
import { CollateralReturnError } from '../cardCollateralReturn'
import { useCardCollateralReturn } from '../useCardCollateralReturn'

const api = rainApi as unknown as Record<keyof typeof rainApi, jest.Mock>

const overview = (grant: boolean) => cardOverview(500, { grant })

const client = (address: string) => ({ account: { address, signTypedData: jest.fn(async () => SIG) } })

let queryClient: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)

beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    mockUserId = 'user-a'
    mockConnectedAddress = WALLET
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    api.getOverview.mockResolvedValue(overview(false))
    resetPreparations()
    // The wallet in these tests is the admin the provider signs for.
    api.prepareWithdrawal.mockImplementation(async (input: PrepareRainWithdrawalInput) =>
        preparedWithdrawal(input, { adminAddress: WALLET, chainId: '42161' })
    )
    api.submitWithdrawal.mockResolvedValue({ txHash: TX })
    api.stampWithdrawal.mockResolvedValue(undefined)
    mockHandleSendUserOpEncoded.mockImplementation(
        async (_calls: unknown, _chain: string, opts: { onBroadcastAttempt: () => void }) => {
            opts.onBroadcastAttempt()
            return { userOpHash: USER_OP, receipt: { transactionHash: TX } }
        }
    )
})

const run = async (hook: { current: ReturnType<typeof useCardCollateralReturn> }) => {
    let result: unknown
    await act(async () => {
        result = await hook.current.returnCollateral().catch((e: unknown) => e)
    })
    return result
}

describe('useCardCollateralReturn', () => {
    it('signs with the client the root preflight hands back, and asks for a stamp that reports failure', async () => {
        const first = client(WALLET)
        const rebuilt = client(WALLET)
        mockEnsureClientForChain.mockResolvedValue(first)
        mockPreflight.mockResolvedValue(rebuilt)
        const { result } = renderHook(() => useCardCollateralReturn(), { wrapper })

        await expect(run(result)).resolves.toMatchObject({ kind: 'returned', via: 'root', txHash: TX })
        expect(rebuilt.account.signTypedData).toHaveBeenCalledTimes(1)
        expect(first.account.signTypedData).not.toHaveBeenCalled()
        expect(mockPreflight).toHaveBeenCalledWith(
            expect.objectContaining({ strategy: 'mixed', migrationTrigger: 'collateral-return' })
        )
        expect(api.prepareWithdrawal).toHaveBeenCalledWith(expect.anything(), { suppressCooldownEvent: true })
        expect(api.stampWithdrawal).toHaveBeenCalledWith(
            { preparationId: 'prep-1', txHash: TX },
            { throwOnError: true }
        )
        expect(api.submitWithdrawal).not.toHaveBeenCalled()
    })

    it('a preflight that hands back another wallet stops before anything is prepared', async () => {
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        mockPreflight.mockResolvedValue(client(OTHER_WALLET))
        const { result } = renderHook(() => useCardCollateralReturn(), { wrapper })

        expect(await run(result)).toMatchObject({ kind: 'account-changed' })
        expect(api.prepareWithdrawal).not.toHaveBeenCalled()
    })

    it('with a stored permission the backend submits it, without the global re-enable prompt', async () => {
        api.getOverview.mockResolvedValue(overview(true))
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        const { result } = renderHook(() => useCardCollateralReturn(), { wrapper })

        await expect(run(result)).resolves.toMatchObject({ kind: 'returned', via: 'grant' })
        expect(api.submitWithdrawal).toHaveBeenCalledWith(expect.anything(), { suppressStaleApprovalEvent: true })
        expect(mockPreflight).not.toHaveBeenCalled()
        expect(mockHandleSendUserOpEncoded).not.toHaveBeenCalled()
    })

    it('does not start while a permission migration holds the wallet', async () => {
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        const release = beginKernelMigration()
        try {
            const { result } = renderHook(() => useCardCollateralReturn(), { wrapper })
            expect(await run(result)).toMatchObject({ kind: 'busy' })
            expect(api.getOverview).not.toHaveBeenCalled()
        } finally {
            release()
        }
    })

    it('keeps the last error for this account only', async () => {
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        api.getOverview.mockRejectedValue(new Error('offline'))
        const hook = renderHook(() => useCardCollateralReturn(), { wrapper })

        const error = await run(hook.result)
        expect(error).toBeInstanceOf(CollateralReturnError)
        expect(hook.result.current.lastError?.kind).toBe('balance-unavailable')

        mockUserId = 'user-b'
        hook.rerender()
        expect(hook.result.current.lastError).toBeNull()
    })

    it('a user switch during the balance read sends nothing and leaves no error for the new user', async () => {
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        let releaseRead!: () => void
        api.getOverview.mockImplementation(
            () => new Promise((resolve) => (releaseRead = () => resolve(overview(false))))
        )
        const hook = renderHook(() => useCardCollateralReturn(), { wrapper })

        let outcome: unknown
        await act(async () => {
            const pending = hook.result.current.returnCollateral().catch((e: unknown) => e)
            await Promise.resolve()
            mockUserId = 'user-b'
            hook.rerender()
            releaseRead()
            outcome = await pending
        })
        expect(outcome).toMatchObject({ kind: 'account-changed' })
        expect(api.prepareWithdrawal).not.toHaveBeenCalled()
        expect(hook.result.current.lastError).toBeNull()
        expect(hook.result.current.isReturning).toBe(false)
    })

    it('settles an expired root return with no receipt only through the strict, verified backend cancel', async () => {
        mockEnsureClientForChain.mockResolvedValue(client(WALLET))
        mockPreflight.mockImplementation(async ({ kernelClient }: { kernelClient: unknown }) => kernelClient)
        window.localStorage.setItem(
            `peanut.cardCollateralReturn.v1:user-a:${WALLET}`,
            JSON.stringify({ op: { via: 'root', preparationId: 'prep-old', expiresAt: 1_000 } })
        )
        const expired = { chainId: '42161', txHash: null, expiresAt: 1_000 }
        api.getWithdrawalStatus
            .mockResolvedValueOnce({ preparationId: 'prep-old', state: 'pending', reason: 'not_submitted', ...expired })
            .mockResolvedValueOnce({ preparationId: 'prep-old', state: 'cancelled', reason: 'cancelled', ...expired })
        api.cancelPreparation.mockResolvedValue(undefined)
        const { result } = renderHook(() => useCardCollateralReturn(), { wrapper })

        await expect(run(result)).resolves.toMatchObject({ kind: 'returned', preparationId: 'prep-1' })
        expect(api.cancelPreparation).toHaveBeenCalledWith('prep-old', { throwOnError: true })
    })
})
