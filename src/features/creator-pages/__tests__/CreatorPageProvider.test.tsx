/** @jest-environment jsdom */
import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { creatorPageFixture } from '../preview-fixture'
import { CreatorPagePreviewContext } from '../CreatorPageContext'
import { CreatorPageProvider } from '../CreatorPageProvider'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: jest.fn() }))

const page = creatorPageFixture('juanacervio', 'g2')
const STICKY = 'cpv_juanacervio=nita-2026-11-a.g2; Max-Age=2592000; Path=/go; SameSite=Lax; Secure'
// jsdom drops a Secure cookie on its http origin, so the assignment itself is what the test reads.
const cookieWrites: string[] = []

beforeEach(() => {
    ;(posthog.capture as jest.Mock).mockClear()
    cookieWrites.length = 0
    ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(true)
    Object.defineProperty(document, 'cookie', { configurable: true, get: () => '', set: (v) => cookieWrites.push(v) })
})

describe('CreatorPageProvider', () => {
    it('renders its children and writes the sticky cookie', () => {
        // StrictMode replays effects the way a development build does; the same value twice is harmless.
        render(
            <StrictMode>
                <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                    <p>hola</p>
                </CreatorPageProvider>
            </StrictMode>
        )
        expect(screen.getByText('hola')).toBeInTheDocument()
        expect(new Set(cookieWrites)).toEqual(new Set([STICKY]))
    })

    it('sends no event of its own: the engine counts the view', () => {
        render(
            <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                <p>hola</p>
            </CreatorPageProvider>
        )
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('removes the sticky cookie when analytics are not allowed, so consent taken back ends the stickiness', () => {
        ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        render(
            <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                <p>hola</p>
            </CreatorPageProvider>
        )
        expect(screen.getByText('hola')).toBeInTheDocument()
        // Same scope as the write: a browser removes a cookie only under the path it was set with.
        expect(cookieWrites).toEqual(['cpv_juanacervio=; Max-Age=0; Path=/go; SameSite=Lax; Secure'])
    })

    it('leaves the cookie alone during a prerender, which is not a refusal', () => {
        ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        Object.defineProperty(document, 'prerendering', { configurable: true, value: true })
        try {
            render(
                <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                    <p>hola</p>
                </CreatorPageProvider>
            )
            expect(cookieWrites).toEqual([])
        } finally {
            delete (document as { prerendering?: boolean }).prerendering
        }
    })

    it('writes nothing in the dev preview', () => {
        render(
            <CreatorPagePreviewContext.Provider value={true}>
                <CreatorPageProvider page={page} experimentId="nita-2026-11-a" deviceOs="ios">
                    <p>hola</p>
                </CreatorPageProvider>
            </CreatorPagePreviewContext.Provider>
        )
        expect(cookieWrites).toEqual([])
    })

    it('writes nothing for a creator without an experiment', () => {
        render(
            <CreatorPageProvider page={creatorPageFixture('someoneelse', 'a1')} experimentId={null} deviceOs="ios">
                <p>hola</p>
            </CreatorPageProvider>
        )
        expect(cookieWrites).toEqual([])
    })
})
