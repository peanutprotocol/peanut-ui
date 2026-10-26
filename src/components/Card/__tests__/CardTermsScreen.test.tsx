/**
 * CardTermsScreen — legal-document links must follow the user's language.
 *
 * The five peanut.me legal pages are locale-routed; hardcoding /en/ sent
 * es-419 / pt-BR cardholders to the English documents from a screen that was
 * otherwise fully translated. The marketing locale set spells the tags
 * differently from the app's (`pt-br` vs `pt-BR`), so the mapping — not just
 * the raw locale — is what this pins down.
 */
import React, { type ReactNode } from 'react'
import { fireEvent, render as rtlRender, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AppLocale } from '@/i18n/app/config'
import { deepMerge } from '@/i18n/app/messages'
import en from '@/i18n/app/messages/en.json'
import { PROVIDERS } from '@/constants/providers.consts'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import CardTermsScreen from '@/components/Card/CardTermsScreen'

// NavHeader reads useAuth; stub it so the presentational screen renders alone.
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

// The shared IntlWrapper is pinned to en — this suite is about locale routing.
const CATALOGS: Record<string, unknown> = {
    en,
    'es-419': deepMerge(en, es419 as never),
    'pt-BR': deepMerge(en, ptBR as never),
}

const renderAt = (locale: AppLocale) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
        <NextIntlClientProvider locale={locale} messages={CATALOGS[locale] as never} timeZone="UTC">
            {children}
        </NextIntlClientProvider>
    )
    return rtlRender(<CardTermsScreen isUsResident onAccept={jest.fn()} />, { wrapper })
}

const hrefs = () => screen.getAllByRole('link').map((link) => link.getAttribute('href'))

describe('CardTermsScreen legal links', () => {
    it('points at the English documents for en', () => {
        renderAt('en')
        expect(hrefs()).toEqual(
            expect.arrayContaining([
                'https://peanut.me/en/card-esign',
                'https://peanut.me/en/card-terms-us',
                'https://peanut.me/en/card-privacy',
            ])
        )
    })

    it('follows the active locale for es-419', () => {
        renderAt('es-419')
        const peanutLinks = hrefs().filter((href) => href?.startsWith('https://peanut.me/'))
        expect(peanutLinks.length).toBeGreaterThan(0)
        expect(peanutLinks.every((href) => href?.startsWith('https://peanut.me/es-419/'))).toBe(true)
    })

    it('maps pt-BR onto the marketing tag pt-br', () => {
        renderAt('pt-BR')
        const peanutLinks = hrefs().filter((href) => href?.startsWith('https://peanut.me/'))
        expect(peanutLinks.length).toBeGreaterThan(0)
        expect(peanutLinks.every((href) => href?.startsWith('https://peanut.me/pt-br/'))).toBe(true)
    })

    it('leaves the issuer policy on the issuer domain', () => {
        renderAt('pt-BR')
        expect(hrefs()).toContain(PROVIDERS['third-national'].privacyUrl)
    })
})

describe('CardTermsScreen card provider', () => {
    it('titles the screen Accept terms and names Rain as the card provider above the terms', () => {
        renderAt('en')
        expect(screen.getByRole('heading', { name: 'Accept terms' })).toBeInTheDocument()
        expect(screen.getByText('Card provider')).toBeInTheDocument()
        const brand = screen.getByText('Rain')
        expect(screen.queryByText('Third National')).not.toBeInTheDocument()
        const firstTerm = screen.getAllByRole('checkbox')[0]
        expect(brand.compareDocumentPosition(firstTerm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('speaks of the issuer relationship as ahead, since the terms are not accepted yet', () => {
        window.matchMedia ??= (query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList
        renderAt('en')
        fireEvent.click(screen.getByRole('button', { name: 'About Rain' }))
        const sheet = screen.getByRole('dialog')
        expect(
            within(sheet).getByText(
                'When you accept the card terms, your relationship is directly with Third National.'
            )
        ).toBeInTheDocument()
        expect(within(sheet).queryByText(/You have a direct relationship/)).not.toBeInTheDocument()
    })
})
