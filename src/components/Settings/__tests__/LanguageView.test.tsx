/** @jest-environment jsdom */
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { AppLocaleContext } from '@/i18n/app/locale-context'
import { LanguageView } from '../LanguageView'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

it('lists flagged languages, ignores the current one and switches once per tap', async () => {
    let finish: () => void = () => {}
    const setLocale = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)))
    renderWithIntl(
        <AppLocaleContext.Provider value={{ locale: 'en', setLocale }}>
            <LanguageView />
        </AppLocaleContext.Provider>
    )

    expect(screen.getByRole('button', { name: 'Português (Brasil)' }).querySelector('img')).toHaveAttribute(
        'src',
        expect.stringContaining('br.svg')
    )
    fireEvent.click(screen.getByRole('button', { name: 'English' }))
    expect(setLocale).not.toHaveBeenCalled()

    // a second tap while the first switch is in flight is dropped
    fireEvent.click(screen.getByRole('button', { name: 'Español' }))
    fireEvent.click(screen.getByRole('button', { name: 'Português (Brasil)' }))
    expect(setLocale).toHaveBeenCalledTimes(1)
    expect(setLocale).toHaveBeenCalledWith('es-419')
    finish()
    await waitFor(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Português (Brasil)' }))
        expect(setLocale).toHaveBeenCalledWith('pt-BR')
    })
})
