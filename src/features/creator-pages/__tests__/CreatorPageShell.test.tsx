/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { isValidElement } from 'react'
import { CreatorPageCta } from '../CreatorPageCta'
import { CreatorPageShell } from '../CreatorPageShell'
import type { Locale } from '@/i18n/types'
import type { DeviceOs } from '../environment'
import { creatorPageFixture } from '../preview-fixture'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), set_config: jest.fn(), config: {} },
}))
jest.mock('../consent', () => ({ creatorPageAnalyticsAllowed: () => false }))

const labels = { ios: 'Abrir en el App Store', android: 'Abrir en Google Play', other: 'Bajar Peanut' }

function shell(deviceOs: DeviceOs, liftCta = false, locale: Locale = 'es-ar') {
    return CreatorPageShell({
        page: { ...creatorPageFixture('juanacervio', 'g2'), deviceOs, liftCta, locale },
        className: 'shell',
        children: <CreatorPageCta labels={labels} position="hero" />,
    })
}

describe('CreatorPageShell', () => {
    it('returns its element at once: the page reads nothing from the request and waits for nothing', () => {
        expect(isValidElement(shell('ios'))).toBe(true)
    })

    it.each([
        ['es-ar', 'es-AR'],
        ['es-419', 'es-419'],
        ['en', 'en'],
        ['pt-br', 'pt-BR'],
    ] as const)('renders <main> and <html> in the page language %s', (locale, lang) => {
        const { unmount } = render(shell('ios', false, locale))
        const main = screen.getByRole('main')
        expect(main).toHaveAttribute('lang', lang)
        expect(main).toHaveClass('shell')
        // As on the localized landing pages (HtmlLang): corrected after hydration, restored on unmount.
        expect(document.documentElement.lang).toBe(locale)
        unmount()
        expect(document.documentElement.lang).not.toBe(locale)
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
