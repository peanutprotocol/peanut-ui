/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { SetupLanguageSwitcher } from '../SetupLanguageSwitcher'

it('offers every app language and applies the selected locale', () => {
    const setLocale = jest.fn(async () => {})
    renderWithIntl(
        <AppLocaleContext.Provider value={{ locale: 'en', setLocale }}>
            <SetupLanguageSwitcher />
        </AppLocaleContext.Provider>
    )

    const selector = screen.getByRole('combobox', { name: 'Language' })
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual([
        'en',
        'es-419',
        'es-AR',
        'pt-BR',
    ])
    fireEvent.change(selector, { target: { value: 'es-AR' } })
    expect(setLocale).toHaveBeenCalledWith('es-AR')
})
