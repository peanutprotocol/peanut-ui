/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { creatorPageFixture } from '../preview-fixture'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPagePreview } from '../CreatorPagePreview'
import { CreatorPageProvider } from '../CreatorPageProvider'
import type { DeviceOs } from '../environment'
import { USER_AGENTS } from './user-agents'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: jest.fn() }))
// The engine's goVisitPosthogProperties reads the journey from here.
jest.mock('@/utils/signup-attribution', () => ({
    readSignupAttribution: () => ({ journeyId: '11111111-1111-4111-8111-111111111111' }),
}))

const capture = posthog.capture as jest.Mock
const page = creatorPageFixture('juanacervio', 'a1')
const labels = { ios: 'Abrir en el App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

function renderCta(deviceOs: DeviceOs, props: Partial<Parameters<typeof CreatorPageCta>[0]> = {}) {
    return render(
        <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs={deviceOs}>
            <CreatorPageCta labels={labels} className="cta" position="hero" {...props} />
        </CreatorPageProvider>
    )
}

/** Clicks the link and reports whether the component prevented the navigation. */
function clickLink(): boolean {
    let preventedByComponent: boolean | undefined
    // React's handler runs at the root container, before this listener on document. The listener
    // records what the component did, then cancels the navigation itself, which jsdom cannot perform.
    const afterReact = (event: MouseEvent) => {
        preventedByComponent = event.defaultPrevented
        event.preventDefault()
    }
    document.addEventListener('click', afterReact)
    fireEvent.click(screen.getByRole('link'))
    document.removeEventListener('click', afterReact)
    if (preventedByComponent === undefined) throw new Error('the click did not reach document')
    return preventedByComponent
}

beforeEach(() => {
    capture.mockClear()
    ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(true)
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: USER_AGENTS.instagramAndroid })
})

describe('CreatorPageCta', () => {
    it('is a same-tab link to the engine href, unchanged', () => {
        renderCta('ios')
        const link = screen.getByRole('link', { name: 'Abrir en el App Store' })
        expect(link.getAttribute('href')).toBe(page.ctaHref)
        expect(link).not.toHaveAttribute('target')
        expect(link).toHaveClass('cta')
    })

    it.each([
        ['android', 'Abrir en Google Play'],
        ['other', 'Bajar Peanut'],
    ] as const)('labels the button for the device the server found', (deviceOs, label) => {
        renderCta(deviceOs)
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    })

    it('shows a store icon only on a phone, at a size .btn cannot override', () => {
        expect(renderCta('other').container.querySelector('svg')).toBeNull()
        const icon = renderCta('ios').container.querySelector('svg')!
        // `custom-size` is the opt-out of `.btn svg:not(.custom-size)` in globals.css.
        expect(icon).toHaveClass('custom-size')
        expect(icon).toHaveAttribute('width', '24')
        expect(icon).toHaveAttribute('height', '24')
    })

    it('sends the tap as a beacon with exactly the agreed properties and does not block the navigation', () => {
        renderCta('android', { position: 'sticky' })
        expect(clickLink()).toBe(false)
        expect(capture.mock.calls).toEqual([
            [
                'creator_page_cta_clicked',
                {
                    link_id: page.creator.linkId,
                    signup_journey_id: '11111111-1111-4111-8111-111111111111',
                    opened_in: 'web',
                    placement: 'ig',
                    code: null,
                    utm_source: null,
                    utm_medium: null,
                    utm_campaign: null,
                    utm_content: null,
                    referrer_host: 'l.instagram.com',
                    page_variant: 'a1',
                    page_experiment: 'nita-2026-11-a',
                    creator_username: 'juanacervio',
                    device_os: 'android',
                    in_app_browser: 'instagram',
                    cta_position: 'sticky',
                },
                { transport: 'sendBeacon', send_instantly: true },
            ],
        ])
        expect(screen.getByRole('link').getAttribute('href')).toBe(page.ctaHref)
    })

    it('sends no click event when analytics are not allowed', () => {
        ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        renderCta('ios')
        expect(clickLink()).toBe(false)
        expect(capture).not.toHaveBeenCalled()
    })

    it('sends no click event in the dev preview', () => {
        render(
            <CreatorPagePreview>
                <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                    <CreatorPageCta labels={labels} position="hero" />
                </CreatorPageProvider>
            </CreatorPagePreview>
        )
        expect(clickLink()).toBe(false)
        expect(capture).not.toHaveBeenCalled()
    })
})
