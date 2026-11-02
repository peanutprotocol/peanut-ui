/**
 * The ledger reads the pre-manager prompts' own "seen" fields once, so a
 * device that already snoozed a prompt is not asked again the day the
 * manager ships. The manager writes only its own `attention` field.
 */
jest.mock('../ledgerSync', () => ({ scheduleLedgerSync: jest.fn() }))
let mockSunsetOn = false
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => mockSunsetOn }))

import { ledgerActions, legacyEntries, persistLegacyLedger, readLedger } from '../ledger'
import { scheduleLedgerSync } from '../ledgerSync'
import { isSilenced } from '../decide'
import { finishCardSetup, legalReconsent } from '../registry'
import type { JourneyState } from '../types'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

const USER = 'user-a'
const DAY_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
    window.localStorage.clear()
    mockSunsetOn = false
    ;(scheduleLedgerSync as jest.Mock).mockClear()
})

describe('legacyEntries', () => {
    test('maps every old field to its ask', () => {
        const closedAt = '2026-10-01T00:00:00.000Z'
        window.localStorage.setItem(`peanut.reconsent.snoozedUntil.${USER}`, String(Date.parse('2026-10-20T00:00:00Z')))
        const entries = legacyEntries(USER, {
            migrationPromptSnoozedAt: closedAt,
            hasSeenBalanceWarning: { value: true, expiry: Date.parse('2026-10-22T00:00:00Z') },
            notifModalClosedAt: closedAt,
            dismissedCarouselCTAs: {
                'invite-friends': closedAt,
                'blocked-card:verification-issue:provider_rejected': closedAt,
            },
        })
        expect(entries['legal-reconsent']?.snoozedUntil).toBe('2026-10-20T00:00:00.000Z')
        expect(entries['install-app']?.snoozedUntil).toBe('2026-10-04T00:00:00.000Z')
        expect(entries['balance-backup']?.snoozedUntil).toBe('2026-10-22T00:00:00.000Z')
        // flag off: the old push prompt closed forever
        expect(entries['push-home-fallback']).toEqual({ dismissedAt: closedAt, updatedAt: closedAt })
        expect(entries['blocked-card']).toEqual({
            dismissedAt: closedAt,
            version: 'blocked-card:verification-issue:provider_rejected',
            updatedAt: closedAt,
        })
    })

    test('with the sunset flag on, a closed push prompt is a 14-day snooze', () => {
        mockSunsetOn = true
        const entries = legacyEntries(USER, { notifModalClosedAt: '2026-10-01T00:00:00.000Z' })
        expect(entries['push-home-fallback']).toEqual({
            snoozedUntil: '2026-10-15T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
        })
    })

    test('the legacy boolean push flag counts as closed', () => {
        expect(legacyEntries(USER, { notifModalClosed: true })['push-home-fallback']?.dismissedAt).toBeDefined()
    })

    test('a corrupt re-consent snooze is ignored', () => {
        window.localStorage.setItem(`peanut.reconsent.snoozedUntil.${USER}`, 'soon')
        expect(legacyEntries(USER, undefined)['legal-reconsent']).toBeUndefined()
    })
})

describe('readLedger and writes', () => {
    test('returns the same object while nothing changed, a new one after a write', () => {
        updateUserPreferences(USER, { migrationPromptSnoozedAt: '2026-10-01T00:00:00.000Z' })
        const first = readLedger(USER)
        expect(readLedger(USER)).toBe(first)
        ledgerActions.dismissed(USER, 'early-user', Date.parse('2026-10-11T00:00:00Z'))
        const second = readLedger(USER)
        expect(second).not.toBe(first)
        expect(second['early-user']?.dismissedAt).toBe('2026-10-11T00:00:00.000Z')
        // legacy entries survive next to the manager's own
        expect(second['install-app']?.snoozedUntil).toBeDefined()
    })

    test('the manager writes only its own field', () => {
        ledgerActions.snoozed(USER, 'install-app', Date.parse('2026-10-14T00:00:00Z'))
        const prefs = getUserPreferences(USER)
        expect(prefs?.attention?.['install-app']?.snoozedUntil).toBe('2026-10-14T00:00:00.000Z')
        expect(prefs?.migrationPromptSnoozedAt).toBeUndefined()
    })

    test('a newer stored answer outranks its legacy counterpart', () => {
        updateUserPreferences(USER, { migrationPromptSnoozedAt: '2026-10-01T00:00:00.000Z' })
        ledgerActions.snoozed(USER, 'install-app', Date.parse('2026-12-01T00:00:00Z'))
        expect(readLedger(USER)['install-app']?.snoozedUntil).toBe('2026-12-01T00:00:00.000Z')
    })

    test('zone fatigue counts consecutive sessions', () => {
        const now = Date.parse('2026-10-11T00:00:00Z')
        ledgerActions.shown(USER, 'checklist', now, 'zone', 4)
        ledgerActions.shown(USER, 'checklist', now + DAY_MS, 'zone', 5)
        ledgerActions.shown(USER, 'checklist', now + DAY_MS, 'zone', 5)
        expect(readLedger(USER).checklist).toMatchObject({ lastSessionShown: 5, consecutiveSessions: 2 })
        ledgerActions.shown(USER, 'checklist', now + 9 * DAY_MS, 'zone', 9)
        expect(readLedger(USER).checklist).toMatchObject({ lastSessionShown: 9, consecutiveSessions: 1 })
    })

    test('interrupt history is capped', () => {
        const now = Date.parse('2026-10-11T00:00:00Z')
        for (let i = 0; i < 12; i++) ledgerActions.shown(USER, 'early-user', now + i, 'interrupt', 1)
        expect(readLedger(USER)['early-user']?.shownAt).toHaveLength(10)
    })

    test('logged out reads an empty ledger', () => {
        expect(readLedger(null)).toEqual({})
    })
})

