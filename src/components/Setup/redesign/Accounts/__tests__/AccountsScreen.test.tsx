/** @jest-environment jsdom */
/**
 * 05 Accounts (`advantage-fees`), contract P3 § 1. Written from the contract before the screen exists.
 */
import { fireEvent, screen, within } from '@testing-library/react'
import posthog from 'posthog-js'
import { signupControls } from '@/test-utils/signup-controls'
import { AccountsScreen } from '../AccountsScreen'
import { copy, copyRx, footer, renderRedesign, textMatch, textRx, visibleText } from './redesignHarness'

const mockHandleNext = jest.fn(async () => {})
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))
jest.mock('framer-motion', () => require('./framerMock').framerMotionForShell())
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: () => ({ addEventListener: jest.fn(), destroy: jest.fn(), goToAndStop: jest.fn() }) },
}))

const capture = posthog.capture as jest.Mock
const render = (locale: 'en' | 'es-AR' = 'en') =>
    renderRedesign(<AccountsScreen />, { screenId: 'advantage-fees', locale, showBackButton: true })

beforeEach(() => {
    jest.clearAllMocks()
    mockIsLoading = false
})

describe('05 Accounts', () => {
    it.each(['en', 'es-AR'] as const)('P3-01 renders the screen id, headline and description (%s)', (locale) => {
        const { container } = render(locale)
        expect(container.querySelector('[data-setup-screen="advantage-fees"]')).not.toBeNull()
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            copyRx('setupRedesign.accounts.title', {}, locale)
        )
        expect(screen.getByText(textMatch(copy('setupRedesign.accounts.desc', {}, locale)))).toBeInTheDocument()
    })

    it.each(['en', 'es-AR'] as const)(
        'P3-02 shows a USD and an EUR bank-details card with fixed fake values and no Example tag (%s)',
        (locale) => {
            const { container } = render(locale)
            const usd = screen
                .getByText(textRx('USD · ACH'))
                .closest('[data-testid="setup-redesign-accounts-card-usd"]')
            const eur = screen
                .getByText(textRx('EUR · SEPA'))
                .closest('[data-testid="setup-redesign-accounts-card-eur"]')
            expect(usd).not.toBeNull()
            expect(eur).not.toBeNull()
            const holder = copy('setupRedesign.accounts.holderName', {}, locale)
            expect(within(usd as HTMLElement).getByText(textRx(holder))).toBeInTheDocument()
            expect(within(eur as HTMLElement).getByText(textRx(holder))).toBeInTheDocument()
            expect(within(usd as HTMLElement).getByText(textRx('•••• 0000'))).toBeInTheDocument()
            expect(within(usd as HTMLElement).getByText(textRx('000000000'))).toBeInTheDocument()
            expect(within(eur as HTMLElement).getByText(textRx('DE00 •••• 0000 00'))).toBeInTheDocument()
            // labels come from the catalog
            expect(
                within(usd as HTMLElement).getByText(copyRx('setupRedesign.accounts.holder', {}, locale))
            ).toBeInTheDocument()
            expect(
                within(usd as HTMLElement).getByText(copyRx('setupRedesign.accounts.account', {}, locale))
            ).toBeInTheDocument()
            expect(
                within(usd as HTMLElement).getByText(copyRx('setupRedesign.accounts.routing', {}, locale))
            ).toBeInTheDocument()
            expect(within(eur as HTMLElement).getByText(textRx('IBAN'))).toBeInTheDocument()
            expect(visibleText(container)).not.toMatch(/example|ejemplo/i)
        }
    )

    it('P3-05 Continue reports one control_used on advantage-fees and moves on once', () => {
        const { container } = render()
        fireEvent.click(
            within(footer(container)!).getByRole('button', { name: copyRx('setupRedesign.common.continue') })
        )
        expect(signupControls(capture)).toEqual(['continue:tap'])
        const [, props] = capture.mock.calls.find(([event]) => event === 'control_used') ?? []
        expect(props).toEqual(
            expect.objectContaining({ flow: 'signup', screen_id: 'advantage-fees', control: 'continue', action: 'tap' })
        )
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('P3-05 while the flow is loading, Continue is disabled and shows its spinner', () => {
        mockIsLoading = true
        const { container } = render()
        const button = within(footer(container)!).getByRole('button')
        expect(button).toBeDisabled()
        expect(within(button).getByRole('status')).toBeInTheDocument()
        fireEvent.click(button)
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('P3-01 keeps no old-view copy (dev "Euros? Dollars? Pesos? Yes.")', () => {
        const { container } = render()
        expect(visibleText(container)).not.toContain('Euros? Dollars? Pesos? Yes.') // dev's old 05 title (setup.steps.advantage-fees.title)
    })
})
