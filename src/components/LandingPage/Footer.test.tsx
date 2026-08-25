import { render, screen } from '@testing-library/react'
import Footer from './Footer'
import { SUPPORTED_LOCALES } from '@/i18n/types'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

describe('Footer status link', () => {
    it.each(SUPPORTED_LOCALES)('links to the localized status page in %s', (locale) => {
        render(<Footer showSiteDirectory={false} locale={locale} />)
        const link = screen.getByRole('link', { name: /^(Status|Estado)$/ })
        expect(link).toHaveAttribute('href', `/${locale}/status`)
    })
})
