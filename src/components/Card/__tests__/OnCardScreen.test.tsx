/**
 * OnCardScreen is the one screen that both moves money and mutates the
 * balancer's shared policy. These pin its orchestration, not the hooks:
 *  1. move-to-card's idempotency key is bound to the amount — an exact retry
 *     reuses it, an edited amount gets a new one,
 *  2. move-off-card lowers the target (unpinned, and switches load-all off)
 *     between the passkey and the broadcast: a cancelled passkey changes no
 *     policy, and a failed lowering does not report a move,
 *  3. lowering the target offers exactly the excess back, and a failure
 *     there is swallowed (the target already landed),
 *  4. the load-all toggle and the off-card floor PATCH their own field, and
 *     a rejected toggle is reported without flipping the switch.
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

type MoveOffOptions = { beforeSubmit?: () => Promise<void> }

beforeEach(() => {
    jest.clearAllMocks()
    mockPatch.mockResolvedValue(undefined)
    // the real hook runs `beforeSubmit` after the passkey and before the broadcast
    mockMoveOffCard.mockImplementation(async (cents: number, opts?: MoveOffOptions) => {
        await opts?.beforeSubmit?.()
        return cents
    })
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
    it('lowers the target (unpinned) and turns load-all off after the passkey, before the broadcast', async () => {
        const order: string[] = []
        mockPatch.mockImplementation(async () => {
            order.push('patch')
        })
        mockMoveOffCard.mockImplementation(async (cents: number, opts?: MoveOffOptions) => {
            order.push('passkey')
            await opts?.beforeSubmit?.()
            order.push('broadcast')
            return cents
        })
        setup({ onCard: 10_000, policy: policy({ loadAllToCard: true }) })

        await submitAmount('Move off card', '40')
        await waitFor(() => expect(order).toContain('broadcast'))

        expect(mockMoveOffCard).toHaveBeenCalledWith(
            4_000,
            expect.objectContaining({ beforeSubmit: expect.any(Function) })
        )
        expect(mockPatch).toHaveBeenCalledWith(CARD_ID, {
            collateralTargetCents: 6_000,
            pinTarget: false,
            loadAllToCard: false,
        })
        expect(order).toEqual(['passkey', 'patch', 'broadcast'])
    })

    it('a cancelled passkey leaves the balancing policy untouched', async () => {
        // the real hook throws from the passkey step without ever calling beforeSubmit
        mockMoveOffCard.mockRejectedValueOnce(new Error('passkey cancelled'))
        setup({ onCard: 10_000 })

        await submitAmount('Move off card', '40')
        await screen.findByText('passkey cancelled')

        expect(mockPatch).not.toHaveBeenCalled()
        expect(mockToast.success).not.toHaveBeenCalled()
    })

    it('a failed lowering aborts the move and reports the error', async () => {
        mockPatch.mockRejectedValueOnce(new Error('offline'))
        setup({ onCard: 10_000 })

        await submitAmount('Move off card', '40')
        await screen.findByText('offline')

        expect(mockToast.success).not.toHaveBeenCalled()
    })

    it('does not touch the target when the remainder still covers it', async () => {
        setup({ onCard: 10_000, policy: policy({ targetCents: 5_000 }) })

        await submitAmount('Move off card', '40')
        await waitFor(() => expect(mockToast.success).toHaveBeenCalled())

        expect(mockPatch).not.toHaveBeenCalled()
        expect(mockMoveOffCard).toHaveBeenCalledWith(4_000, { beforeSubmit: undefined })
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

describe('OnCardScreen — load everything to card', () => {
    it('switching it on PATCHes only that flag', async () => {
        setup()

        fireEvent.click(screen.getByRole('switch', { name: 'Load everything to card' }))

        await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(CARD_ID, { loadAllToCard: true }))
        expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('a rejected PATCH reports the failure and leaves the switch off and usable', async () => {
        mockPatch.mockRejectedValueOnce(new Error('offline'))
        setup()

        const toggle = screen.getByRole('switch', { name: 'Load everything to card' })
        fireEvent.click(toggle)

        await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Couldn't save. Please try again."))
        expect(toggle).toHaveAttribute('aria-checked', 'false')
        await waitFor(() => expect(toggle).not.toBeDisabled())
    })
})

describe('OnCardScreen — keep off card', () => {
    it('saving the floor PATCHes only walletFloorCents', async () => {
        setup()

        fireEvent.click(screen.getByRole('button', { name: /^Keep off card/ }))
        const input = await screen.findByLabelText(/^Keep off card/)
        fireEvent.change(input, { target: { value: '10' } })
        fireEvent.click(screen.getByRole('button', { name: 'Save' }))

        await waitFor(() => expect(mockPatch).toHaveBeenCalledWith(CARD_ID, { walletFloorCents: 1_000 }))
        expect(mockMoveOffCard).not.toHaveBeenCalled()
    })
})
