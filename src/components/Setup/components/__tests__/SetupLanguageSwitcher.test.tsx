/** @jest-environment jsdom */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { SetupLanguageSwitcher } from '../SetupLanguageSwitcher'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
})
beforeEach(() => (posthog.capture as jest.Mock).mockClear())

it('shows a short language name and applies the selected locale', async () => {
    const setLocale = jest.fn(async () => {})
    renderWithIntl(
        <AppLocaleContext.Provider value={{ locale: 'en', setLocale }}>
            <SetupLanguageSwitcher />
        </AppLocaleContext.Provider>
    )

    const selector = screen.getByRole('button', { name: 'Language' })
    expect(selector).toHaveTextContent('EN')
    fireEvent.click(selector)
    expect(
        (await screen.findAllByRole('button', { name: /English|Español|Português/ })).map(
            (option) => option.textContent
        )
    ).toEqual(['English', 'Español', 'Español (Argentina)', 'Português (Brasil)'])
    // same flagged rows as the settings language page (one shared list)
    expect(screen.getByRole('button', { name: 'Español (Argentina)' }).querySelector('img')).toHaveAttribute(
        'src',
        expect.stringContaining('ar.svg')
    )
    expect(screen.getByRole('button', { name: 'Português (Brasil)' }).querySelector('[lang="pt-BR"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Español (Argentina)' }))
    expect(setLocale).toHaveBeenCalledWith('es-AR')
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
})

it('reports opening the picker, the language chosen and a dismissal without a choice', async () => {
    const setLocale = jest.fn(async () => {})
    renderWithIntl(
        onSignupScreen(
            'signup',
            <AppLocaleContext.Provider value={{ locale: 'en', setLocale }}>
                <SetupLanguageSwitcher />
            </AppLocaleContext.Provider>
        )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Language' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Português (Brasil)' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
    fireEvent.click(screen.getByRole('button', { name: 'Language', hidden: true }))
    fireEvent.keyDown(await screen.findByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.getByRole('dialog', { hidden: true })).toHaveAttribute('data-state', 'closed'))
    expect(signupControls(posthog.capture as jest.Mock)).toEqual([
        'language:open',
        'language:select:pt-BR',
        'language:open',
        'language:dismiss',
    ])
})
