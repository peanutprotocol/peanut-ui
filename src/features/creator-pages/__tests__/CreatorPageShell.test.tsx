/** @jest-environment jsdom */
import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { trackedLinkAnalyticsAllowed } from '@/features/tracked-links/eligibility'
import { creatorPageFixture } from '../creator-page-fixture'
import { CreatorPagePreviewContext } from '../CreatorPageContext'
import { CreatorPageShell } from '../CreatorPageShell'

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

describe('CreatorPageShell', () => {
    it('renders <main> in the page language and writes the sticky cookie', () => {
        // StrictMode replays effects the way a development build does; the same value twice is harmless.
        render(
            <StrictMode>
                <CreatorPageShell page={page} lang="es-AR" className="shell">
                    <p>hola</p>
                </CreatorPageShell>
            </StrictMode>
        )
        const main = screen.getByRole('main')
        expect(main).toHaveAttribute('lang', 'es-AR')
        expect(main).toHaveClass('shell')
        expect(main).toHaveTextContent('hola')
        expect(new Set(cookieWrites)).toEqual(new Set([STICKY]))
    })

    it('sends no event of its own: the engine counts the view', () => {
        render(
            <CreatorPageShell page={page} lang="es-AR">
                <p>hola</p>
            </CreatorPageShell>
        )
        expect(posthog.capture).not.toHaveBeenCalled()
    })

    it('writes nothing when analytics are not allowed', () => {
        ;(trackedLinkAnalyticsAllowed as jest.Mock).mockReturnValue(false)
        render(
            <CreatorPageShell page={page} lang="es-AR">
                <p>hola</p>
            </CreatorPageShell>
        )
        expect(screen.getByRole('main')).toHaveTextContent('hola')
        expect(cookieWrites).toEqual([])
    })

    it('writes nothing in the dev preview', () => {
        render(
            <CreatorPagePreviewContext.Provider value={true}>
                <CreatorPageShell page={page} lang="es-AR">
                    <p>hola</p>
                </CreatorPageShell>
            </CreatorPagePreviewContext.Provider>
        )
        expect(cookieWrites).toEqual([])
    })

    it('writes nothing for a creator without an experiment', () => {
        render(
            <CreatorPageShell page={creatorPageFixture('someoneelse', 'a1')} lang="es-AR">
                <p>hola</p>
            </CreatorPageShell>
        )
        expect(cookieWrites).toEqual([])
    })
})
