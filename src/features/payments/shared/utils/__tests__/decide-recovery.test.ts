/**
 * Every branch of one recovery round, as a table: what was read -> the
 * ChargeSendFlow.tla action recovery takes next (mono
 * engineering/api/state-machines/ChargeSendFlow.tla, Fixed = TRUE).
 */
import type { Hash } from 'viem'
import { decideRecovery, RECOVERY_INTERVAL_MS, type RecoveryAction, type RecoveryRead } from '../decide-recovery'
import { chargeOrderState, type PendingChargeSend } from '../pending-charge-send'

const DAY_MS = 24 * 60 * 60 * 1000
const STARTED = 1_000_000
const NOW = STARTED + 5_000
const OPEN_DEADLINE = NOW + 60_000

const SENT = `0x${'aa'.repeat(32)}` as Hash
const HELD = `0x${'bb'.repeat(32)}` as Hash
const EXECUTED = `0x${'cc'.repeat(32)}` as Hash
const op = (n: number, nonce: string) => ({ userOpHash: `0x${String(n).repeat(64)}` as Hash, nonce })

const send = (change: Partial<PendingChargeSend> = {}): PendingChargeSend => ({
    chargeId: 'charge-1',
    startedAt: STARTED,
    userOps: [op(1, '7')],
    backendBroadcast: false,
    ...change,
})

