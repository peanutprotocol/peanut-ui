/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { creatorPageFixture } from '../creator-page-fixture'
import { CreatorPagePreviewContext } from '../CreatorPageContext'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPageShell } from '../CreatorPageShell'
import { USER_AGENTS } from './user-agents'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: jest.fn() }))
jest.mock('@/utils/signup-attribution', () => ({
    signupAttributionPosthogProperties: () => ({ signup_journey_id: '11111111-1111-4111-8111-111111111111' }),
}))

const capture = posthog.capture as jest.Mock
const page = creatorPageFixture('juanacervio', 'a1')
const labels = { ios: 'Abrir en App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

function renderCta(userAgent: string, props: Partial<Parameters<typeof CreatorPageCta>[0]> = {}) {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
    return render(
        <CreatorPageShell page={page} lang="es-AR">
            <CreatorPageCta labels={labels} className="cta" {...props} />
        </CreatorPageShell>
    )
}

beforeEach(() => {
    capture.mockClear()
    ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(true)
    // jsdom logs "not implemented: navigation" for a followed link; the test only needs the click.
    document.addEventListener('click', (event) => event.preventDefault(), { once: true })
})

describe('CreatorPageCta', () => {
    it('is a same-tab link to the engine href, unchanged', () => {
        renderCta(USER_AGENTS.instagramIos)
        const link = screen.getByRole('link', { name: 'Abrir en App Store' })
        expect(link.getAttribute('href')).toBe(page.ctaHref)
        expect(link).not.toHaveAttribute('target')
        expect(link).toHaveClass('cta')
    })

    it.each([
        [USER_AGENTS.instagramAndroid, 'Abrir en Google Play'],
        [USER_AGENTS.chromeMac, 'Bajar Peanut'],
    ])('labels the button for the device', (userAgent, label) => {
        renderCta(userAgent)
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    })

    it('shows a store icon only when asked and only on a phone', () => {
        expect(renderCta(USER_AGENTS.instagramIos).container.querySelector('svg')).toBeNull()
        expect(
            renderCta(USER_AGENTS.instagramIos, { showStoreIcon: true }).container.querySelector('svg')
        ).not.toBeNull()
        expect(renderCta(USER_AGENTS.chromeMac, { showStoreIcon: true }).container.querySelector('svg')).toBeNull()
    })

    it('sends the click event with its position and does not block the navigation', () => {
        renderCta(USER_AGENTS.instagramAndroid, { position: 'sticky' })
        const notPrevented = fireEvent.click(screen.getByRole('link'))
        expect(capture.mock.calls).toEqual([
            [
                'creator_page_cta_clicked',
                expect.objectContaining({
                    creator_username: 'juanacervio',
                    link_id: page.creator.linkId,
                    placement: 'ig',
                    page_variant: 'a1',
                    page_experiment: 'nita-2026-11-a',
                    device_os: 'android',
                    in_app_browser: 'instagram',
                    cta_position: 'sticky',
                    signup_journey_id: '11111111-1111-4111-8111-111111111111',
                }),
            ],
        ])
        // Only the test's own document listener prevents the default; the component's handler must not.
        expect(notPrevented).toBe(false)
        expect(screen.getByRole('link').getAttribute('href')).toBe(page.ctaHref)
    })

    it('sends no click event when analytics are not allowed', () => {
        ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        renderCta(USER_AGENTS.instagramIos)
        fireEvent.click(screen.getByRole('link'))
        expect(capture).not.toHaveBeenCalled()
    })

    it('sends no click event in the dev preview', () => {
        Object.defineProperty(navigator, 'userAgent', { configurable: true, value: USER_AGENTS.instagramIos })
        render(
            <CreatorPagePreviewContext.Provider value={true}>
                <CreatorPageShell page={page} lang="es-AR">
                    <CreatorPageCta labels={labels} />
                </CreatorPageShell>
            </CreatorPagePreviewContext.Provider>
        )
        fireEvent.click(screen.getByRole('link'))
        expect(capture).not.toHaveBeenCalled()
    })
})
