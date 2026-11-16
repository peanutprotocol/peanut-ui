/**
 * Phase 5: the ledger lives on the server too. Two copies (this device, the
 * user profile) merge per ask by `updatedAt`, and every local write is synced
 * back through one debounced `updateUserById` call.
 */
jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn().mockResolvedValue(undefined) }))
jest.mock('@sentry/nextjs', () => ({ addBreadcrumb: jest.fn(), captureException: jest.fn() }))

import * as Sentry from '@sentry/nextjs'
import { updateUserById } from '@/app/actions/users'
import { updateUserPreferences } from '@/utils/general.utils'
import { ledgerActions, mergeLedgers, readLedger } from '../ledger'
import { flushLedgerSync, flushLedgerSyncForTests, resetLedgerSyncForTests, scheduleLedgerSync } from '../ledgerSync'
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

test('an answer stamps updatedAt; a show does not', () => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    expect(updatedAtOf(readLedger(USER_A).invite)).toBe(NEW)
    jest.setSystemTime(T0 + 1000)
    ledgerActions.snoozed(USER_A, 'invite', T0 + 5000)
    expect(updatedAtOf(readLedger(USER_A).invite)).toBe(iso(T0 + 1000))
    jest.setSystemTime(T0 + 2000)
    ledgerActions.shown(USER_A, 'invite', T0 + 2000, 'zone', 3)
    expect(updatedAtOf(readLedger(USER_A).invite)).toBe(iso(T0 + 1000))
})

test('app update answers remain on the device in both directions', async () => {
    const server = ledger({ 'app-update-important': { snoozedUntil: NEW, version: 'old' } })
    expect(readLedger(USER_A, server)['app-update-important']).toBeUndefined()
    ledgerActions.snoozed(USER_A, 'app-update-important', T0 + 5000, 'new')
    ledgerActions.snoozed(USER_A, 'app-update-regular', T0 + 6000, 'new')
    expect(readLedger(USER_A, server)['app-update-important']?.version).toBe('new')
    await flushLedgerSyncForTests()
    const sent = syncMock.mock.calls[0][0].attentionLedger
    expect(sent['app-update-important']).toBeUndefined()
    expect(sent['app-update-regular']).toBeUndefined()
})

test('a server-recorded show never erases a newer answer that has not synced yet', () => {
    // the phone said "Not now" at T0; the email job recorded its show later, on the server
    jest.setSystemTime(T0)
    ledgerActions.snoozed(USER_A, 'card-offer', T0 + 7 * 86_400_000)
    const server = ledger({ 'card-offer': { shownAt: [iso(T0 + 60_000)], updatedAt: iso(T0 + 60_000) } })
    const merged = readLedger(USER_A, server)['card-offer']
    expect(merged?.snoozedUntil).toBe(iso(T0 + 7 * 86_400_000))
    expect(merged?.shownAt).toEqual([iso(T0 + 60_000)])
})

test('show histories from both sides are unioned, oldest first and capped', () => {
    const shown = (n: number) => Array.from({ length: n }, (_, i) => iso(T0 + i * 1000))
    const merged = mergeLedgers(
        ledger({ invite: { shownAt: shown(8) } }),
        ledger({ invite: { shownAt: [...shown(8).slice(4), iso(T0 + 20_000), iso(T0 + 21_000), iso(T0 + 22_000)] } })
    )
    expect(merged.invite?.shownAt).toEqual([...shown(8).slice(1), iso(T0 + 20_000), iso(T0 + 21_000), iso(T0 + 22_000)])
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
    expect(payload.attentionLedger.invite).toMatchObject({ dismissedAt: iso(T0 + 1500) })
    await jest.advanceTimersByTimeAsync(10_000)
    expect(syncMock).toHaveBeenCalledTimes(1)
})

