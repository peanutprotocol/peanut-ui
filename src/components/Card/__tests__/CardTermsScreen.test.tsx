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
import { render as rtlRender, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { AppLocale } from '@/i18n/app/config'
import { deepMerge } from '@/i18n/app/messages'
import en from '@/i18n/app/messages/en.json'
import es419 from '@/i18n/app/messages/es-419.json'
import ptBR from '@/i18n/app/messages/pt-BR.json'
import CardTermsScreen from '@/components/Card/CardTermsScreen'

// NavHeader reads useAuth; stub it so the presentational screen renders alone.
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
    useOptionalAuth: () => undefined,
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
        expect(hrefs()).toContain('https://www.third-national.com/privacypolicy')
    })
})
