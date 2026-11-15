/**
 * The landing hero: the H1 promise and the CTA layout. The hero has no login
 * link; desktop visitors log in from the scan-to-download modal.
 */
import { render, screen } from '@testing-library/react'
import { Hero } from '../hero'
import { landingStrings } from '../landingStrings'
import { getTranslations } from '@/i18n'

jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <span aria-hidden />,
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

const strings = landingStrings(getTranslations('en'))

function renderHero() {
    render(<Hero strings={strings} buttonVisible customCta={<span>store pair</span>} />)
}

it('has no login link', () => {
    renderHero()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
})

it('leads with the approved income-and-spending promise as a real H1', () => {
    renderHero()
    expect(screen.getByRole('heading', { level: 1, name: 'Get paid globally. Spend locally.' })).toBeInTheDocument()
    expect(screen.getByText('Receive dollars and euros. Pay by card or QR.')).toBeInTheDocument()
    expect(screen.queryByText('No local ID or bank required.')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Global Cash Local Feel')).not.toBeInTheDocument()
})

it.each(['en', 'es-419', 'es-ar', 'pt-br'] as const)('keeps the social proof below the CTA row in %s', (locale) => {
    const localizedStrings = landingStrings(getTranslations(locale))
    render(
        <Hero
            strings={localizedStrings}
            buttonVisible
            primaryCta={{ label: localizedStrings.signUp, href: '/setup', subtext: 'social proof' }}
        />
    )

    const row = screen.getByRole('link', { name: localizedStrings.signUp }).parentElement!
    expect(row).not.toContainElement(screen.getByText('social proof'))
    expect(row.nextElementSibling).toBe(screen.getByText('social proof'))
})
