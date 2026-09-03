// the friction suppressor: recent trouble silences the review ask

import { hadRecentFriction, noteAppReviewFriction } from '../app-review-friction'

const KEY = 'peanut:app-review-friction'
const DAY_MS = 86_400_000

describe('app-review friction', () => {
    beforeEach(() => window.localStorage.clear())

    it('reports no friction on a clean device', () => {
        expect(hadRecentFriction()).toBe(false)
    })

    it.each(['send_failed', 'withdraw_failed', 'claim_link_failed', 'backend_error_shown', 'kyc_rejected'])(
        'records %s as friction',
        (event) => {
            noteAppReviewFriction(event)

            expect(hadRecentFriction()).toBe(true)
        }
    )

    it('ignores events that are not failures', () => {
        noteAppReviewFriction('send_link_created')
        noteAppReviewFriction('points_earned')

        expect(hadRecentFriction()).toBe(false)
    })

    it('lets friction expire after a week', () => {
        window.localStorage.setItem(KEY, String(Date.now() - 8 * DAY_MS))

        expect(hadRecentFriction()).toBe(false)
    })

    it('still counts friction from six days ago', () => {
        window.localStorage.setItem(KEY, String(Date.now() - 6 * DAY_MS))

        expect(hadRecentFriction()).toBe(true)
    })

    it('treats an unreadable stamp as no friction rather than throwing', () => {
        window.localStorage.setItem(KEY, 'not-a-timestamp')

        expect(hadRecentFriction()).toBe(false)
    })
})
