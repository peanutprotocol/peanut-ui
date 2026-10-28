/**
 * Phase 5: the ledger lives on the server too. Two copies (this device, the
 * user profile) merge per ask by `updatedAt`, and every local write is synced
 * back through one debounced `updateUserById` call.
 */
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => false }))
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))

import * as Sentry from '@sentry/nextjs'
import { updateUserById } from '@/app/actions/users'
import { updateUserPreferences } from '@/utils/general.utils'
import { ledgerActions, mergeLedgers, readLedger } from '../ledger'
import { flushLedgerSyncForTests, resetLedgerSyncForTests, scheduleLedgerSync } from '../ledgerSync'
import type { Ledger, LedgerEntry } from '../types'

const USER_A = 'user-a'
const USER_B = 'user-b'
const T0 = Date.parse('2026-10-11T00:00:00Z')
const iso = (ms: number) => new Date(ms).toISOString()
const OLD = iso(T0 - 60_000)
const NEW = iso(T0)

const entry = (fields: Record<string, unknown>) => fields as LedgerEntry
const ledger = (fields: Record<string, unknown>) => fields as Ledger
const updatedAtOf = (e: LedgerEntry | undefined) => (e as { updatedAt?: string } | undefined)?.updatedAt

const syncMock = updateUserById as jest.Mock
const sentry = Sentry as unknown as { addBreadcrumb: jest.Mock; captureException: jest.Mock }

beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(T0)
    window.localStorage.clear()
    resetLedgerSyncForTests()
    syncMock.mockReset().mockResolvedValue(undefined)
    sentry.addBreadcrumb.mockReset()
    sentry.captureException.mockReset()
})

afterEach(() => {
    resetLedgerSyncForTests()
    jest.useRealTimers()
})

test('a write stamps updatedAt', () => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    expect(updatedAtOf(readLedger(USER_A).invite)).toBe(NEW)
    jest.setSystemTime(T0 + 1000)
    ledgerActions.cleared(USER_A, 'invite')
    expect(updatedAtOf(readLedger(USER_A).invite)).toBe(iso(T0 + 1000))
})

test('1: two devices disagree on an ask, the newest updatedAt wins on both sides', () => {
    const localNewer = ledger({
        invite: { dismissedAt: NEW, updatedAt: NEW },
        'card-offer': { snoozedUntil: OLD, updatedAt: OLD },
        'bug-bounty': { dismissedAt: OLD, updatedAt: NEW },
        rewards: { dismissedAt: NEW, updatedAt: NEW },
    })
    const server = ledger({
        invite: { snoozedUntil: OLD, updatedAt: OLD },
        'card-offer': { dismissedAt: NEW, updatedAt: NEW },
        'bug-bounty': { snoozedUntil: NEW, updatedAt: NEW },
        'user-interview': { dismissedAt: OLD, updatedAt: OLD },
    })
    const merged = mergeLedgers(localNewer, server)
    expect(merged.invite).toEqual(entry({ dismissedAt: NEW, updatedAt: NEW }))
    expect(merged['card-offer']).toEqual(entry({ dismissedAt: NEW, updatedAt: NEW }))
    // a tie keeps local
    expect(merged['bug-bounty']).toEqual(entry({ dismissedAt: OLD, updatedAt: NEW }))
    // one side only passes through
    expect(merged.rewards).toEqual(entry({ dismissedAt: NEW, updatedAt: NEW }))
    expect(merged['user-interview']).toEqual(entry({ dismissedAt: OLD, updatedAt: OLD }))
    // pure: neither input is touched
    expect(localNewer.invite).toEqual(entry({ dismissedAt: NEW, updatedAt: NEW }))
    expect(server.invite).toEqual(entry({ snoozedUntil: OLD, updatedAt: OLD }))
})

test('2: an old-client entry without updatedAt counts as epoch 0; a fresh write always stamps', () => {
    updateUserPreferences(USER_A, { attention: { invite: { snoozedUntil: NEW } } })
    const server = ledger({ invite: { dismissedAt: iso(0), updatedAt: iso(1) } })
    expect(readLedger(USER_A, server).invite).toEqual(entry({ dismissedAt: iso(0), updatedAt: iso(1) }))

    jest.setSystemTime(T0 + 1000)
    ledgerActions.snoozed(USER_A, 'invite', T0 + 5000)
    const after = readLedger(USER_A, server).invite
    expect(after?.snoozedUntil).toBe(iso(T0 + 5000))
    expect(updatedAtOf(after)).toBe(iso(T0 + 1000))
})

