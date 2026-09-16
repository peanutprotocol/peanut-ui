import { fireEvent, render, screen } from '@testing-library/react'
import { persistLocale } from '@/i18n/app/locale-store'
import { ArticleLocaleNav } from '../ArticleLocaleNav'

jest.mock('next/navigation', () => ({ usePathname: () => '/en/help' }))
jest.mock('@/i18n/app/locale-store', () => ({ persistLocale: jest.fn() }))

const mockedPersist = persistLocale as jest.MockedFunction<typeof persistLocale>

describe('ArticleLocaleNav', () => {
    beforeEach(() => mockedPersist.mockClear())

    it('persists the picked locale so the app cookie stops being stale', () => {
        render(<ArticleLocaleNav currentLocale="en" />)

        fireEvent.click(screen.getByRole('button', { name: /^Language:/ }))
        fireEvent.click(screen.getByRole('link', { name: 'Português (Brasil)' }))

        // marketing 'pt-br' maps through toAppLocale to the app tag 'pt-BR'
        expect(mockedPersist).toHaveBeenCalledWith('pt-BR')
    })
})
