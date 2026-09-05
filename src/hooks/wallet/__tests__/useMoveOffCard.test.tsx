/**
 * Contract tests for useMoveOffCard — the hook that returns collateral to the
 * user's smart wallet on request (the "Move off card" action and the excess
 * after lowering the on-card target).
 *
 * The contracts locked down here:
 *  1. below-threshold / nothing-on-card cases return 0 WITHOUT any signing or
 *     submission (the user must not see a passkey prompt),
 *  2. the move is signed via the FORCED collateral-only strategy (routing
 *     would pick smart-only — a self-transfer no-op — whenever the smart
 *     wallet covers the amount) and submitted for exactly the amount, capped
 *     at what the card actually holds,
 *  3. a missing wallet address fails closed before any signing,
 *  4. `beforeSubmit` (the caller's target-lowering PATCH) runs after the
 *     passkey and before the broadcast: never on a cancelled passkey, and
 *     its failure leaves the signed withdrawal unsent.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMoveOffCard } from '../useMoveOffCard'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useWallet } from '@/hooks/wallet/useWallet'
import { useSignSpendBundle } from '@/hooks/wallet/useSignSpendBundle'
import { rainApi } from '@/services/rain'

const WALLET = '0xc97fffbf8768ca90cd62fae2e313b084fe13e553'

jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: jest.fn(),
    RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview',
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: jest.fn() }))
jest.mock('@/hooks/wallet/useSignSpendBundle', () => ({ useSignSpendBundle: jest.fn() }))
jest.mock('@/services/rain', () => ({ rainApi: { submitWithdrawal: jest.fn() } }))

const mockOverview = useRainCardOverview as jest.Mock
const mockUseWallet = useWallet as jest.Mock
const mockUseSignSpendBundle = useSignSpendBundle as jest.Mock
const mockSubmitWithdrawal = rainApi.submitWithdrawal as jest.Mock

const RAIN_WITHDRAWAL = { preparationId: 'prep-1', amount: '150000000' }
const mockSignSpend = jest.fn()

const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const setup = ({
    spendingPower = 20_000,
    address = WALLET,
}: {
    spendingPower?: number | null
    address?: string | null
} = {}) => {
    mockOverview.mockReturnValue({
        overview: spendingPower === null ? undefined : { balance: { spendingPower } },
    })
    mockUseWallet.mockReturnValue({ address: address === null ? undefined : address })
    mockUseSignSpendBundle.mockReturnValue({ signSpend: mockSignSpend })
    return renderHook(() => useMoveOffCard(), { wrapper })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL })
    mockSubmitWithdrawal.mockResolvedValue({ txHash: '0xhash' })
})

describe('useMoveOffCard', () => {
    it('skips (no prompt, no submit) below the $1 threshold', async () => {
        const { result } = setup()
        await act(async () => {
            expect(await result.current.moveOffCard(50)).toBe(0)
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('skips when the overview has not loaded (no spending power)', async () => {
        const { result } = setup({ spendingPower: null })
        await act(async () => {
            expect(await result.current.moveOffCard(5_000)).toBe(0)
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
    })

    it('signs a FORCED collateral-only withdrawal of exactly the amount, to the smart wallet, then submits', async () => {
        const { result } = setup({ spendingPower: 20_000 })
        await act(async () => {
            expect(await result.current.moveOffCard(15_000)).toBe(15_000)
        })
        expect(mockSignSpend).toHaveBeenCalledWith({
            requiredUsdcAmount: 150_000_000n, // 15000 cents → 6dp USDC units
            recipient: WALLET,
            rainSpendingPower: 200_000_000n,
            kind: 'AUTO_REBALANCE',
            forceStrategy: 'collateral-only',
        })
        expect(mockSubmitWithdrawal).toHaveBeenCalledWith(RAIN_WITHDRAWAL)
    })

    it('caps the move at what the card actually holds', async () => {
        const { result } = setup({ spendingPower: 4_200 })
        await act(async () => {
            expect(await result.current.moveOffCard(10_000)).toBe(4_200)
        })
        expect(mockSignSpend).toHaveBeenCalledWith(expect.objectContaining({ requiredUsdcAmount: 42_000_000n }))
    })

    it('fails closed before signing when the wallet address is not ready', async () => {
        const { result } = setup({ address: null })
        await act(async () => {
            await expect(result.current.moveOffCard(5_000)).rejects.toThrow('Wallet not ready')
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('does not submit when signing fails (passkey cancelled)', async () => {
        mockSignSpend.mockRejectedValue(new Error('user cancelled'))
        const { result } = setup()
        await act(async () => {
            await expect(result.current.moveOffCard(5_000)).rejects.toThrow('user cancelled')
        })
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('runs beforeSubmit after the passkey and before the broadcast', async () => {
        const order: string[] = []
        mockSignSpend.mockImplementation(async () => {
            order.push('sign')
            return { strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL }
        })
        mockSubmitWithdrawal.mockImplementation(async () => {
            order.push('submit')
            return { txHash: '0xhash' }
        })
        const { result } = setup()
        await act(async () => {
            expect(
                await result.current.moveOffCard(5_000, {
                    beforeSubmit: async () => {
                        order.push('before')
                    },
                })
            ).toBe(5_000)
        })
        expect(order).toEqual(['sign', 'before', 'submit'])
    })

    it('a failed beforeSubmit leaves the signed withdrawal unsent', async () => {
        const { result } = setup()
        await act(async () => {
            await expect(
                result.current.moveOffCard(5_000, { beforeSubmit: async () => Promise.reject(new Error('offline')) })
            ).rejects.toThrow('offline')
        })
        expect(mockSignSpend).toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('never runs beforeSubmit when the passkey is cancelled', async () => {
        mockSignSpend.mockRejectedValue(new Error('user cancelled'))
        const beforeSubmit = jest.fn(async () => undefined)
        const { result } = setup()
        await act(async () => {
            await expect(result.current.moveOffCard(5_000, { beforeSubmit })).rejects.toThrow('user cancelled')
        })
        expect(beforeSubmit).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })
})
