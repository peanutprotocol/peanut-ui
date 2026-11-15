/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { creatorPageFixture } from '../creator-page-fixture'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPageShell } from '../CreatorPageShell'
import { USER_AGENTS } from './user-agents'

let mockUserAgent: string | null = null
jest.mock('next/headers', () => ({
    headers: async () => new Headers(mockUserAgent === null ? {} : { 'user-agent': mockUserAgent }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: () => false }))

const labels = { ios: 'Abrir en App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

/** The shell is an async server component: resolve it as the server does, then mount what it returns. */
async function renderShell(userAgent: string | null) {
    mockUserAgent = userAgent
    return render(
        await CreatorPageShell({
            page: creatorPageFixture('juanacervio', 'g2'),
            lang: 'es-AR',
            className: 'shell',
            children: <CreatorPageCta labels={labels} showStoreIcon position="hero" />,
        })
    )
}

describe('CreatorPageShell', () => {
    it('renders <main> in the page language', async () => {
        await renderShell(USER_AGENTS.instagramIos)
        const main = screen.getByRole('main')
        expect(main).toHaveAttribute('lang', 'es-AR')
        expect(main).toHaveClass('shell')
    })

    // jsdom's own navigator.userAgent names no phone, so a matching label can only come from the request header.
    it.each([
        [USER_AGENTS.instagramIos, 'Abrir en App Store', true],
        [USER_AGENTS.instagramAndroid, 'Abrir en Google Play', true],
        [USER_AGENTS.safariIpad, 'Bajar Peanut', false],
        [null, 'Bajar Peanut', false],
    ])('labels the button from the request user agent', async (userAgent, label, hasIcon) => {
        const { container } = await renderShell(userAgent)
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
        expect(container.querySelector('svg') !== null).toBe(hasIcon)
    })
})
