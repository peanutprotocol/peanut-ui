/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPageShell } from '../CreatorPageShell'
import type { DeviceOs } from '../environment'
import { creatorPageFixture } from '../preview-fixture'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/features/tracked-links/eligibility', () => ({ trackedLinkAnalyticsAllowed: () => false }))

const labels = { ios: 'Abrir en el App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

function shell(deviceOs: DeviceOs, liftCta = false) {
    return CreatorPageShell({
        page: { ...creatorPageFixture('juanacervio', 'g2'), deviceOs, liftCta },
        lang: 'es-AR',
        className: 'shell',
        children: <CreatorPageCta labels={labels} position="hero" />,
    })
}

describe('CreatorPageShell', () => {
    it('returns its element at once: a promise here would hide the page on /go until a script runs', () => {
        // The engine renders the page under <Suspense fallback={null}>.
        expect(isValidElement(shell('ios'))).toBe(true)
    })

    it('renders <main> in the page language', () => {
        render(shell('ios'))
        const main = screen.getByRole('main')
        expect(main).toHaveAttribute('lang', 'es-AR')
        expect(main).toHaveClass('shell')
    })

    it('marks <main> for the pages to lift their bottom buttons, and only when asked', () => {
        const { unmount } = render(shell('ios', true))
        expect(screen.getByRole('main')).toHaveAttribute('data-lift-cta')
        unmount()
        render(shell('ios'))
        expect(screen.getByRole('main')).not.toHaveAttribute('data-lift-cta')
    })

    // jsdom's own navigator.userAgent names no phone, so a matching label can only come from the prop.
    it.each([
        ['ios', 'Abrir en el App Store', true],
        ['android', 'Abrir en Google Play', true],
        ['other', 'Bajar Peanut', false],
    ] as const)('labels the button for %s', (deviceOs, label, hasIcon) => {
        const { container } = render(shell(deviceOs))
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
        expect(container.querySelector('svg') !== null).toBe(hasIcon)
    })
})
