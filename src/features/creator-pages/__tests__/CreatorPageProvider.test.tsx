/** @jest-environment jsdom */
import { StrictMode } from 'react'
import { act, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { creatorPageAnalyticsAllowed } from '../consent'
import { creatorPageFixture } from '../preview-fixture'
import { CreatorPagePreviewContext } from '../CreatorPageContext'
import { CreatorPageProvider } from '../CreatorPageProvider'
import { USER_AGENTS } from './user-agents'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: jest.fn() }))

const page = creatorPageFixture('juanacervio', 'g2')
const STICKY = 'cpv_juanacervio=nita-2026-11-a.g2; Max-Age=2592000; Path=/c; SameSite=Lax; Secure'
// jsdom drops a Secure cookie on its http origin, so the assignment itself is what the test reads.
const cookieWrites: string[] = []
// The store hand-off sends its own impression; these tests read the creator events only.
const creatorEvents = () =>
    (posthog.capture as jest.Mock).mock.calls.filter(([event]) => String(event).startsWith('creator_page_'))

beforeEach(() => {
    ;(posthog.capture as jest.Mock).mockClear()
    cookieWrites.length = 0
    ;(creatorPageAnalyticsAllowed as jest.Mock).mockReturnValue(true)
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: (v) => cookieWrites.push(v) })
    Object.defineProperty(navigator, 'userAgent', { configurable: true, value: USER_AGENTS.instagramIos })
})

function renderProvider() {
    return render(
        <CreatorPageProvider page={page} deviceOs="ios">
            <p>hola</p>
        </CreatorPageProvider>
    )
}

describe('CreatorPageProvider', () => {
    it('renders its children, writes the sticky cookie and sends one view, also under StrictMode', () => {
        // StrictMode replays effects the way a development build does.
        render(
            <StrictMode>
                <CreatorPageProvider page={page} deviceOs="ios">
                    <p>hola</p>
                </CreatorPageProvider>
            </StrictMode>
        )
        expect(screen.getByText('hola')).toBeInTheDocument()
        expect(new Set(cookieWrites)).toEqual(new Set([STICKY]))
        expect(creatorEvents()).toEqual([
            [
                'creator_page_viewed',
                {
                    creator_username: 'juanacervio',
                    experiment_id: 'nita-2026-11-a',
                    variant: 'g2',
                    device_os: 'ios',
                    in_app_browser: 'instagram',
                },
            ],
        ])
    })

    it('sends no view and removes the sticky cookie when analytics are not allowed', () => {
        ;(creatorPageAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        renderProvider()
        expect(screen.getByText('hola')).toBeInTheDocument()
        expect(creatorEvents()).toEqual([])
        // Same scope as the write: a browser removes a cookie only under the path it was set with.
        expect(cookieWrites).toEqual(['cpv_juanacervio=; Max-Age=0; Path=/c; SameSite=Lax; Secure'])
    })

    it('waits for a prerendered page to be shown, then sends one view and writes the cookie', () => {
        Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        try {
            renderProvider()
            expect(creatorEvents()).toEqual([])
            expect(cookieWrites).toEqual([])

            Object.defineProperty(document, 'prerendering', { configurable: true, value: false })
            act(() => {
                document.dispatchEvent(new Event('prerenderingchange'))
            })
            expect(creatorEvents().map(([event]) => event)).toEqual(['creator_page_viewed'])
            expect(cookieWrites).toEqual([STICKY])

            // The listener ran once: a second activation event sends nothing more.
            act(() => {
                document.dispatchEvent(new Event('prerenderingchange'))
            })
            expect(creatorEvents()).toHaveLength(1)
        } finally {
            delete (document as { prerendering?: boolean }).prerendering
        }
    })

    it('removes the activation listener when the page leaves during a prerender', () => {
        Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        try {
            renderProvider().unmount()
            Object.defineProperty(document, 'prerendering', { configurable: true, value: false })
            act(() => {
                document.dispatchEvent(new Event('prerenderingchange'))
            })
            expect(creatorEvents()).toEqual([])
            expect(cookieWrites).toEqual([])
        } finally {
            delete (document as { prerendering?: boolean }).prerendering
        }
    })

    it('writes nothing and sends nothing in the preview', () => {
        render(
            <CreatorPagePreviewContext.Provider value={true}>
                <CreatorPageProvider page={page} deviceOs="ios">
                    <p>hola</p>
                </CreatorPageProvider>
            </CreatorPagePreviewContext.Provider>
        )
        expect(cookieWrites).toEqual([])
        expect(posthog.capture).not.toHaveBeenCalled()
    })
})
