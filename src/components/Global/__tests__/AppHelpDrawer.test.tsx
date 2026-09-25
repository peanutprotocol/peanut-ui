/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import DocsLink from '../DocsLink'
import { AppHelpProvider } from '../AppHelpDrawer'
import { createAppHelpMdxComponents } from '../AppHelpMdx'
import { APP_HELP_SLUGS, type AppHelpDocuments } from '../appHelpTypes'
import en from '@/i18n/app/messages/en.json'

jest.mock('@/hooks/usePWAStatus', () => ({ usePWAStatus: () => false }))
const mockSetSupportOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetSupportOpen }),
}))

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

function renderLink(locale: 'en' | 'es-419' | 'es-AR' | 'pt-BR', href: string) {
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
    ] as const)('uses the %s article', (locale, expected) => {
        renderLink(locale, '/en/help/verification')
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        expect(screen.getByRole('dialog')).toHaveTextContent(`verification article ${expected}`)
    })

    it('leaves the full help center link available', () => {
        renderLink('en', '/en/help')
        expect(screen.getByRole('link', { name: 'Read help' })).toHaveAttribute('href', '/en/help')
    })

    it('uses a prominent h2 and an accessible icon to close the article', () => {
        renderLink('en', '/en/help/verification')
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        expect(screen.getByRole('heading', { level: 2, name: 'verification en' })).toHaveClass('text-heading-s')
        const close = screen.getByRole('button', { name: 'Close' })
        expect(close).not.toHaveTextContent('Close')
        fireEvent.click(close)
        expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed')
    })

    it('localizes links inside an article to the locale that owns the linked content', () => {
        const ArticleLink = createAppHelpMdxComponents('es-ar').a
        const linkedDocuments = {
            ...documents,
            verification: {
                ...documents.verification,
                'es-ar': {
                    title: 'verification es-ar',
                    content: (
                        <>
                            <ArticleLink href="/help/refunds">Refunds</ArticleLink>
                            <ArticleLink href="/help/passkeys">Passkeys</ArticleLink>
                        </>
                    ),
                },
            },
        }
        render(
            <NextIntlClientProvider locale="es-AR" messages={en} timeZone="UTC">
                <AppHelpProvider documents={linkedDocuments}>
                    <DocsLink href="/en/help/verification">Read help</DocsLink>
                </AppHelpProvider>
            </NextIntlClientProvider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        expect(screen.getByRole('link', { name: 'Refunds' })).toHaveAttribute('href', '/es-419/help/refunds')
        fireEvent.click(screen.getByRole('button', { name: 'Passkeys' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('passkeys article es-ar')
    })

    it('closes the article and opens in-app support from its localized CTA', () => {
        mockSetSupportOpen.mockClear()
        const ArticleCTA = createAppHelpMdxComponents('en').CTA
        const linkedDocuments = {
            ...documents,
            verification: {
                ...documents.verification,
                en: {
                    title: 'verification en',
                    content: <ArticleCTA href="#chat" text="Chat with Support" />,
                },
            },
        }
        render(
            <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
                <AppHelpProvider documents={linkedDocuments}>
                    <DocsLink href="/en/help/verification">Read help</DocsLink>
                </AppHelpProvider>
            </NextIntlClientProvider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Read help' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chat with Support' }))
        expect(mockSetSupportOpen).toHaveBeenCalledWith(true)
        expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed')
    })
})
