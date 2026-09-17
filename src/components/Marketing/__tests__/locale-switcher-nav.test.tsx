import { fireEvent, render, screen } from '@testing-library/react'
import { persistLocale } from '@/i18n/app/locale-store'
import { LocaleSwitcher } from '../LocaleSwitcher'

let pathname = '/en/help'

jest.mock('next/navigation', () => ({ usePathname: () => pathname }))
jest.mock('@/i18n/app/locale-store', () => ({ persistLocale: jest.fn() }))

const mockedPersist = persistLocale as jest.MockedFunction<typeof persistLocale>

const openAndGetOption = (currentLocale: 'en' | 'pt-br' = 'en') => {
    render(<LocaleSwitcher locale={currentLocale} label="Language" />)
    fireEvent.click(screen.getByRole('button', { name: /^Language:/ }))
    return screen.getByRole('link', { name: 'Português (Brasil)' })
}

describe('LocaleSwitcher', () => {
    beforeEach(() => {
        mockedPersist.mockClear()
        pathname = '/en/help'
        window.history.replaceState({}, '', '/en/help')
    })

    it('persists the picked locale so the app cookie stops being stale', () => {
        fireEvent.click(openAndGetOption())

        // marketing 'pt-br' maps through toAppLocale to the app tag 'pt-BR'
        expect(mockedPersist).toHaveBeenCalledWith('pt-BR')
    })

    it('carries the query string across the locale switch', () => {
        pathname = '/en/content'
        window.history.replaceState({}, '', '/en/content?type=blog&q=fees')

        expect(openAndGetOption()).toHaveAttribute('href', '/pt-br/content?type=blog&q=fees')
    })

    it('adds no bare ? when there is no query', () => {
        expect(openAndGetOption()).toHaveAttribute('href', '/pt-br/help')
    })
})
