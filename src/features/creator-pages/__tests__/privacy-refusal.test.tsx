/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { openExternalUrl } from '@/utils/capacitor'
import { creatorPageFixture } from '../preview-fixture'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPageProvider } from '../CreatorPageProvider'
import { USER_AGENTS } from './user-agents'

// The real posthog-js, not a mock: the test reads what PostHog itself lets through.
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    openExternalUrl: jest.fn(async () => {}),
}))

const KEY = 'phc_test0000000000000000000000000000000000'
const sent: string[] = []
const openUrl = openExternalUrl as jest.Mock
const labels = { ios: 'App Store', android: 'Google Play', other: 'Bajar Peanut' }
type Refusal = 'none' | 'dnt' | 'gpc'

beforeAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = KEY
    posthog.init(KEY, {
        api_host: 'https://posthog.invalid',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        // Every event that passes PostHog's own checks lands here and goes no further.
        before_send: (event) => {
            if (event) sent.push(event.event)
            return null
        },
    })
})

function setRefusal(refusal: Refusal) {
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: refusal === 'dnt' ? '1' : null })
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: refusal === 'gpc' })
}

/** Renders a creator page, taps its button and returns the events and the store URL. */
function visitAndTap(refusal: Refusal) {
    sent.length = 0
    openUrl.mockClear()
    setRefusal(refusal)
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: USER_AGENTS.instagramAndroid })
    const view = render(
        <CreatorPageProvider page={creatorPageFixture('juanacervio', 'g2')} deviceOs="android">
            <CreatorPageCta labels={labels} position="hero" />
        </CreatorPageProvider>
    )
    act(() => {
        fireEvent.click(screen.getByRole('link'))
    })
    const result = { events: [...sent], storeUrl: openUrl.mock.calls[0]?.[0] as string | undefined }
    view.unmount()
    return result
}

afterEach(() => setRefusal('none'))

describe('a creator page under Do Not Track or Global Privacy Control', () => {
    it('sends the view, the impression and the tap events when nothing refuses', () => {
        const { events, storeUrl } = visitAndTap('none')
        expect(events).toEqual(
            expect.arrayContaining([
                'creator_page_viewed',
                'migration_guest_cta_shown',
                'creator_page_cta_clicked',
                'migration_store_cta_clicked',
            ])
        )
        expect(storeUrl).toMatch(/^https:\/\/play\.google\.com\/.*&referrer=/)
    })

    it.each(['dnt', 'gpc'] as const)(
        'with %s sends no event of any name, and opens the same store URL with the same payload',
        (refusal) => {
            const consented = visitAndTap('none')
            const refused = visitAndTap(refusal)
            expect(refused.events).toEqual([])
            expect(refused.storeUrl).toBe(consented.storeUrl)
            const referrer = new URL(refused.storeUrl!).searchParams.get('referrer')!
            expect(new URLSearchParams(referrer).get('invite')).toBe('juanacervio')
        }
    )

    it('gives PostHog back its own Do Not Track setting when the page unmounts', () => {
        visitAndTap('gpc')
        expect(posthog.config.respect_dnt).toBe(false)
    })
})
