/**
 * Contract tests for useReturnExcessCollateral — the hook that, after a card
 * limit decrease, returns the collateral held above the new limit to the
 * user's smart wallet.
 *
 * The contracts locked down here:
 *  1. below-threshold / no-excess cases return 0 WITHOUT any signing or
 *     submission (the user must not see a passkey prompt),
 *  2. an excess is signed via the FORCED collateral-only strategy (routing
 *     would pick smart-only — a self-transfer no-op — whenever the smart
 *     wallet covers the amount) and submitted for exactly the excess,
 *  3. a missing wallet address fails closed before any signing.
 */
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useReturnExcessCollateral } from '../useReturnExcessCollateral'
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

// `null` sentinels model the not-loaded states (a destructuring default would
// silently swallow an explicit `undefined`).
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
    return renderHook(() => useReturnExcessCollateral(), { wrapper })
}

beforeEach(() => {
    jest.clearAllMocks()
    mockSignSpend.mockResolvedValue({ strategy: 'collateral-only', rainWithdrawal: RAIN_WITHDRAWAL })
    mockSubmitWithdrawal.mockResolvedValue({ txHash: '0xhash' })
})

describe('useReturnExcessCollateral', () => {
    it('skips (no prompt, no submit) when the collateral does not exceed the new limit', async () => {
        const { result } = setup({ spendingPower: 5_000 })
        await act(async () => {
            expect(await result.current.returnExcess(20_000)).toBe(0)
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('skips when the overview has not loaded (no spending power)', async () => {
        const { result } = setup({ spendingPower: null })
        await act(async () => {
            expect(await result.current.returnExcess(5_000)).toBe(0)
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
    })

    it('signs a FORCED collateral-only withdrawal of exactly the excess, to the smart wallet, then submits', async () => {
        const { result } = setup({ spendingPower: 20_000 })
        await act(async () => {
            // $200 backing, limit lowered to $50 → $150 excess
            expect(await result.current.returnExcess(5_000)).toBe(15_000)
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

    it('fails closed before signing when the wallet address is not ready', async () => {
        const { result } = setup({ address: null })
        await act(async () => {
            await expect(result.current.returnExcess(5_000)).rejects.toThrow('Wallet not ready')
        })
        expect(mockSignSpend).not.toHaveBeenCalled()
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })

    it('does not submit when signing fails (passkey cancelled)', async () => {
        mockSignSpend.mockRejectedValue(new Error('user cancelled'))
        const { result } = setup()
        await act(async () => {
            await expect(result.current.returnExcess(5_000)).rejects.toThrow('user cancelled')
        })
        expect(mockSubmitWithdrawal).not.toHaveBeenCalled()
    })
})
