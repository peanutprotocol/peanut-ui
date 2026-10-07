import { buildPaymentTimeline } from '../payment-timeline'
import type { TransactionDetails } from '../transactionTransformer'
import type { EHistoryUserRole } from '@/utils/history.utils'

export const payment: TransactionDetails = {
    id: 'payment',
    direction: 'send',
    userName: 'Alex',
    fullName: 'Alex',
    initials: 'A',
    amount: 10,
    status: 'processing',
    date: '2026-10-07T10:00:00Z',
    createdAt: '2026-10-07T10:00:00Z',
    intentStatus: 'PROCESSING',
    paymentStatus: 'FUNDS_RECEIVED',
    totalAmountCollected: 0,
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: 'SENDER' as EHistoryUserRole,
        kind: 'OFFRAMP',
        provider: 'BRIDGE',
    },
    timeline: [
        { status: 'PENDING', providerStatus: 'awaiting_funds', time: '2026-10-07T10:00:00Z' },
        { status: 'PROCESSING', providerStatus: 'funds_received', time: '2026-10-07T10:01:00Z' },
    ],
}

const recordedSteps = (transaction: TransactionDetails) =>
    buildPaymentTimeline(transaction).filter((step) => !step.state)

describe('payment timeline', () => {
    it('shows the full Bridge path with undated grey future milestones', () => {
        const result = buildPaymentTimeline(payment)
        expect(result.map(({ step }) => step)).toEqual([
            'created',
            'awaitingFunds',
            'fundsReceived',
            'submitted',
            'completed',
        ])
        expect(result.slice(-2)).toEqual([
            { step: 'submitted', state: 'upcoming' },
            { step: 'completed', state: 'upcoming' },
        ])
    })

    it('keeps the full path visible from the first pending stage', () => {
        const result = buildPaymentTimeline({
            ...payment,
            intentStatus: 'PENDING',
            paymentStatus: 'AWAITING_FUNDS',
            timeline: payment.timeline!.slice(0, 1),
        })
        expect(result.slice(2).map(({ state }) => state)).toEqual(['upcoming', 'upcoming', 'upcoming'])
        expect(result.at(-1)).toEqual({ step: 'completed', state: 'upcoming' })
    })

    it('keeps missing past events unrecorded rather than implying they completed', () => {
        const result = buildPaymentTimeline({
            ...payment,
            timeline: [],
            intentStatus: 'COMPLETED',
            paymentStatus: 'PAYMENT_PROCESSED',
            completedAt: '2026-10-07T10:06:00Z',
        })
        expect(result.slice(1, -1)).toEqual([
            { step: 'awaitingFunds', state: 'unrecorded' },
            { step: 'fundsReceived', state: 'unrecorded' },
            { step: 'submitted', state: 'unrecorded' },
        ])
        expect(result.at(-1)).toEqual({ step: 'completed', time: '2026-10-07T10:06:00.000Z' })
    })

    it('marks the rest of a failed route not reached, rather than promising completion', () => {
        const result = buildPaymentTimeline({
            ...payment,
            intentStatus: 'FAILED',
            paymentStatus: 'ERROR',
            timeline: [...payment.timeline!, { status: 'FAILED', time: '2026-10-07T10:02:00Z' }],
        })
        expect(result.at(-1)).toEqual({ step: 'completed', state: 'notReached' })
        expect(result.filter(({ state }) => !state).at(-1)?.step).toBe('failed')
    })

    it('ends a send-link route at a future claim, not escrow funding completion', () => {
        const result = buildPaymentTimeline({
            ...payment,
            status: 'pending',
            intentStatus: 'COMPLETED',
            paymentStatus: 'COMPLETED',
            timeline: [{ status: 'COMPLETED', time: '2026-10-07T10:01:00Z' }],
            extraDataForDrawer: { ...payment.extraDataForDrawer!, kind: 'SEND_LINK', provider: 'PEANUT' },
        })
        expect(result.at(-1)).toEqual({ step: 'claimed', state: 'upcoming' })
        expect(result.filter(({ state }) => !state).at(-1)?.step).toBe('readyToClaim')
    })

    it('uses card settlement stages for card payments', () => {
        const result = buildPaymentTimeline({
            ...payment,
            intentStatus: 'AWAITING_SETTLEMENT',
            paymentStatus: undefined,
            timeline: [],
            extraDataForDrawer: { ...payment.extraDataForDrawer!, kind: 'CARD_SPEND_AUTH', provider: 'RAIN' },
        })
        expect(result.map(({ step }) => step)).toEqual(['created', 'awaitingSettlement', 'completed'])
        expect(result.at(-1)?.state).toBe('upcoming')
    })

    it('preserves recorded intermediary stages without inventing observations', () => {
        expect(recordedSteps(payment).map((s) => s.step)).toEqual(['created', 'awaitingFunds', 'fundsReceived'])
    })

    it('sorts events, keeps equal-time distinct phases, and collapses adjacent webhook repeats', () => {
        const timeline = [
            payment.timeline![1],
            payment.timeline![0],
            payment.timeline![1],
            { status: 'PROCESSING', providerStatus: 'payment_submitted', time: '2026-10-07T10:01:00Z' },
        ]
        expect(recordedSteps({ ...payment, paymentStatus: 'PAYMENT_SUBMITTED', timeline }).map((s) => s.step)).toEqual([
            'created',
            'awaitingFunds',
            'fundsReceived',
            'submitted',
        ])
    })

    it.each([
        'AWAITING_USER_ACTION',
        'AWAITING_SETTLEMENT',
        'PROCESSING',
        'COMPLETED',
        'FAILED',
        'CANCELLED',
        'REFUNDED',
    ])('keeps the canonical %s state even when the list badge is collapsed', (status) => {
        const result = recordedSteps({
            ...payment,
            intentStatus: status,
            paymentStatus: undefined,
            timeline: [],
            completedAt: status === 'COMPLETED' ? '2026-10-07T10:02:00Z' : undefined,
        })
        expect(result).toHaveLength(2)
        expect(result[1].step).not.toBe('pending')
        if (status !== 'COMPLETED') expect(result[1].time).toBeUndefined()
    })

    it('uses only known dates on older API responses', () => {
        const result = recordedSteps({
            ...payment,
            intentStatus: undefined,
            paymentStatus: undefined,
            status: 'completed',
            timeline: undefined,
            completedAt: '2026-10-07T10:02:00Z',
        })
        expect(result).toEqual([
            { step: 'created', time: '2026-10-07T10:00:00.000Z' },
            { step: 'completed', time: '2026-10-07T10:02:00.000Z' },
        ])
    })

    it('does not invent a failure timestamp or show an invalid date', () => {
        expect(
            recordedSteps({
                ...payment,
                intentStatus: 'FAILED',
                paymentStatus: undefined,
                createdAt: 'bad',
                timeline: [{ status: 'FAILED', time: 'bad' }],
            })
        ).toEqual([{ step: 'failed', time: undefined }])
    })

    it('ignores unknown, malformed and pre-creation events', () => {
        const timeline = [
            { status: 'FUTURE_STATE', time: '2026-10-07T10:01:00Z' },
            { status: 'PROCESSING', time: 'bad' },
            { status: 'FAILED', time: '2026-10-06T10:00:00Z' },
        ]
        expect(recordedSteps({ ...payment, timeline })).toEqual([
            { step: 'created', time: '2026-10-07T10:00:00.000Z' },
            { step: 'fundsReceived', time: undefined },
        ])
    })

    it.each(['PAYMENT_PROCESSED', 'ERROR', 'UNDELIVERABLE'])(
        'retains failure followed by a refund despite stale %s metadata',
        (providerStatus) => {
            const result = recordedSteps({
                ...payment,
                intentStatus: 'REFUNDED',
                paymentStatus: providerStatus,
                timeline: [
                    { status: 'FAILED', time: '2026-10-07T10:01:00Z' },
                    { status: 'REFUNDED', time: '2026-10-07T10:02:00Z' },
                ],
            })
            expect(result.map((s) => s.step)).toEqual(['created', 'failed', 'refunded'])
        }
    )

    it('does not call an escrowed send-link complete before it is claimed', () => {
        const link = {
            ...payment,
            intentStatus: 'COMPLETED',
            paymentStatus: 'COMPLETED',
            status: 'pending' as const,
            timeline: [{ status: 'COMPLETED', time: '2026-10-07T10:01:00Z' }],
            extraDataForDrawer: {
                ...payment.extraDataForDrawer!,
                kind: 'SEND_LINK' as const,
                provider: 'PEANUT' as const,
            },
        }
        expect(recordedSteps(link).at(-1)?.step).toBe('readyToClaim')
        expect(recordedSteps({ ...link, status: 'completed', claimedAt: '2026-10-07T10:02:00Z' }).at(-1)).toEqual({
            step: 'claimed',
            time: '2026-10-07T10:02:00.000Z',
        })
        expect(
            recordedSteps({ ...link, status: 'cancelled', cancelledDate: '2026-10-07T10:02:00Z' }).at(-1)?.step
        ).toBe('cancelled')
    })

    it('does not create a single-payment timeline for aggregate pots and open requests', () => {
        expect(recordedSteps({ ...payment, isRequestPotLink: true })).toEqual([])
        expect(recordedSteps({ ...payment, direction: 'request_received' })).toEqual([])
    })
})
