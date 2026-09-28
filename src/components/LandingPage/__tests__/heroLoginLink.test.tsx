/**
 * The hero "Log in" link is the only login entry on the desktop landing page.
 * It must stay until the app cutover, when the sunset block replaces /setup.
 * aa115043e hid it whenever the pwa-sunset flag was on, which left logged-out
 * desktop visitors with no way to log in during the notice window.
 */
import { render, screen } from '@testing-library/react'
import { Hero } from '../hero'
import { landingStrings } from '../landingStrings'
import { EN_LANDING_CONTENT_HREFS } from '../landingContentHrefs'
import { getTranslations } from '@/i18n'
import { MIGRATION_CUTOVER_DATE } from '@/constants/migration.consts'

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} />,
}))

let mockMigrationOn = false
jest.mock('@/hooks/useMigrationFlag', () => ({
    useMigrationFlag: () => mockMigrationOn,
}))

let mockKeepWebBypass = false
jest.mock('@/hooks/useKeepWebBypass', () => ({
    useKeepWebBypass: () => mockKeepWebBypass,
}))

const strings = landingStrings(getTranslations('en'))
const DAY = 24 * 60 * 60 * 1000
const BEFORE_CUTOVER = MIGRATION_CUTOVER_DATE.getTime() - DAY
const AFTER_CUTOVER = MIGRATION_CUTOVER_DATE.getTime() + DAY

function renderHero(now: number) {
    jest.spyOn(Date, 'now').mockReturnValue(now)
    render(
        <Hero
            strings={strings}
            contentHrefs={EN_LANDING_CONTENT_HREFS}
            buttonVisible
            customCta={<span>store pair</span>}
        />
    )
}

const loginLink = () => screen.queryByRole('link', { name: strings.logIn })

describe('Hero login link', () => {
    afterEach(() => {
        jest.restoreAllMocks()
        mockMigrationOn = false
        mockKeepWebBypass = false
    })

    it('shows with the sunset flag off', () => {
        renderHero(AFTER_CUTOVER)
        expect(loginLink()).toHaveAttribute('href', '/setup?step=login')
    })

    it('shows with the sunset flag on before the cutover', () => {
        mockMigrationOn = true
        renderHero(BEFORE_CUTOVER)
        expect(loginLink()).toHaveAttribute('href', '/setup?step=login')
    })

    it('hides with the sunset flag on after the cutover', () => {
        mockMigrationOn = true
        renderHero(AFTER_CUTOVER)
        expect(loginLink()).not.toBeInTheDocument()
    })

    it('shows after the cutover for a keep-web bypass browser', () => {
        mockMigrationOn = true
        mockKeepWebBypass = true
        renderHero(AFTER_CUTOVER)
        expect(loginLink()).toHaveAttribute('href', '/setup?step=login')
    })
})
