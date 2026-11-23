/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { openExternalUrl } from '@/utils/capacitor'
import { readInviteCode } from '@/utils/invite-stash'
import { creatorPageAnalyticsAllowed } from '../consent'
import { creatorPageFixture } from '../preview-fixture'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPagePreview } from '../CreatorPagePreview'
import { CreatorPageProvider } from '../CreatorPageProvider'
import type { DeviceOs } from '../environment'
import { USER_AGENTS } from './user-agents'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: jest.fn() }))
// The browser edge of the store hand-off: everything up to the store URL is the real code.
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    openExternalUrl: jest.fn(async () => {}),
}))
// The QR modal needs the intl catalog; the test reads the hand-off it is given.
jest.mock('@/components/Migration/ScanToDownloadModal', () => ({
    __esModule: true,
    default: ({ handoff }: { handoff?: { invite?: string } }) => (
        <div data-testid="qr-modal" data-invite={handoff?.invite ?? ''} />
    ),
}))

const capture = posthog.capture as jest.Mock
const openUrl = openExternalUrl as jest.Mock
const writeText = jest.fn(async (_text: string) => {})
const page = creatorPageFixture('juanacervio', 'a1')
const labels = { ios: 'Abrir en el App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

function setUserAgent(userAgent: string) {
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: userAgent })
}

function renderCta(deviceOs: DeviceOs, props: Partial<Parameters<typeof CreatorPageCta>[0]> = {}) {
    return render(
        <CreatorPageProvider page={page} deviceOs={deviceOs}>
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
    act(() => {
        fireEvent.click(screen.getByRole('link'))
    })
    document.removeEventListener('click', afterReact)
    if (preventedByComponent === undefined) throw new Error('the click did not reach document')
    return preventedByComponent
}

/** The deferred payload's query, read back from the Play Store referrer or the iOS clipboard text. */
function payloadParams(carrier: string): URLSearchParams {
    const url = new URL(carrier)
    const referrer = url.searchParams.get('referrer')
    return new URLSearchParams(referrer ?? url.search)
}

beforeEach(() => {
    capture.mockClear()
    openUrl.mockClear()
    writeText.mockClear()
    localStorage.clear()
    ;(creatorPageAnalyticsAllowed as jest.Mock).mockReturnValue(true)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    setUserAgent(USER_AGENTS.instagramAndroid)
})

describe('CreatorPageCta', () => {
    it('is a same-tab link to the creator invite, the target without JavaScript', () => {
        renderCta('ios')
        const link = screen.getByRole('link', { name: 'Abrir en el App Store' })
        expect(link.getAttribute('href')).toBe('/invite?code=juanacervio')
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

    it('opens Google Play in one tap with the creator as inviter in the install referrer', () => {
        renderCta('android')
        expect(clickLink()).toBe(true)
        expect(openUrl).toHaveBeenCalledTimes(1)
        const storeUrl = openUrl.mock.calls[0][0] as string
        expect(storeUrl).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=me\.peanut\.wallet&referrer=/)
        expect(payloadParams(storeUrl).get('invite')).toBe('juanacervio')
        expect(readInviteCode()).toBe('juanacervio')
    })

    it('opens the App Store in one tap and leaves the inviter on the clipboard for the app', async () => {
        setUserAgent(USER_AGENTS.instagramIos)
        renderCta('ios')
        expect(clickLink()).toBe(true)
        expect(openUrl.mock.calls[0][0]).toMatch(/^https:\/\/apps\.apple\.com\//)
        await act(async () => {})
        expect(writeText).toHaveBeenCalledTimes(1)
        expect(payloadParams(writeText.mock.calls[0][0]).get('invite')).toBe('juanacervio')
    })

    it('shows the download QR with the creator as inviter on a desktop, as /invite does', () => {
        setUserAgent(USER_AGENTS.chromeMac)
        renderCta('other')
        expect(clickLink()).toBe(true)
        expect(openUrl).not.toHaveBeenCalled()
        expect(screen.getByTestId('qr-modal')).toHaveAttribute('data-invite', 'juanacervio')
    })

    it('sends the tap as a beacon with exactly the agreed properties', () => {
        renderCta('android', { position: 'sticky' })
        clickLink()
        expect(capture.mock.calls).toContainEqual([
            'creator_page_cta_clicked',
            {
                creator_username: 'juanacervio',
                experiment_id: 'nita-2026-11-a',
                variant: 'a1',
                device_os: 'android',
                in_app_browser: 'instagram',
                cta_position: 'sticky',
            },
            { transport: 'sendBeacon', send_instantly: true },
        ])
    })

    it('sends no creator event when analytics are not allowed, and still hands off', () => {
        ;(creatorPageAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        renderCta('android')
        expect(clickLink()).toBe(true)
        const creatorEvents = capture.mock.calls.filter(([event]) => String(event).startsWith('creator_page_'))
        expect(creatorEvents).toEqual([])
        expect(openUrl).toHaveBeenCalledTimes(1)
    })

    it('follows the plain link in the preview: no event, no stash, no store', () => {
        render(
            <CreatorPagePreview>
                <CreatorPageProvider page={page} deviceOs="ios">
                    <CreatorPageCta labels={labels} position="hero" />
                </CreatorPageProvider>
            </CreatorPagePreview>
        )
        expect(clickLink()).toBe(false)
        expect(capture).not.toHaveBeenCalled()
        expect(openUrl).not.toHaveBeenCalled()
        expect(readInviteCode()).toBe('')
    })
})
