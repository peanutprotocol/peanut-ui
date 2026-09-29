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
// they were, and two new unchecked boxes follow. Every box is required.
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

    it('keeps the four international rows, then adds the two new boxes — all unchecked', () => {
        renderTerms(false)
        expect(boxes()).toHaveLength(6)
        expect(boxes().every((box) => !box.checked)).toBe(true)
    })

    it('keeps the five US rows, then adds the two new boxes — all unchecked', () => {
        renderTerms(true)
        expect(boxes()).toHaveLength(7)
        expect(boxes().every((box) => !box.checked)).toBe(true)
    })

    it('shows the exact authorization statement with the terms as a link, and no provider name', () => {
        renderTerms(false)
        const statement = screen.getByTestId('funding-authorization-statement')
        expect(statement).toHaveTextContent(AUTHORIZATION)
        expect(within(statement).getByRole('button', { name: 'Real-Time Funding Terms' })).toBeInTheDocument()
        expect(screen.getByText(/our third party provider/)).toBeInTheDocument()
        expect(document.body.textContent).not.toMatch(/\bRain\b/)
        expect(document.body.textContent).not.toMatch(/existing/i)
    })

    it('states the permission plainly: managed, renewed, ongoing, finite at any moment', () => {
        renderTerms(false)
        expect(
            screen.getByText(/Peanut manages how much our third party provider can take from your wallet/)
        ).toBeInTheDocument()
        expect(screen.getByText(/renews automatically, including for money you add later/)).toBeInTheDocument()
        expect(
            screen.getByText(/The permission stays in place. The amount it allows at any one time is limited./)
        ).toBeInTheDocument()
        // no promise about a total cap, exclusive access or never signing again
        expect(document.body.textContent).not.toMatch(/never sign|no one|only \$|total spend|cap on/i)
    })

    it('keeps Continue off until every box, old and new, is ticked', () => {
        renderTerms(false)
        expect(continueButton()).toBeDisabled()
        // the four original rows alone are not enough
        boxes()
            .slice(0, 4)
            .forEach((box) => fireEvent.click(box))
        expect(continueButton()).toBeDisabled()
        fireEvent.click(boxes()[4])
        expect(continueButton()).toBeDisabled()
        fireEvent.click(boxes()[5])
        expect(continueButton()).toBeEnabled()
    })

    it.each([4, 5])('stays off when only new box %i is left unticked', (skipped) => {
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
                managementAccepted: true,
                authorizationAccepted: true,
                authorizationText: AUTHORIZATION,
            })
        )
    })

    it('opens a draft-for-review panel from the terms link without inventing legal text', () => {
        renderTerms(false)
        fireEvent.click(screen.getByRole('button', { name: 'Real-Time Funding Terms' }))
        expect(screen.getByText(/Draft for review/)).toBeInTheDocument()
        expect(screen.getByText(/not final legal text/)).toBeInTheDocument()
    })
})
