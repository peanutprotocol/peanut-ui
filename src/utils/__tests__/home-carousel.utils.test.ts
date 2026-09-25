/** @jest-environment jsdom */
/**
 * Konrad's QR banner rule (TASK-23054): a carousel card closed with × never
 * comes back, except the allow-list, and "Pay with QR" never shows to a user
 * who already paid a QR or whose residence has no QR rail.
 */
import {
    HOME_CHECKLIST_CTA_ID,
    RECURRING_CAROUSEL_CTAS,
    hiddenCarouselCTAs,
    hideHomeCta,
    readHiddenHomeCtas,
    showQrPayCTA,
} from '@/utils/home-carousel.utils'

const NOW = new Date('2026-09-25T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

describe('hiddenCarouselCTAs', () => {
    it('a closed card stays hidden for good, a year later too', () => {
        const hidden = hiddenCarouselCTAs({ 'qr-payment': daysAgo(365), 'invite-friends': daysAgo(8) }, NOW)
        expect([...hidden.keys()].sort()).toEqual(['invite-friends', 'qr-payment'])
    })

    it('the app-install card returns after its cooldown, and each allow-listed card says why', () => {
        expect(hiddenCarouselCTAs({ 'app-install': daysAgo(3) }, NOW).has('app-install')).toBe(true)
        expect(hiddenCarouselCTAs({ 'app-install': daysAgo(8) }, NOW).has('app-install')).toBe(false)
        for (const entry of Object.values(RECURRING_CAROUSEL_CTAS)) expect(entry.reason.length).toBeGreaterThan(0)
    })

    it('the legacy string[] shape reads as closed now', () => {
        const hidden = hiddenCarouselCTAs(['qr-payment', 'app-install'], NOW)
        expect(hidden.has('qr-payment')).toBe(true)
        expect(hidden.has('app-install')).toBe(true)
    })

    it('an unreadable date still hides a card the user closed', () => {
        expect(hiddenCarouselCTAs({ 'bug-bounty': 'not a date' }, NOW).has('bug-bounty')).toBe(true)
    })

    it('nothing stored, nothing hidden', () => {
        expect(hiddenCarouselCTAs(undefined, NOW).size).toBe(0)
    })
})

describe('showQrPayCTA', () => {
    it('shows to a user who can pay a QR now and has not paid one', () => {
        expect(showQrPayCTA({ canPayQrNow: true, hasMadeQrPayment: false })).toBe(true)
    })

    it('never after a QR pay', () => {
        expect(showQrPayCTA({ canPayQrNow: true, hasMadeQrPayment: true })).toBe(false)
    })

    it('never while the QR gate says the user cannot pay yet', () => {
        expect(showQrPayCTA({ canPayQrNow: false, hasMadeQrPayment: false })).toBe(false)
    })

    it('not while history is loading, so it does not flash in and out', () => {
        expect(showQrPayCTA({ canPayQrNow: true, hasMadeQrPayment: undefined })).toBe(false)
    })
})

describe('one store for every Home CTA a user closes', () => {
    beforeEach(() => localStorage.clear())

    it('hiding the checklist keeps the carousel cards already closed, and the reverse', () => {
        hideHomeCta('u1', 'qr-payment')
        hideHomeCta('u1', HOME_CHECKLIST_CTA_ID)
        hideHomeCta('u1', 'invite-friends')
        expect([...readHiddenHomeCtas('u1').keys()].sort()).toEqual([
            HOME_CHECKLIST_CTA_ID,
            'invite-friends',
            'qr-payment',
        ])
    })

    it('is per user', () => {
        hideHomeCta('u1', HOME_CHECKLIST_CTA_ID)
        expect(readHiddenHomeCtas('u2').has(HOME_CHECKLIST_CTA_ID)).toBe(false)
    })
})
