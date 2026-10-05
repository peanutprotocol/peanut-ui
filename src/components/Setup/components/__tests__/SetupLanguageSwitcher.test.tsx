/** @jest-environment jsdom */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { SetupLanguageSwitcher } from '../SetupLanguageSwitcher'

beforeAll(() => {
    Element.prototype.scrollIntoView = jest.fn()
})

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
    fireEvent.click(screen.getByRole('button', { name: 'Español (Argentina)' }))
    expect(setLocale).toHaveBeenCalledWith('es-AR')
    await waitFor(() => expect(screen.getByRole('dialog')).toHaveAttribute('data-state', 'closed'))
})
