/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { SetupDocLink, SetupDocsProvider, type SetupDocuments } from '../SetupDocsDrawer'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

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

beforeEach(() => jest.clearAllMocks())

describe('setup document drawers', () => {
    it('reports the document link when rendered without its route provider', () => {
        renderWithIntl(
            onSignupScreen(
                'passkey',
                <SetupDocLink kind="passkeys" href="/en/help/passkeys">
                    Guide
                </SetupDocLink>
            )
        )
        const link = screen.getByRole('link', { name: 'Guide' })
        link.addEventListener('click', (event) => event.preventDefault())
        fireEvent.click(link)
        expect(signupControls(posthog.capture as jest.Mock)).toEqual(['passkeys_doc:open'])
    })
    it.each(['terms', 'privacy', 'account-recovery', 'passkeys'] as const)(
        'reports %s open, article links and close from the initiating screen',
        (kind) => {
            const article = {
                title: 'Article',
                content: (
                    <a href="https://peanut.me/support" onClick={(event) => event.preventDefault()}>
                        Contact support
                    </a>
                ),
            }
            const withLinks: SetupDocuments = {
                ...documents,
                [kind]:
                    kind === 'terms' || kind === 'privacy'
                        ? article
                        : { en: article, 'es-419': article, 'es-ar': article, 'pt-br': article },
            }
            renderWithIntl(
                <SetupDocsProvider documents={withLinks}>
                    {onSignupScreen(
                        'passkey',
                        <SetupDocLink kind={kind} href="/guide">
                            Guide
                        </SetupDocLink>
                    )}
                </SetupDocsProvider>
            )
            fireEvent.click(screen.getByRole('button', { name: 'Guide' }))
            fireEvent.click(screen.getByRole('link', { name: 'Contact support' }))
            fireEvent.click(screen.getByRole('button', { name: 'Close' }))
            expect(signupControls(posthog.capture as jest.Mock)).toEqual([
                `${kind}_doc:open`,
                `${kind}_doc_link:tap`,
                `${kind}_doc:dismiss`,
            ])
            for (const [, props] of (posthog.capture as jest.Mock).mock.calls) expect(props.screen_id).toBe('passkey')
            expect(JSON.stringify((posthog.capture as jest.Mock).mock.calls)).not.toContain('https://')
        }
    )

    it('reports which document opened on which screen, and its dismissal', () => {
        renderWithIntl(
            onSignupScreen(
                'signup',
                <SetupDocsProvider documents={documents}>
                    <SetupDocLink kind="terms" href="/terms">
                        T&amp;C
                    </SetupDocLink>
                </SetupDocsProvider>
            )
        )
        fireEvent.click(screen.getByRole('button', { name: 'T&C' }))
        fireEvent.click(screen.getByRole('button', { name: 'Close' }))
        expect(signupControls(posthog.capture as jest.Mock)).toEqual(['terms_doc:open', 'terms_doc:dismiss'])
        expect((posthog.capture as jest.Mock).mock.calls[0][1]).toEqual(
            expect.objectContaining({ screen_id: 'signup' })
        )
    })

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
