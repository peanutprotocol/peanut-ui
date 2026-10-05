/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
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

    const selector = screen.getByRole('combobox', { name: 'Language' })
    expect(selector).toHaveTextContent('EN')
    fireEvent.keyDown(selector, { key: 'ArrowDown' })
    expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toEqual([
        'English',
        'Español',
        'Español (Argentina)',
        'Português (Brasil)',
    ])
    fireEvent.click(screen.getByRole('option', { name: 'Español (Argentina)' }))
    expect(setLocale).toHaveBeenCalledWith('es-AR')
})