type Row = [string, Partial<RecoveryRead>, RecoveryAction]
const rows: Row[] = [
    // Recover: the order is booked
    [
        'booked order, hash from the order',
        { send: send(), order: { state: 'completed', txHash: HELD } },
        { action: 'Recover', outcome: 'completed', txHash: HELD },
    ],
    [
        'booked order, the marker hash wins',
        { send: send({ txHash: SENT }), order: { state: 'completed', txHash: HELD } },
        { action: 'Recover', outcome: 'completed', txHash: SENT },
    ],
    [
        'booked order without a hash',
        { send: send(), order: { state: 'completed' } },
        { action: 'Recover', outcome: 'completed', txHash: undefined },
    ],
    [
        'booked order past the wait window',
        { send: send(), order: { state: 'completed' }, now: STARTED + DAY_MS + 1 },
        { action: 'Recover', outcome: 'completed', txHash: undefined },
    ],

    // ReadUserOps: no hash known yet
    ['no hash, order unbooked', { send: send(), order: { state: 'unbooked' } }, { action: 'ReadUserOps' }],
    ['no hash, the order read failed', { send: send(), order: null }, { action: 'ReadUserOps' }],
    [
        'no hash and no op saved',
        { send: send({ userOps: [], backendBroadcast: true }), order: { state: 'settling' } },
        { action: 'ReadUserOps' },
    ],

    // the order's owner holds the transfer
    [
        'owner hash, order unbooked: book it',
        { send: send(), order: { state: 'unbooked', txHash: HELD } },
        { action: 'RecoverRecord', txHash: HELD, foundTxHash: HELD },
    ],
    [
        'owner hash, order settling: wait',
        { send: send(), order: { state: 'settling', txHash: HELD } },
        { action: 'Wait', foundTxHash: HELD },
    ],
    [
        'owner hash, order closed',
        { send: send(), order: { state: 'closed', txHash: HELD } },
        { action: 'RecoverTimeout', outcome: 'sent', txHash: HELD, foundTxHash: HELD },
    ],
    [
        'owner hash, order closed, past the wait window',
        { send: send(), order: { state: 'closed', txHash: HELD }, now: STARTED + DAY_MS + 1 },
        { action: 'ReleaseWarned', foundTxHash: HELD },
    ],

    // the chain: an op executed
    [
        'op executed, order unbooked: book it',
        { send: send(), order: { state: 'unbooked' }, outcomes: [{ executed: EXECUTED }] },
        { action: 'RecoverRecord', txHash: EXECUTED, foundTxHash: EXECUTED },
    ],
    [
        'op executed, order settling: wait',
        { send: send(), order: { state: 'settling' }, outcomes: [{ executed: EXECUTED }] },
        { action: 'Wait', foundTxHash: EXECUTED },
    ],
    [
        'op executed, order closed',
        { send: send(), order: { state: 'closed' }, outcomes: [{ executed: EXECUTED }] },
        { action: 'RecoverTimeout', outcome: 'sent', txHash: EXECUTED, foundTxHash: EXECUTED },
    ],
    [
        'op executed, the order read failed',
        { send: send(), order: null, outcomes: [{ executed: EXECUTED }] },
        { action: 'Wait', foundTxHash: EXECUTED },
    ],
    [
        'op executed, after one reverted',
        {
            send: send({ userOps: [op(1, '7'), op(2, '8')] }),
            order: { state: 'settling' },
            outcomes: ['reverted', { executed: EXECUTED }],
        },
        { action: 'Wait', foundTxHash: EXECUTED },
    ],

    // the chain: proof that nothing moved
    [
        'op reverted',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['reverted'] },
        { action: 'Recover', outcome: 'not-sent' },
    ],
    [
        'op reverted, the order read failed',
        { send: send(), order: null, outcomes: ['reverted'] },
        { action: 'Recover', outcome: 'not-sent' },
    ],
    [
        'op reverted, past the wait window: proof wins',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['reverted'], now: STARTED + DAY_MS + 1 },
        { action: 'Recover', outcome: 'not-sent' },
    ],
    [
        'nonce-spent with a sibling receipt of that nonce',
        {
            send: send({ userOps: [op(1, '7'), op(2, '7')] }),
            order: { state: 'unbooked' },
            outcomes: ['reverted', 'nonce-spent'],
        },
        { action: 'Recover', outcome: 'not-sent' },
    ],

    // the chain: no proof
    [
        'nonce-spent alone (the receipt index may lag)',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['nonce-spent'] },
        { action: 'Wait' },
    ],
    [
        'nonce-spent, the reverted sibling has another nonce',
        {
            send: send({ userOps: [op(1, '7'), op(2, '8')] }),
            order: { state: 'unbooked' },
            outcomes: ['reverted', 'nonce-spent'],
        },
        { action: 'Wait' },
    ],
    [
        'op not found (may still run)',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['not-found'] },
        { action: 'Wait' },
    ],
    [
        'op read failed (unknown)',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['unknown'] },
        { action: 'Wait' },
    ],
    [
        'one op reverted, one unknown',
        {
            send: send({ userOps: [op(1, '7'), op(2, '7')] }),
            order: { state: 'unbooked' },
            outcomes: ['reverted', 'unknown'],
        },
        { action: 'Wait' },
    ],

    // backend broadcast: only its closed order proves it
    [
        'backend broadcast, order open',
        { send: send({ userOps: [], backendBroadcast: true }), order: { state: 'unbooked' }, outcomes: [] },
        { action: 'Wait' },
    ],
    [
        'backend broadcast, order settling',
        { send: send({ userOps: [], backendBroadcast: true }), order: { state: 'settling' }, outcomes: [] },
        { action: 'Wait' },
    ],
    [
        'backend broadcast, order closed',
        { send: send({ userOps: [], backendBroadcast: true }), order: { state: 'closed' }, outcomes: [] },
        { action: 'Recover', outcome: 'not-sent' },
    ],
    [
        'backend broadcast, the order read failed',
        { send: send({ userOps: [], backendBroadcast: true }), order: null, outcomes: [] },
        { action: 'Wait' },
    ],
    [
        'backend broadcast, ops reverted, order open',
        { send: send({ backendBroadcast: true }), order: { state: 'unbooked' }, outcomes: ['reverted'] },
        { action: 'Wait' },
    ],

    // untracked broadcast: an op without a hash proves nothing
    [
        'untracked broadcast, order open',
        { send: send({ userOps: [], untrackedBroadcast: true }), order: { state: 'unbooked' }, outcomes: [] },
        { action: 'Wait' },
    ],
    [
        'untracked broadcast, order closed',
        { send: send({ userOps: [], untrackedBroadcast: true }), order: { state: 'closed' }, outcomes: [] },
        { action: 'Wait' },
    ],
    [
        'untracked broadcast beside a reverted op',
        { send: send({ untrackedBroadcast: true }), order: { state: 'unbooked' }, outcomes: ['reverted'] },
        { action: 'Wait' },
    ],

    // the marker holds a hash: money left the wallet
    [
        'hash, PENDING charge, record not tried: book it',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PENDING') } },
        { action: 'RecoverRecord', txHash: SENT },
    ],
    [
        'hash, PENDING charge, record tried: wait',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PENDING') }, recordTried: true },
        { action: 'Wait' },
    ],
    [
        'hash, PENDING charge, the flow does not book',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PENDING') }, canRecord: false },
        { action: 'Wait' },
    ],
    [
        'hash, PENDING charge, past the deadline: book first',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PENDING') }, deadline: NOW },
        { action: 'RecoverRecord', txHash: SENT },
    ],
    [
        'hash, PENDING charge, past the wait window: book first',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PENDING') }, now: STARTED + DAY_MS + 1 },
        { action: 'RecoverRecord', txHash: SENT },
    ],
    [
        'hash, PENDING charge, record tried, past the wait window',
        {
            send: send({ txHash: SENT }),
            order: { state: chargeOrderState('PENDING') },
            recordTried: true,
            now: STARTED + DAY_MS + 1,
        },
        { action: 'ReleaseWarned' },
    ],
    [
        'hash, FAILED charge',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('FAILED') } },
        { action: 'RecoverTimeout', outcome: 'sent', txHash: SENT },
    ],
    [
        'hash, CANCELLED charge, past the wait window',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('CANCELLED') }, now: STARTED + DAY_MS + 1 },
        { action: 'ReleaseWarned' },
    ],
    [
        'hash, charge settling',
        { send: send({ txHash: SENT }), order: { state: chargeOrderState('PROCESSING') } },
        { action: 'Wait' },
    ],
    ['hash, the order read failed', { send: send({ txHash: SENT }), order: null }, { action: 'Wait' }],
    [
        'hash, the order read failed, past the deadline',
        { send: send({ txHash: SENT }), order: null, deadline: NOW },
        { action: 'RecoverTimeout', outcome: 'sent', txHash: SENT },
    ],

    // the one-day bound
    [
        'no proof, exactly one day old: still waits',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['not-found'], now: STARTED + DAY_MS },
        { action: 'Wait' },
    ],
    [
        'no proof, one day and 1 ms old',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['not-found'], now: STARTED + DAY_MS + 1 },
        { action: 'ReleaseWarned' },
    ],
    [
        'every read failed, past the wait window',
        { send: send(), order: null, outcomes: ['unknown'], now: STARTED + DAY_MS + 1 },
        { action: 'ReleaseWarned' },
    ],
    [
        'backend broadcast, order open, past the wait window',
        {
            send: send({ userOps: [], backendBroadcast: true }),
            order: { state: 'unbooked' },
            outcomes: [],
            now: STARTED + DAY_MS + 1,
        },
        { action: 'ReleaseWarned' },
    ],
    [
        'the wait window wins over the deadline',
        {
            send: send(),
            order: { state: 'unbooked' },
            outcomes: ['not-found'],
            now: STARTED + DAY_MS + 1,
            deadline: STARTED,
        },
        { action: 'ReleaseWarned' },
    ],

    // the recovery deadline
    [
        'no proof, the next read lands on the deadline: wait',
        { send: send(), order: { state: 'unbooked' }, outcomes: ['not-found'], deadline: NOW + RECOVERY_INTERVAL_MS },
        { action: 'Wait' },
    ],
    [
        'no proof, the next read lands past the deadline',
        {
            send: send(),
            order: { state: 'unbooked' },
            outcomes: ['not-found'],
            deadline: NOW + RECOVERY_INTERVAL_MS - 1,
        },
        { action: 'RecoverTimeout', outcome: 'in-flight' },
    ],
    [
        'executed op, past the deadline',
        { send: send(), order: { state: 'settling' }, outcomes: [{ executed: EXECUTED }], deadline: NOW },
        { action: 'RecoverTimeout', outcome: 'sent', txHash: EXECUTED, foundTxHash: EXECUTED },
    ],
]

it.each(rows)('%s', (_name, read, expected) => {
    expect(
        decideRecovery({
            send: send(),
            order: null,
            canRecord: true,
            recordTried: false,
            now: NOW,
            deadline: OPEN_DEADLINE,
            ...read,
        })
    ).toEqual(expected)
})
