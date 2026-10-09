/**
 * The hero "Log in" link shows only while the pwa-sunset flag is off. With
 * the flag on, desktop visitors log in from the scan-to-download modal.
 */
import { render, screen } from '@testing-library/react'
import { Hero } from '../hero'
import { landingStrings } from '../landingStrings'
import { EN_LANDING_CONTENT_HREFS } from '../landingContentHrefs'
import { getTranslations } from '@/i18n'

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
    render(
        <Hero
            strings={strings}
            contentHrefs={EN_LANDING_CONTENT_HREFS}
            buttonVisible
            customCta={<span>store pair</span>}
        />
    )
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
