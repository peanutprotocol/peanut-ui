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
import { fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react'
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
}))
// A sandbox-style origin: the terms link must follow the configured site origin.
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    BASE_URL: 'https://peanut.mucu.dev',
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

// The managed card funding consent: the original card boxes stay exactly as
// they were, and one unchecked funding authorization follows. Every box is required.
describe('CardTermsScreen managed funding consent', () => {
    const AUTHORIZATION = 'I authorize transfers according to the Real-Time Funding Terms.'
    const renderTerms = (isUsResident: boolean, onAccept = jest.fn()) => {
        rtlRender(<CardTermsScreen isUsResident={isUsResident} onAccept={onAccept} />, {
            wrapper: ({ children }: { children: ReactNode }) => (
                <NextIntlClientProvider locale="en" messages={CATALOGS.en as never} timeZone="UTC">
                    {children}
                </NextIntlClientProvider>
            ),
        })
        return onAccept
    }
    const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[]
    const continueButton = () => screen.getByRole('button', { name: 'Continue' })

    it('keeps the four international rows, then adds only the authorization box — all unchecked', () => {
        renderTerms(false)
        expect(boxes()).toHaveLength(5)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(boxes()[4].closest('[role="listitem"]')).toBe(
            screen.getByTestId('funding-authorization-statement').parentElement
        )
    })

    it('keeps the five US rows, then adds only the authorization box — all unchecked', () => {
        renderTerms(true)
        expect(boxes()).toHaveLength(6)
        expect(boxes().every((box) => !box.checked)).toBe(true)
    })

    it('has no explanation paragraphs and no management box', () => {
        renderTerms(false)
        expect(screen.queryByTestId('funding-management-consent')).not.toBeInTheDocument()
        expect(screen.queryByText(/Peanut manages/)).not.toBeInTheDocument()
        expect(screen.queryByText(/renews automatically/)).not.toBeInTheDocument()
        expect(screen.queryByText(/The permission stays in place/)).not.toBeInTheDocument()
    })

    it('shows the exact authorization statement with the terms as a link, and no provider name', () => {
        renderTerms(false)
        const statement = screen.getByTestId('funding-authorization-statement')
        expect(statement).toHaveTextContent(AUTHORIZATION)
        expect(within(statement).getByRole('link', { name: 'Real-Time Funding Terms' })).toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(/\bRain\b/)
        expect(document.body.textContent).not.toMatch(/existing/i)
    })

    it('keeps Continue off until every original box and the authorization are ticked', () => {
        renderTerms(false)
        expect(continueButton()).toBeDisabled()
        // the four original rows alone are not enough
        boxes()
            .slice(0, 4)
            .forEach((box) => fireEvent.click(box))
        expect(continueButton()).toBeDisabled()
        fireEvent.click(boxes()[4])
        expect(continueButton()).toBeEnabled()
    })

    it.each([0, 1, 2, 3, 4])('stays off when only box %i is left unticked', (skipped) => {
        renderTerms(false)
        boxes().forEach((box, index) => index !== skipped && fireEvent.click(box))
        expect(continueButton()).toBeDisabled()
    })

    it('hands the ticked consent and the exact statement to the flow', async () => {
        const onAccept = renderTerms(false)
        boxes().forEach((box) => fireEvent.click(box))
        fireEvent.click(continueButton())
        await waitFor(() =>
            expect(onAccept).toHaveBeenCalledWith({
                authorizationAccepted: true,
                authorizationText: AUTHORIZATION,
            })
        )
    })

    it('links the terms to the public page in a new tab without ticking either box, and shows no draft placeholder', () => {
        renderTerms(false)
        const link = screen.getByRole('link', { name: 'Real-Time Funding Terms' })
        expect(link).toHaveAttribute('href', 'https://peanut.mucu.dev/en/real-time-funding-terms')
        expect(link).toHaveAttribute('target', '_blank')
        fireEvent.click(link)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(continueButton()).toBeDisabled()
        expect(document.body.textContent).not.toMatch(/draft|rtf-sandbox/i)
    })

    it.each([
        ['es-419', 'es-419'],
        ['pt-BR', 'pt-br'],
    ] as const)('the terms link follows the %s locale', (locale, marketing) => {
        renderAt(locale)
        expect(hrefs()).toContain(`https://peanut.mucu.dev/${marketing}/real-time-funding-terms`)
    })
})
