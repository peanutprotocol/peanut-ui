/**
 * The terms and the to-do list complete from a status (the consent status, the to-do list's steps), so a stored
 * dismissal must not hide them for good: an old one (a crash, a stale build's "Accept", a hidden blocked card)
 * re-arms. A snooze still holds them for its time.
 */
import { isSilenced } from '../decide'
import { checklist, legalReconsent, balanceBackup } from '../registry'
import type { JourneyState } from '../types'

const NOW = Date.parse('2026-10-11T12:00:00Z')
const DAY_MS = 24 * 60 * 60 * 1000
const state = {
    now: NOW,
    consent: {
        status: 'needed',
        versions: ['2026-10-01'],
        documents: [{ slug: 'terms', currentVersion: '2026-10-01' }],
    },
} as unknown as JourneyState

test('a terms dismissal covers the status refetch, then re-arms', () => {
    const at = (ms: number) => ({ dismissedAt: new Date(ms).toISOString(), version: '2026-10-01' })
    expect(isSilenced(legalReconsent, at(NOW - 60_000), state)).toBe(true)
    expect(isSilenced(legalReconsent, at(NOW - 2 * DAY_MS), state)).toBe(false)
})

test('a stored to-do list dismissal never silences the to-do list', () => {
    expect(isSilenced(checklist, { dismissedAt: new Date(NOW - 60_000).toISOString() }, state)).toBe(false)
})

test('a snooze still holds both', () => {
    const snoozedUntil = new Date(NOW + DAY_MS).toISOString()
    expect(isSilenced(legalReconsent, { snoozedUntil, version: '2026-10-01' }, state)).toBe(true)
    expect(isSilenced(checklist, { snoozedUntil }, state)).toBe(true)
})

test('other asks keep their dismissal rule; a future stamp counts as now', () => {
    expect(isSilenced(balanceBackup, { dismissedAt: new Date(NOW - DAY_MS).toISOString() }, state)).toBe(true)
    const immediate = { ...balanceBackup, policy: { expiryDays: 0 } }
    expect(isSilenced(immediate, { dismissedAt: new Date(NOW + 30 * DAY_MS).toISOString() }, state)).toBe(false)
})
