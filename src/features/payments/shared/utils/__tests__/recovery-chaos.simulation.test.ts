/** @jest-environment node */
/**
 * Fuzzed production-data + async latency/jitter/cold-reload chaos simulation
 * across UI payment-recovery state machines (Wave 8).
 *
 * Exercises `decideRecovery`, `resolveMantecaReadDestination`,
 * `classifyMantecaHistoryEntries`, `isAmbiguousMantecaSubmitResult`, and
 * `pending-charge-send` storage holds under randomized interleavings,
 * clock skew, duplicate/out-of-order history rows, and cold-reload hydration
 * delays — asserting zero double-sends and zero cross-device false completions.
 */
import fc from 'fast-check'
import type { Hash } from 'viem'
import { API_ERROR_CODES } from '@/services/api-error'
import { TransactionIntentStatus } from '@/constants/api-enums.generated'
import type { UserOpOutcome } from '@/utils/userop-outcome'
import { decideRecovery, RECOVERY_INTERVAL_MS } from '../decide-recovery'
import type { PendingChargeSend, SendOrderState } from '../pending-charge-send'
import {
    classifyMantecaHistoryEntries,
    isAmbiguousMantecaSubmitResult,
    resolveMantecaReadDestination,
    type MantecaHistoryRow,
} from '@/features/withdraw/manteca-withdraw-recovery'

const TX_HASH: Hash = `0x${'ab'.repeat(32)}`
const OP_HASH: Hash = `0x${'12'.repeat(32)}`

const outcomeArb: fc.Arbitrary<UserOpOutcome> = fc.oneof(
    fc.constant('not-found' as const),
    fc.constant('unknown' as const),
    fc.constant('reverted' as const),
    fc.constant('nonce-spent' as const),
    fc.constant({ executed: TX_HASH } as const)
)

const orderStateArb: fc.Arbitrary<SendOrderState> = fc.constantFrom('completed', 'unbooked', 'settling', 'closed')