describe('hostile storage', () => {
    test('a corrupt attention field never reaches decide()', () => {
        updateUserPreferences(USER, {
            attention: {
                'early-user': { shownAt: 42, dismissedAt: 'yesterday', snoozedUntil: null, version: 7 },
                checklist: 'nope',
                'install-app': { snoozedUntil: '2026-10-14T00:00:00.000Z', lastSessionShown: 'x' },
            } as never,
        })
        const ledger = readLedger(USER)
        expect(ledger['early-user']).toEqual({})
        expect(ledger.checklist).toBeUndefined()
        expect(ledger['install-app']).toEqual({ snoozedUntil: '2026-10-14T00:00:00.000Z' })
        // a write on top of garbage stays well-typed
        ledgerActions.shown(USER, 'early-user', Date.parse('2026-10-11T00:00:00Z'), 'interrupt', 1)
        expect(readLedger(USER)['early-user']?.shownAt).toEqual(['2026-10-11T00:00:00.000Z'])
    })

    test('garbage legacy dates are ignored', () => {
        const entries = legacyEntries(USER, {
            migrationPromptSnoozedAt: 'soon',
            notifModalClosedAt: 'later',
            dismissedCarouselCTAs: { 'blocked-card:add-email:none': 'whenever' },
        })
        expect(entries['install-app']).toBeUndefined()
        expect(entries['push-home-fallback']).toBeUndefined()
        expect(entries['blocked-card']?.dismissedAt).toBe(new Date(0).toISOString())
    })
})

describe('a snooze under a new version', () => {
    test.each([legalReconsent, finishCardSetup])(
        '$id: the dismissal recorded for the previous version does not outlive the new snooze',
        (ask) => {
            const now = Date.parse('2026-11-02T00:00:00Z')
            const state = { now, consent: { versions: ['v2'] }, card: { activeCardId: 'v2' } } as JourneyState
            ledgerActions.dismissed(USER, ask.id, now - DAY_MS, 'v1')
            expect(isSilenced(ask, readLedger(USER)[ask.id], state)).toBe(false)
            ledgerActions.snoozed(USER, ask.id, now + 1000, 'v2')
            expect(readLedger(USER)[ask.id]?.dismissedAt).toBeUndefined()
            expect(isSilenced(ask, readLedger(USER)[ask.id], state)).toBe(true)
            expect(isSilenced(ask, readLedger(USER)[ask.id], { ...state, now: now + 1001 })).toBe(false)
        }
    )

    test('a snooze under the same version keeps the dismissal', () => {
        ledgerActions.dismissed(USER, 'legal-reconsent', Date.now(), 'v1')
        ledgerActions.snoozed(USER, 'legal-reconsent', Date.now() + DAY_MS, 'v1')
        expect(readLedger(USER)['legal-reconsent']?.dismissedAt).toBeDefined()
    })
})

describe('pre-manager closes', () => {
    const closed = '2026-10-01T00:00:00.000Z'

    test('a show recorded on the server does not bring a closed card back', () => {
        updateUserPreferences(USER, { dismissedCarouselCTAs: { 'card-offer': closed } })
        expect(readLedger(USER)['card-offer']?.dismissedAt).toBe(closed)
        const server = {
            'card-offer': { shownAt: ['2026-11-01T00:00:00.000Z'], updatedAt: '2026-11-01T00:00:00.000Z' },
        }
        expect(readLedger(USER, server)['card-offer']?.dismissedAt).toBe(closed)
    })

    test('a stored show does not lift the legacy push snooze', () => {
        mockSunsetOn = true
        const closedAt = new Date(Date.now() - DAY_MS).toISOString()
        updateUserPreferences(USER, { notifModalClosedAt: closedAt })
        ledgerActions.shown(USER, 'push-home-fallback', Date.now() - 30 * DAY_MS, 'interrupt', 3)
        expect(Date.parse(readLedger(USER)['push-home-fallback']?.snoozedUntil ?? '')).toBeGreaterThan(Date.now())
    })

    test('the next write carries every legacy close into the synced store, once', () => {
        updateUserPreferences(USER, { dismissedCarouselCTAs: { 'invite-friends': closed } })
        ledgerActions.shown(USER, 'card-offer', Date.now(), 'zone', 3)
        expect(scheduleLedgerSync).toHaveBeenCalledWith(
            USER,
            expect.objectContaining({ invite: expect.objectContaining({ dismissedAt: closed, updatedAt: closed }) })
        )
        expect(getUserPreferences(USER)?.attentionLegacyPersisted).toBe(true)
    })

    test('persistLegacyLedger copies and syncs the closes once per user', () => {
        updateUserPreferences(USER, { dismissedCarouselCTAs: { 'bug-bounty': closed } })
        persistLegacyLedger(USER)
        expect(getUserPreferences(USER)?.attention?.['bug-bounty']).toMatchObject({ dismissedAt: closed })
        expect(scheduleLedgerSync).toHaveBeenCalledTimes(1)
        persistLegacyLedger(USER)
        expect(scheduleLedgerSync).toHaveBeenCalledTimes(1)
    })
})
