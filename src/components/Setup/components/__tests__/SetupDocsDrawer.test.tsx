/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupDocLink, SetupDocsProvider, type SetupDocuments } from '../SetupDocsDrawer'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'

const localized = (title: string, text: string) => ({ title, content: <p>{text}</p> })
const documents: SetupDocuments = {
    terms: localized('Terms of Service', 'The complete terms live here.'),
    privacy: localized('Privacy Policy', 'The complete privacy policy lives here.'),
    'account-recovery': {
        en: localized('Account recovery', 'Keep your working session.'),
        'es-419': localized('Recuperar cuenta', 'Conserva tu sesión.'),
        'es-ar': localized('Recuperar cuenta', 'Conservá tu sesión.'),
        'pt-br': localized('Recuperar conta', 'Mantenha sua sessão.'),
    },
    passkeys: {
        en: localized('Passkeys', 'Check your password manager.'),
        'es-419': localized('Passkeys', 'Revisa tu gestor.'),
        'es-ar': localized('Passkeys', 'Revisá tu gestor.'),
        'pt-br': localized('Passkeys', 'Confira seu gerenciador.'),
    },
}

describe('setup document drawers', () => {
    it('opens legal content in place and keeps form input when closed', async () => {
        const pathname = window.location.pathname
        renderWithIntl(
            <SetupDocsProvider documents={documents}>
                <input aria-label="Username" defaultValue="peanutfan" />
                <SetupDocLink kind="terms" href="/terms">
                    T&amp;C
                </SetupDocLink>
                <SetupDocLink kind="privacy" href="/privacy">
                    Privacy Policy
                </SetupDocLink>
            </SetupDocsProvider>
        )

        fireEvent.click(screen.getByRole('button', { name: 'T&C' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('The complete terms live here.')
        expect(window.location.pathname).toBe(pathname)
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        // Vaul leaves the closing portal mounted until its CSS exit animation.
        expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed')
        expect(screen.getByRole('textbox', { name: 'Username', hidden: true })).toHaveValue('peanutfan')

        fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy', hidden: true }))
        expect(screen.getByRole('dialog')).toHaveTextContent('The complete privacy policy lives here.')
    })

    it('shows help content in the same drawer', () => {
        renderWithIntl(
            <SetupDocsProvider documents={documents}>
                <SetupDocLink kind="account-recovery" href="/en/help/account-recovery">
                    Peanut backup
                </SetupDocLink>
            </SetupDocsProvider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Peanut backup' }))
        expect(screen.getByRole('dialog')).toHaveTextContent('Keep your working session.')
    })

    it.each([
        ['es-419', 'Conserva tu sesión.'],
        ['es-AR', 'Conservá tu sesión.'],
        ['pt-BR', 'Mantenha sua sessão.'],
    ] as const)('uses the %s help article', (locale, expected) => {
        render(
            <NextIntlClientProvider locale={locale} messages={en} timeZone="UTC">
                <SetupDocsProvider documents={documents}>
                    <SetupDocLink kind="account-recovery" href="/en/help/account-recovery">
                        Peanut backup
                    </SetupDocLink>
                </SetupDocsProvider>
            </NextIntlClientProvider>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Peanut backup' }))
        expect(screen.getByRole('dialog')).toHaveTextContent(expected)
    })
})