test('3: garbage from the server is sanitized', () => {
    const server = ledger({
        invite: 'junk',
        'card-offer': { dismissedAt: 42, snoozedUntil: NEW, updatedAt: 'tomorrow', version: 7 },
        rewards: { dismissedAt: OLD, updatedAt: NEW, extra: { evil: true } },
    })
    const result = readLedger(USER_A, server)
    expect(result.invite).toBeUndefined()
    expect(result['card-offer']).toEqual(entry({ snoozedUntil: NEW }))
    expect(result.rewards).toEqual(entry({ dismissedAt: OLD, updatedAt: NEW }))
    expect(() => readLedger(USER_A, 'not a ledger' as unknown as Ledger)).not.toThrow()
    expect(() => readLedger(USER_A, null as unknown as Ledger)).not.toThrow()
})

test('4: a failed sync is swallowed with a breadcrumb and retried on the next write', async () => {
    syncMock.mockRejectedValueOnce(new Error('offline'))
    ledgerActions.dismissed(USER_A, 'invite', T0)
    await jest.advanceTimersByTimeAsync(2000)
    await flushLedgerSyncForTests()
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(sentry.addBreadcrumb).toHaveBeenCalled()
    expect(sentry.captureException).not.toHaveBeenCalled()

    ledgerActions.snoozed(USER_A, 'card-offer', T0 + 5000)
    await jest.advanceTimersByTimeAsync(2000)
    expect(syncMock).toHaveBeenCalledTimes(2)
    const { attentionLedger } = syncMock.mock.calls[1][0]
    expect(Object.keys(attentionLedger).sort()).toEqual(['card-offer', 'invite'])
})

test('5: a write storm is debounced into one call per quiet period', async () => {
    ledgerActions.shown(USER_A, 'invite', T0, 'zone', 3)
    await jest.advanceTimersByTimeAsync(1500)
    ledgerActions.dismissed(USER_A, 'invite', T0 + 1500)
    await jest.advanceTimersByTimeAsync(1999)
    expect(syncMock).not.toHaveBeenCalled()
    await jest.advanceTimersByTimeAsync(1)
    expect(syncMock).toHaveBeenCalledTimes(1)
    const payload = syncMock.mock.calls[0][0]
    expect(payload.userId).toBe(USER_A)
    expect(payload.attentionLedger.invite).toMatchObject({ lastSessionShown: 3, dismissedAt: iso(T0 + 1500) })
    await jest.advanceTimersByTimeAsync(10_000)
    expect(syncMock).toHaveBeenCalledTimes(1)
})

test('6: a user switch cancels the pending sync, never cross-posting', async () => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    ledgerActions.dismissed(USER_B, 'rewards', T0)
    await jest.advanceTimersByTimeAsync(2000)
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(syncMock.mock.calls[0][0].userId).toBe(USER_B)
    expect(Object.keys(syncMock.mock.calls[0][0].attentionLedger)).toEqual(['rewards'])

    scheduleLedgerSync(USER_A, { invite: entry({ dismissedAt: NEW }) })
    scheduleLedgerSync(USER_B, { rewards: entry({ dismissedAt: NEW }) })
    await flushLedgerSyncForTests()
    expect(syncMock).toHaveBeenCalledTimes(2)
    expect(syncMock.mock.calls[1][0]).toEqual({ userId: USER_B, attentionLedger: { rewards: { dismissedAt: NEW } } })
})

test("7: user A's server copy never shows up under user B", () => {
    const serverA = ledger({ invite: { dismissedAt: NEW, updatedAt: NEW } })
    expect(readLedger(USER_A, serverA).invite).toBeDefined()
    expect(readLedger(USER_B).invite).toBeUndefined()
    expect(readLedger(USER_B, {}).invite).toBeUndefined()
})

test('readLedger is a stable snapshot over both local and server inputs', () => {
    updateUserPreferences(USER_A, { attention: { invite: { dismissedAt: OLD } } })
    const server = ledger({ rewards: { dismissedAt: OLD, updatedAt: OLD } })
    const first = readLedger(USER_A, server)
    expect(readLedger(USER_A, server)).toBe(first)

    const changedServer = readLedger(USER_A, ledger({ rewards: { dismissedAt: NEW, updatedAt: NEW } }))
    expect(changedServer).not.toBe(first)
    expect(changedServer.rewards?.dismissedAt).toBe(NEW)

    const settled = readLedger(USER_A, server)
    ledgerActions.snoozed(USER_A, 'card-offer', T0 + 5000)
    const changedLocal = readLedger(USER_A, server)
    expect(changedLocal).not.toBe(settled)
    expect(changedLocal['card-offer']?.snoozedUntil).toBe(iso(T0 + 5000))
})
