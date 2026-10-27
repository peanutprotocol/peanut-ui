/**
 * The hero "Log in" link shows only while the pwa-sunset flag is off. With
 * the flag on, desktop visitors log in from the scan-to-download modal.
 */
import { render, screen, within } from '@testing-library/react'
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

let mockMigrationOn = false
jest.mock('@/hooks/useMigrationFlag', () => ({
    useMigrationFlag: () => mockMigrationOn,
}))

const strings = landingStrings(getTranslations('en'))

function renderHero() {
    render(<Hero strings={strings} buttonVisible customCta={<span>store pair</span>} />)
}

describe('Hero login link', () => {
    afterEach(() => {
        mockMigrationOn = false
    })

    it('shows with the sunset flag off', () => {
        renderHero()
        expect(screen.getByRole('link', { name: strings.logIn })).toHaveAttribute('href', '/setup?step=login')
    })

    it('hides with the sunset flag on', () => {
        mockMigrationOn = true
        renderHero()
        expect(screen.queryByRole('link', { name: strings.logIn })).not.toBeInTheDocument()
    })
})

it('leads with the approved income-and-spending promise as a real H1', () => {
    renderHero()
    expect(screen.getByRole('heading', { level: 1, name: 'Get paid globally. Spend locally.' })).toBeInTheDocument()
    expect(screen.getByText('Receive dollars and euros. Pay by card or QR.')).toBeInTheDocument()
    expect(screen.queryByText('No local ID or bank required.')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Global Cash Local Feel')).not.toBeInTheDocument()
})

it.each(['en', 'es-419', 'es-ar', 'pt-br'] as const)(
    'keeps signup and login together above the social proof in %s',
    (locale) => {
        const localizedStrings = landingStrings(getTranslations(locale))
        render(
            <Hero
                strings={localizedStrings}
                buttonVisible
                primaryCta={{ label: localizedStrings.signUp, href: '/setup', subtext: 'social proof' }}
            />
        )

        const signup = screen.getByRole('link', { name: localizedStrings.signUp })
        const login = screen.getByRole('link', { name: localizedStrings.logIn })
        const row = signup.parentElement!
        expect(within(row).getByRole('link', { name: localizedStrings.logIn })).toBe(login)
        expect(row).not.toContainElement(screen.getByText('social proof'))
        expect(row.nextElementSibling).toBe(screen.getByText('social proof'))
    }
)
