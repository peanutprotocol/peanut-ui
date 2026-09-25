/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import DocsLink from '../DocsLink'
import { AppHelpProvider } from '../AppHelpDrawer'
import { APP_HELP_SLUGS, type AppHelpDocuments } from '../appHelpTypes'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => false }))

const documents = Object.fromEntries(
    APP_HELP_SLUGS.map((slug) => [
        slug,
        Object.fromEntries(
            (['en', 'es-419', 'es-ar', 'pt-br'] as const).map((locale) => [
                locale,
                { title: `${slug} ${locale}`, content: <p>{`${slug} article ${locale}`}</p> },
            ])
        ),
    ])
) as AppHelpDocuments

function renderLink(locale: string, href: string) {
    render(
        <NextIntlClientProvider locale={locale} messages={en} timeZone="UTC">
            <AppHelpProvider documents={documents}>
                <DocsLink href={href}>Read help</DocsLink>
            </AppHelpProvider>
        </NextIntlClientProvider>
    )
}

describe('app help drawers', () => {
    it.each(APP_HELP_SLUGS)('opens the %s article without navigation', (slug) => {
        const pathname = window.location.pathname
        renderLink('en', `/en/help/${slug}`)
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        expect(screen.getByRole('dialog')).toHaveTextContent(`${slug} article en`)
        expect(window.location.pathname).toBe(pathname)
    })

    it.each([
        ['es-419', 'es-419'],
        ['es-AR', 'es-ar'],
        ['pt-BR', 'pt-br'],
    ])('uses the %s article', (locale, expected) => {
        renderLink(locale, '/en/help/verification')
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        expect(screen.getByRole('dialog')).toHaveTextContent(`verification article ${expected}`)
    })

    it('leaves the full help center link available', () => {
        renderLink('en', '/en/help')
        expect(screen.getByRole('link', { name: 'Read help' })).toHaveAttribute('href', '/en/help')
    })
})
