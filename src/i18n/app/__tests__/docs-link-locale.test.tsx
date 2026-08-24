import { render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import DocsLink from '@/components/Global/DocsLink'
import { APP_LOCALES, type AppLocale } from '../config'
import en from '../messages/en.json'

function renderIn(locale: AppLocale, href: string) {
    render(
        <NextIntlClientProvider locale={locale} messages={en} timeZone="UTC">
            <DocsLink href={href}>docs</DocsLink>
        </NextIntlClientProvider>
    )
    return screen.getByRole('link', { name: 'docs' })
}

describe('DocsLink locale targeting', () => {
    afterEach(() => document.body.replaceChildren())

    it.each([
        ['en', '/en/help/passkeys'],
        ['es-419', '/es-419/help/passkeys'],
        ['pt-BR', '/pt-br/help/passkeys'],
    ] as const)('a %s reader gets %s', (locale, expected) => {
        expect(renderIn(locale, '/en/help/passkeys')).toHaveAttribute('href', expected)
    })

    it.each(APP_LOCALES)('leaves an app-owned path alone in %s', (locale) => {
        expect(renderIn(locale, '/support')).toHaveAttribute('href', '/support')
    })
})
