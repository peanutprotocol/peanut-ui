/**
 * The ledger reads the pre-arbiter prompts' own "seen" fields once, so a
 * device that already snoozed a prompt is not asked again the day the
 * arbiter ships. The arbiter writes only its own `attention` field.
 */
let mockSunsetOn = false
jest.mock('@/utils/migration.utils', () => ({ isPwaSunsetOn: () => mockSunsetOn }))

import { ledgerActions, legacyEntries, readLedger } from '../ledger'
import { getUserPreferences, updateUserPreferences } from '@/utils/general.utils'

const USER = 'user-a'
const DAY_MS = 24 * 60 * 60 * 1000

beforeEach(() => {
    window.localStorage.clear()
    mockSunsetOn = false
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
        expect(entries['push-home-fallback']).toEqual({ dismissedAt: closedAt })
        expect(entries['blocked-card']).toEqual({
            dismissedAt: closedAt,
            version: 'blocked-card:verification-issue:provider_rejected',
        })
    })

    test('with the sunset flag on, a closed push prompt is a 14-day snooze', () => {
        mockSunsetOn = true
        const entries = legacyEntries(USER, { notifModalClosedAt: '2026-10-01T00:00:00.000Z' })
        expect(entries['push-home-fallback']).toEqual({ snoozedUntil: '2026-10-15T00:00:00.000Z' })
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
        // legacy entries survive next to the arbiter's own
        expect(second['install-app']?.snoozedUntil).toBeDefined()
    })

    test('the arbiter writes only its own field', () => {
        ledgerActions.snoozed(USER, 'install-app', Date.parse('2026-10-14T00:00:00Z'))
        const prefs = getUserPreferences(USER)
        expect(prefs?.attention?.['install-app']?.snoozedUntil).toBe('2026-10-14T00:00:00.000Z')
        expect(prefs?.migrationPromptSnoozedAt).toBeUndefined()
    })

    test('a stored entry outranks its legacy counterpart', () => {
        updateUserPreferences(USER, { migrationPromptSnoozedAt: '2026-10-01T00:00:00.000Z' })
        ledgerActions.cleared(USER, 'install-app')
        expect(readLedger(USER)['install-app']?.snoozedUntil).toBeUndefined()
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