test("6: a user switch keeps each user's pending sync, never cross-posting", async () => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    ledgerActions.dismissed(USER_B, 'rewards', T0)
    await jest.advanceTimersByTimeAsync(2000)
    expect(syncMock).toHaveBeenCalledTimes(2)
    const byUser = Object.fromEntries(
        syncMock.mock.calls.map(([call]) => [call.userId, Object.keys(call.attentionLedger)])
    )
    expect(byUser).toEqual({ [USER_A]: ['invite'], [USER_B]: ['rewards'] })

    scheduleLedgerSync(USER_A, { invite: entry({ dismissedAt: NEW }) })
    scheduleLedgerSync(USER_B, { rewards: entry({ dismissedAt: NEW }) })
    await flushLedgerSyncForTests()
    expect(syncMock).toHaveBeenCalledTimes(4)
    expect(syncMock.mock.calls.slice(2).map(([call]) => call)).toEqual([
        { userId: USER_A, attentionLedger: { invite: { dismissedAt: NEW } } },
        { userId: USER_B, attentionLedger: { rewards: { dismissedAt: NEW } } },
    ])
})

test.each(['pagehide', 'visibilitychange'])('a pending write is sent at once on %s', async (event) => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    await jest.advanceTimersByTimeAsync(100)
    const hidden = jest.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    if (event === 'pagehide') window.dispatchEvent(new Event('pagehide'))
    else document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    expect(syncMock).toHaveBeenCalledTimes(1)
    hidden.mockRestore()
    await jest.advanceTimersByTimeAsync(2000)
    expect(syncMock).toHaveBeenCalledTimes(1)
})

test("flushLedgerSync(userId) sends only that user's pending write (logout, before the token is cleared)", async () => {
    ledgerActions.dismissed(USER_A, 'invite', T0)
    ledgerActions.dismissed(USER_B, 'rewards', T0)
    await flushLedgerSync(USER_A)
    expect(syncMock).toHaveBeenCalledTimes(1)
    expect(syncMock.mock.calls[0][0].userId).toBe(USER_A)
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

test('zone rotation counters stay on the device: never synced, never taken from the server copy', async () => {
    ledgerActions.shown(USER_A, 'invite', T0, 'zone', 3)
    await jest.advanceTimersByTimeAsync(2000)
    expect(syncMock.mock.calls[0][0].attentionLedger.invite).not.toHaveProperty('lastSessionShown')
    expect(syncMock.mock.calls[0][0].attentionLedger.invite).not.toHaveProperty('consecutiveSessions')

    // the phone's session 300 must not make this device's card look recently shown
    const phone = ledger({
        invite: { lastSessionShown: 300, consecutiveSessions: 1, updatedAt: NEW },
        'complete-profile': { lastSessionShown: 300, consecutiveSessions: 2, updatedAt: NEW },
    })
    const merged = readLedger(USER_A, phone)
    expect(merged.invite).toMatchObject({ lastSessionShown: 3, consecutiveSessions: 1 })
    expect(merged['complete-profile']?.lastSessionShown).toBeUndefined()

    // the merge itself never takes counters from the other copy, whichever side has the entry
    const laptop = ledger({ invite: { lastSessionShown: 2, consecutiveSessions: 2, updatedAt: OLD } })
    const pure = mergeLedgers(laptop, phone)
    expect(pure.invite).toMatchObject({ lastSessionShown: 2, consecutiveSessions: 2 })
    expect(pure['complete-profile']).not.toHaveProperty('lastSessionShown')
})

test('push answers stay on the device: never synced, never taken from the server copy', async () => {
    ledgerActions.snoozed(USER_A, 'push-home-fallback', T0 + 14 * 86_400_000)
    ledgerActions.dismissed(USER_A, 'invite', T0)
    await jest.advanceTimersByTimeAsync(2000)
    const synced = syncMock.mock.calls[0][0].attentionLedger
    expect(synced).not.toHaveProperty('push-home-fallback')
    expect(synced).toHaveProperty('invite')

    // another device's denial or "Not now" must not silence this device's push ask
    const other = ledger({ 'push-home-fallback': { dismissedAt: NEW, updatedAt: NEW } })
    expect(readLedger(USER_B, other)['push-home-fallback']).toBeUndefined()
})
