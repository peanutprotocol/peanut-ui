/**
 * OnCardScreen is the one screen that both moves money and mutates the
 * balancer's shared policy. These pin its orchestration, not the hooks:
 *  1. move-to-card's idempotency key is bound to the amount — an exact retry
 *     reuses it, an edited amount gets a new one,
 *  2. move-off-card pins the target (and switches load-all off) BEFORE the
 *     withdrawal, and a failed pin aborts the withdrawal,
 *  3. lowering the target offers exactly the excess back, and a failure
 *     there is swallowed (the target already landed).
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import OnCardScreen from '@/components/Card/OnCardScreen'
import { rainApi } from '@/services/rain'
import { useBalanceSplit } from '@/hooks/wallet/useBalanceSplit'
import { useMoveOffCard } from '@/hooks/wallet/useMoveOffCard'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/services/rain', () => ({
    rainApi: { moveToCard: jest.fn(), updateCollateralSettings: jest.fn() },
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ RAIN_CARD_OVERVIEW_QUERY_KEY: 'rain-card-overview' }))
jest.mock('@/hooks/wallet/useBalanceSplit', () => ({ useBalanceSplit: jest.fn() }))
jest.mock('@/hooks/wallet/useMoveOffCard', () => ({ useMoveOffCard: jest.fn() }))
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))

const mockMoveToCard = rainApi.moveToCard as jest.Mock
const mockPatch = rainApi.updateCollateralSettings as jest.Mock
const mockUseBalanceSplit = useBalanceSplit as jest.Mock
const mockUseMoveOffCard = useMoveOffCard as jest.Mock
const mockMoveOffCard = jest.fn()

const CARD_ID = '11111111-2222-3333-4444-555555555555'

function policy(overrides: Partial<Record<string, unknown>> = {}) {
    return {
        targetCents: 10_000,
        targetPinned: false,
        walletFloorCents: 2_500,
        loadAllToCard: false,
        cardLimitCents: 25_000,
        autoBalanceEnabled: true,
        ...overrides,
    }
}

function setup(opts: { onCard?: number; offCard?: number; pending?: number; policy?: ReturnType<typeof policy> } = {}) {
    const p = opts.policy ?? policy()
    mockUseBalanceSplit.mockReturnValue({
        card: { id: CARD_ID, status: 'ACTIVE', hasWithdrawApproval: true, collateral: p },
        hasActiveCard: true,
        policy: p,
        onCardCents: opts.onCard ?? 10_000,
        pendingToCardCents: opts.pending ?? 0,
        offCardCents: opts.offCard ?? 5_000,
        offCardUnits: BigInt((opts.offCard ?? 5_000) * 10_000),
        isLoading: false,
    })
    mockUseMoveOffCard.mockReturnValue({ moveOffCard: mockMoveOffCard })
    return rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <OnCardScreen cardId={CARD_ID} />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )
}

async function submitAmount(buttonLabel: string, dollars: string, ctaLabel = buttonLabel) {
    // the screen-level button is first in document order; a closing modal's CTA may still be leaving
    fireEvent.click(screen.getAllByRole('button', { name: buttonLabel })[0]!)
    const input = await screen.findByLabelText(/Amount/i)
    fireEvent.change(input, { target: { value: dollars } })
    const ctas = screen.getAllByRole('button', { name: ctaLabel })
    fireEvent.click(ctas[ctas.length - 1]!)
}

beforeEach(() => {
    jest.clearAllMocks()
    mockPatch.mockResolvedValue(undefined)
    mockMoveOffCard.mockResolvedValue(0)
    mockMoveToCard.mockResolvedValue({ ok: true, amountCents: 1_000, userOpHash: '0x1' })
})

describe('OnCardScreen — move to card idempotency key', () => {
    it('reuses the key for an exact retry after a failure, and mints a new one when the amount changes', async () => {
        mockMoveToCard.mockRejectedValueOnce(new Error('timeout'))
        setup()

        await submitAmount('Move to card', '10')
        await waitFor(() => expect(mockMoveToCard).toHaveBeenCalledTimes(1))
        const firstKey = mockMoveToCard.mock.calls[0]![1].idempotencyKey as string
        expect(firstKey).toContain('-1000-')

        // the failure is shown and the CTA re-enabled before the exact retry
        await screen.findByText(/Couldn't move the money/)
        const ctas = screen.getAllByRole('button', { name: 'Move to card' })
        fireEvent.click(ctas[ctas.length - 1]!)
        await waitFor(() => expect(mockMoveToCard).toHaveBeenCalledTimes(2))
        expect(mockMoveToCard.mock.calls[1]![1].idempotencyKey).toBe(firstKey)

        // edited amount after success → the modal closed; open again with a new amount
        await submitAmount('Move to card', '15')
        await waitFor(() => expect(mockMoveToCard).toHaveBeenCalledTimes(3))
        const thirdKey = mockMoveToCard.mock.calls[2]![1].idempotencyKey as string
        expect(thirdKey).not.toBe(firstKey)
        expect(thirdKey).toContain('-1500-')
        expect(mockMoveToCard.mock.calls[2]![1].amountCents).toBe(1_500)
    })
})

describe('OnCardScreen — move off card', () => {
    it('pins the target below the remaining amount before withdrawing, and turns load-all off', async () => {
        const order: string[] = []
        mockPatch.mockImplementation(async () => {
            order.push('patch')
        })
        mockMoveOffCard.mockImplementation(async (cents: number) => {
            order.push('withdraw')
            return cents
        })
        setup({ onCard: 10_000, policy: policy({ loadAllToCard: true }) })

        await submitAmount('Move off card', '40')
        await waitFor(() => expect(mockMoveOffCard).toHaveBeenCalledWith(4_000))

        expect(mockPatch).toHaveBeenCalledWith(CARD_ID, { collateralTargetCents: 6_000, loadAllToCard: false })
        expect(order).toEqual(['patch', 'withdraw'])
    })

    it('does not withdraw when the pin fails', async () => {
        mockPatch.mockRejectedValueOnce(new Error('offline'))
        setup({ onCard: 10_000 })

        await submitAmount('Move off card', '40')
        await screen.findByText('offline')

        expect(mockMoveOffCard).not.toHaveBeenCalled()
    })

    it('offers only landed collateral, never the amount still moving to the card', async () => {
        setup({ onCard: 2_000, pending: 8_000 })

        await submitAmount('Move off card', '50')
        await screen.findByText(/maximum is \$20\.00/i)

        expect(mockMoveOffCard).not.toHaveBeenCalled()
        expect(mockPatch).not.toHaveBeenCalled()
    })
})

describe('OnCardScreen — keep on card', () => {
    it('lowering the target returns exactly the excess, and a failed return does not undo the target', async () => {
        mockMoveOffCard.mockRejectedValueOnce(new Error('passkey cancelled'))
        setup({ onCard: 10_000 })

        // the row is a ListItem with role=button; its accessible name starts with the title
        fireEvent.click(screen.getByRole('button', { name: /^Keep on card/ }))
        const input = await screen.findByLabelText(/^Keep on card/)
        fireEvent.change(input, { target: { value: '30' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(CARD_ID, { collateralTargetCents: 3_000 }))
        await waitFor(() => expect(mockMoveOffCard).toHaveBeenCalledWith(7_000))
        // the modal closed: the target change stood even though the return failed
        await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    })
})