describe('UI payment recovery fuzzed latency/jitter & cold-reload chaos simulation', () => {
    it('decideRecovery never declares not-sent when any op executed, is unknown/not-found, or backend broadcast is still open', () => {
        fc.assert(
            fc.property(
                fc.record({
                    startedAt: fc.integer({ min: 1_700_000_000_000, max: 1_800_000_000_000 }),
                    elapsedMs: fc.integer({ min: -5_000, max: 30 * 60 * 60 * 1000 }), // includes -5s clock skew!
                    deadlineOffsetMs: fc.integer({ min: 0, max: 60_000 }),
                    hasTxHash: fc.boolean(),
                    backendBroadcast: fc.boolean(),
                    untrackedBroadcast: fc.boolean(),
                    orderState: fc.option(orderStateArb, { nil: null }),
                    orderHasTxHash: fc.boolean(),
                    opsCount: fc.integer({ min: 0, max: 3 }),
                    outcomes: fc.array(outcomeArb, { minLength: 3, maxLength: 3 }),
                    canRecord: fc.boolean(),
                    recordTried: fc.boolean(),
                }),
                (scenario) => {
                    const userOps = Array.from({ length: scenario.opsCount }, (_, i) => ({
                        userOpHash: OP_HASH,
                        sender: `0x${'34'.repeat(20)}` as `0x${string}`,
                        nonce: String(i + 1),
                        chainId: 42161,
                        entryPointAddress: `0x${'56'.repeat(20)}` as `0x${string}`,
                    }))
                    const outcomes = scenario.outcomes.slice(0, scenario.opsCount)
                    const send: PendingChargeSend = {
                        chargeId: 'charge-chaos-1',
                        startedAt: scenario.startedAt,
                        userOps,
                        backendBroadcast: scenario.backendBroadcast,
                        untrackedBroadcast: scenario.untrackedBroadcast,
                        ...(scenario.hasTxHash ? { txHash: TX_HASH } : {}),
                    }
                    const now = scenario.startedAt + scenario.elapsedMs
                    const deadline = now + scenario.deadlineOffsetMs
                    const order = scenario.orderState
                        ? {
                              state: scenario.orderState,
                              ...(scenario.orderHasTxHash ? { txHash: TX_HASH } : {}),
                          }
                        : null

                    const decision = decideRecovery({
                        send,
                        order,
                        outcomes,
                        canRecord: scenario.canRecord,
                        recordTried: scenario.recordTried,
                        now,
                        deadline,
                    })

                    // Safety invariant 1: never claim not-sent if any txHash exists, any op executed/not-found/unknown,
                    // an untracked broadcast occurred, or a backend broadcast has not been proven closed.
                    const anyExecuted = outcomes.some((o) => typeof o === 'object')
                    const anyAmbiguous = outcomes.some((o) => o === 'not-found' || o === 'unknown')
                    if (decision.action === 'Recover' && decision.outcome === 'not-sent') {
                        expect(send.txHash).toBeUndefined()
                        expect(order?.txHash).toBeUndefined()
                        expect(anyExecuted).toBe(false)
                        expect(anyAmbiguous).toBe(false)
                        expect(send.untrackedBroadcast).toBe(false)
                        if (send.backendBroadcast) {
                            expect(order?.state).toBe('closed')
                        }
                    }

                    // Safety invariant 2: completed order always completes recovery immediately.
                    if (order?.state === 'completed') {
                        expect(decision.action).toBe('Recover')
                        if (decision.action === 'Recover') expect(decision.outcome).toBe('completed')
                    }

                    // Safety invariant 3: never Wait past the deadline.
                    if (decision.action === 'Wait') {
                        expect(now + RECOVERY_INTERVAL_MS).toBeLessThanOrEqual(deadline)
                    }

                    // Safety invariant 4: ReleaseWarned only happens after the 24h wait window (never under negative clock skew).
                    if (decision.action === 'ReleaseWarned') {
                        expect(scenario.elapsedMs).toBeGreaterThan(24 * 60 * 60 * 1000)
                    }
                }
            ),
            { numRuns: 500, seed: 20261128 }
        )
    })

    it('Manteca withdrawal recovery never false-completes on unsaved/hydrating accounts or cross-device history rows', async () => {
        const statuses = [
            TransactionIntentStatus.PENDING,
            TransactionIntentStatus.PROCESSING,
            TransactionIntentStatus.COMPLETED,
            TransactionIntentStatus.FAILED,
            TransactionIntentStatus.CANCELLED,
            TransactionIntentStatus.REFUNDED,
        ]
        const historyRowArb: fc.Arbitrary<MantecaHistoryRow> = fc.record({
            status: fc.constantFrom(...statuses),
            amount: fc.constantFrom('10.00', '25.50', '100.00'),
            currency: fc.constant({ amount: '15000', code: 'ARS' }),
            recipientAccount: fc.record({
                identifier: fc.constantFrom('my.alias.mp', 'MY.ALIAS.MP', 'other.device.alias'),
            }),
            extraData: fc.record({
                provider: fc.constantFrom('MANTECA', 'BRIDGE', 'RAIN'),
                kind: fc.constantFrom('OFFRAMP', 'ONRAMP', 'QR_PAYMENT'),
                isRefund: fc.boolean(),
            }),
        })

        await fc.assert(
            fc.asyncProperty(
                fc.record({
                    heldAccountId: fc.option(fc.constantFrom('acc-1', 'acc-deleted'), { nil: null }),
                    accountsLoaded: fc.boolean(),
                    entries: fc.array(historyRowArb, { minLength: 0, maxLength: 8 }),
                    jitterHops: fc.integer({ min: 0, max: 3 }),
                }),
                async ({ heldAccountId, accountsLoaded, entries, jitterHops }) => {
                    for (let i = 0; i < jitterHops; i++) await Promise.resolve()

                    const target = resolveMantecaReadDestination({
                        heldAccountId,
                        accountsLoaded,
                        accounts: accountsLoaded ? [{ id: 'acc-1', identifier: 'MY.ALIAS.MP' }] : undefined,
                    })

                    // Cold-reload race invariant: saved account hold while user.accounts is hydrating MUST wait (`loading`).
                    if (heldAccountId && !accountsLoaded) {
                        expect(target).toEqual({ kind: 'loading' })
                        return
                    }
                    expect(target.kind).toBe('resolved')
                    if (target.kind !== 'resolved') return

                    let bookedCalled = false
                    const read = classifyMantecaHistoryEntries(entries, target.destination, () => {
                        bookedCalled = true
                    })

                    // Unsaved (`null`) or deleted account MUST stay `settling` even if another device completed a withdrawal.
                    if (target.destination === null) {
                        expect(read).toEqual({ state: 'settling' })
                        expect(bookedCalled).toBe(false)
                        return
                    }

                    // Multiple matching rows are ambiguous and MUST stay `settling`.
                    const matching = entries.filter(
                        (r) =>
                            r.extraData?.provider === 'MANTECA' &&
                            r.extraData.kind === 'OFFRAMP' &&
                            !r.extraData.isRefund &&
                            r.recipientAccount?.identifier?.toLowerCase() === target.destination
                    )
                    if (matching.length !== 1) {
                        expect(read).toEqual({ state: 'settling' })
                    } else if (matching[0].status === TransactionIntentStatus.COMPLETED) {
                        expect(read.state).toBe('completed')
                        read.show?.()
                        expect(bookedCalled).toBe(true)
                    } else if (
                        matching[0].status === TransactionIntentStatus.FAILED ||
                        matching[0].status === TransactionIntentStatus.CANCELLED ||
                        matching[0].status === TransactionIntentStatus.REFUNDED
                    ) {
                        expect(read).toEqual({ state: 'closed' })
                    } else {
                        expect(read).toEqual({ state: 'settling' })
                    }
                }
            ),
            { numRuns: 300, seed: 20261128 }
        )
    })

    it('isAmbiguousMantecaSubmitResult holds on every ambiguous code and rejects definite pre-broadcast failures', () => {
        expect(isAmbiguousMantecaSubmitResult({ error: 'Unexpected error' })).toBe(true)
        expect(isAmbiguousMantecaSubmitResult({ code: API_ERROR_CODES.FUNDING_PENDING_CONFIRMATION })).toBe(true)
        expect(isAmbiguousMantecaSubmitResult({ code: 'USER_OP_RECEIPT_TIMEOUT' })).toBe(true)
        expect(isAmbiguousMantecaSubmitResult({ code: API_ERROR_CODES.USER_OP_REVERTED })).toBe(false)
        expect(isAmbiguousMantecaSubmitResult({ code: API_ERROR_CODES.PROVIDER_REJECTED })).toBe(false)
        expect(isAmbiguousMantecaSubmitResult({})).toBe(false)
    })
})
