// tests for the app-review request budget — the only control we have, since
// neither OS reports whether the sheet appeared

import { requestAppReview } from '../app-review'
import { getUserPreferences, updateUserPreferences } from '../general.utils'
import { isNativeBridge } from '../capacitor'
import { isDemoMode } from '../demo'
import { hadRecentFriction } from '../app-review-friction'
import posthog from 'posthog-js'

const requestReview = jest.fn<Promise<void>, []>()

jest.mock('@capgo/capacitor-in-app-review', () => ({
    CapgoInAppReview: { requestReview: () => requestReview() },
}))
jest.mock('../capacitor', () => ({ isNativeBridge: jest.fn(), openExternalUrl: jest.fn() }))
jest.mock('../demo', () => ({ isDemoMode: jest.fn() }))
jest.mock('../app-review-friction', () => ({ hadRecentFriction: jest.fn() }))
jest.mock('../general.utils', () => ({ getUserPreferences: jest.fn(), updateUserPreferences: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const USER = 'user-1'
const DAY_MS = 86_400_000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS).toISOString()

/** The stored nudge state after the last updateUserPreferences call. */
const lastWrite = () => (updateUserPreferences as jest.Mock).mock.calls.at(-1)?.[1]?.reviewNudge

function given(moments: number, requestedAt: string[] = []) {
    ;(getUserPreferences as jest.Mock).mockReturnValue({ reviewNudge: { moments, requestedAt } })
}

describe('requestAppReview', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        requestReview.mockResolvedValue(undefined)
        ;(isNativeBridge as jest.Mock).mockReturnValue(true)
        ;(isDemoMode as jest.Mock).mockReturnValue(false)
        ;(hadRecentFriction as jest.Mock).mockReturnValue(false)
        given(1)
    })

    it('asks once the engagement floor is met', async () => {
        await requestAppReview(USER, 'reward_claimed')

        expect(requestReview).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith(
            'review_requested',
            expect.objectContaining({ trigger: 'reward_claimed', request_count: 1, days_since_last: null })
        )
    })

    it('banks the first moment without asking', async () => {
        given(0)

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
        expect(lastWrite()).toEqual({ moments: 1, requestedAt: [] })
    })

    it('banks moments even while suppressed, so the ask is earned by the cooldown edge', async () => {
        const recent = daysAgo(10)
        given(4, [recent])

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
        expect(lastWrite()).toEqual({ moments: 5, requestedAt: [recent] })
    })

    it('stays silent for a user we recently failed', async () => {
        ;(hadRecentFriction as jest.Mock).mockReturnValue(true)

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
    })

    it('holds the 120-day floor between requests, then asks again', async () => {
        given(9, [daysAgo(119)])
        await requestAppReview(USER, 'money_received')
        expect(requestReview).not.toHaveBeenCalled()

        given(9, [daysAgo(121)])
        await requestAppReview(USER, 'money_received')
        expect(requestReview).toHaveBeenCalledTimes(1)
        expect(posthog.capture).toHaveBeenCalledWith(
            'review_requested',
            expect.objectContaining({ days_since_last: 121 })
        )
    })

    it('spends at most two requests a year, keeping one of Apple’s three in reserve', async () => {
        given(9, [daysAgo(300), daysAgo(150)])

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
    })

    it('lets the budget recover once a request ages out of the year', async () => {
        given(9, [daysAgo(400), daysAgo(200)])

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).toHaveBeenCalledTimes(1)
    })

    it('does not spend the request when the native flow fails to start', async () => {
        requestReview.mockRejectedValue(new Error('no play services'))

        await requestAppReview(USER, 'payment_completed')

        expect(lastWrite()).toEqual({ moments: 2, requestedAt: [] })
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it.each([
        [
            'without a native bridge (web, or a capacitor-flavoured preview)',
            () => (isNativeBridge as jest.Mock).mockReturnValue(false),
        ],
        ['in demo mode', () => (isDemoMode as jest.Mock).mockReturnValue(true)],
    ])('never asks %s', async (_label, arrange) => {
        arrange()

        await requestAppReview(USER, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
        expect(updateUserPreferences).not.toHaveBeenCalled()
    })

    it('ignores a logged-out caller', async () => {
        await requestAppReview(undefined, 'payment_completed')

        expect(requestReview).not.toHaveBeenCalled()
    })
})
