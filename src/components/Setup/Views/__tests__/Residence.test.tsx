/** @jest-environment jsdom */
/**
 * Residence step — legal-residence question between username and passkey.
 *
 * Contract under test: geo only prefills (never advances, never restricts),
 * the multi-doc link reveals a second selector, restricted residences
 * (CN/IR/RU/BY/GB) get the generic heads-up before handleNext can run,
 * unrestricted residences get the congrats screen before handleNext can run,
 * and the notify exit validates the email before capturing it.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import posthog from 'posthog-js'
import { IntlWrapper } from '@/test-utils/intl'
import ResidenceStep from '@/components/Setup/Views/Residence'
import { setupActions } from '@/redux/slices/setup-slice'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockDispatch = jest.fn()
let mockSetupState: { residenceCountry: string; secondResidenceCountry: string }
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => mockDispatch,
    useSetupStore: () => mockSetupState,
}))

const mockHandleNext = jest.fn()
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: false }),
}))

let mockGeoCountry: string | null = null
jest.mock('@/hooks/useGeoLocation', () => ({
    useGeoLocation: () => ({ countryCode: mockGeoCountry, isLoading: false, error: null }),
}))

jest.mock('posthog-js', () => ({ capture: jest.fn(), setPersonProperties: jest.fn() }))
const mockedCapture = posthog.capture as jest.Mock

// Hermetic: the real hook fires a fetch for the server tier lists on first
// mount; return the bundled mirror so no request leaves the test and no
// async state update lands outside act().
jest.mock('@/hooks/useResidenceRestrictionSets', () => {
    const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
    return {
        ...actual,
        useResidenceRestrictionSets: () => actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
    }
})

describe('ResidenceStep', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockSetupState = { residenceCountry: '', secondResidenceCountry: '' }
        mockGeoCountry = null
    })

    it('disables Continue until a country is chosen', () => {
        render(<ResidenceStep />)
        expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    })

    // The chrome h1 is suppressed for this step (titleInView), so each view
    // must render exactly one top-level heading of its own.
    it('renders the step title as the only heading on the select view', () => {
        render(<ResidenceStep />)
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Where are you a resident?' })).toBeInTheDocument()
    })

    it('prefills from geo as a suggestion without advancing', () => {
        mockGeoCountry = 'br'
        render(<ResidenceStep />)
        expect(mockDispatch).toHaveBeenCalledWith(setupActions.setResidenceCountry('BR'))
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('does not prefill over an existing choice', () => {
        mockGeoCountry = 'br'
        mockSetupState.residenceCountry = 'AR'
        render(<ResidenceStep />)
        expect(mockDispatch).not.toHaveBeenCalled()
    })

    it('reveals the second selector via the multi-doc link', () => {
        render(<ResidenceStep />)
        expect(screen.queryByText('Select your second country')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Have documents from more than one country?'))
        expect(screen.getByText('Select your second country')).toBeInTheDocument()
    })

    it('shows the per-country availability comparison with the truth-first guidance', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        expect(screen.getByText('Available with Brazil')).toBeInTheDocument()
        expect(screen.getByText('Available with Germany')).toBeInTheDocument()
        expect(screen.getByText('PIX & bank transfers')).toBeInTheDocument()
        expect(screen.getByText('SEPA transfers')).toBeInTheDocument()
        expect(screen.getByText('Which country goes first?')).toBeInTheDocument()
        expect(screen.getByText(/genuinely hold legal residence/)).toBeInTheDocument()
    })

    it('shows the congrats screen for an unrestricted residence and continues on demand', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Good news' })).toBeInTheDocument()
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
        // the screen itself never names a country
        expect(screen.queryByText(/Brazil/)).not.toBeInTheDocument()
        // gates stay separated in prose: no-ID features first, then the bank
        // rail (named per country) and the card behind the ID check
        expect(
            screen.getByText(
                /work right away, and a quick ID check unlocks PIX and bank transfers, plus the Peanut card/
            )
        ).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('hedges the bank line for a country with no known rail', () => {
        // NG is in no restriction set, but no named rail serves it either: the
        // congrats screen must not promise bank transfers outright.
        mockSetupState.residenceCountry = 'NG'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByText(/unlocks bank transfers where supported/)).toBeInTheDocument()
    })

    it('returns to the selector from the congrats screen', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByText('Choose a different country'))
        expect(screen.queryByText('Good news')).not.toBeInTheDocument()
        expect(screen.getByText('Have documents from more than one country?')).toBeInTheDocument()
    })

    it.each(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'HK'])(
        'shows the generic heads-up for %s before advancing',
        (iso2) => {
            mockSetupState.residenceCountry = iso2
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            expect(mockHandleNext).not.toHaveBeenCalled()
            expect(screen.getAllByRole('heading')).toHaveLength(1)
            expect(screen.getByRole('heading', { level: 1, name: 'Heads up' })).toBeInTheDocument()
            // the screen itself never names a country
            expect(screen.queryByText(/United Kingdom|China|Iran|Russia|Belarus/)).not.toBeInTheDocument()
            expect(mockedCapture).toHaveBeenCalledWith(
                ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
                expect.objectContaining({ residence_country: iso2 })
            )
        }
    )

    it.each([
        ['IN', 'card'],
        ['TR', 'card'],
        ['UA', 'card'],
        ['VE', 'card'],
        ['VN', 'card'],
        ['IL', 'card'],
        ['IQ', 'card'],
        ['MM', 'card'],
        ['NP', 'card'],
        ['NI', 'card'],
        ['DZ', 'banking'],
        ['BI', 'banking'],
        ['JP', 'banking'],
        ['TN', 'banking'],
    ])('shows the partial heads-up for %s (%s restriction) and continues on demand', (iso2, kind) => {
        mockSetupState.residenceCountry = iso2
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Heads up' })).toBeInTheDocument()
        expect(
            screen.getByText(
                kind === 'card'
                    ? /The Peanut card isn't available in your country/
                    : /Bank transfers aren't available in your country/
            )
        ).toBeInTheDocument()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
            expect.objectContaining({ residence_country: iso2, restriction_type: kind })
        )
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('lists sanctioned countries in the selector so residents can answer truthfully', () => {
        // countryData omits them (it is the add-money destination list); the
        // supplemental options must fill the gap or the heads-up never fires.
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('combobox'))
        // Substring match: the selector now renders Intl.DisplayNames names,
        // which can extend the catalog title (en shows Myanmar (Burma)).
        for (const name of ['Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Myanmar']) {
            expect(screen.getByText(name, { exact: false })).toBeInTheDocument()
        }
    })

    it('lets a restricted resident continue anyway', () => {
        mockSetupState.residenceCountry = 'GB'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByRole('button', { name: 'Continue anyway' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED,
            expect.objectContaining({ residence_country: 'GB' })
        )
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('captures a valid email on the notify exit and rejects an invalid one', () => {
        mockSetupState.residenceCountry = 'RU'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByRole('button', { name: 'Notify me when it is available' }))

        const input = screen.getByPlaceholderText('you@example.com')
        fireEvent.change(input, { target: { value: 'not-an-email' } })
        fireEvent.click(screen.getByRole('button', { name: 'Notify me' }))
        expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
        expect(mockedCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_NOTIFY_SUBMITTED,
            expect.anything()
        )

        fireEvent.change(input, { target: { value: 'nomad@example.com' } })
        fireEvent.click(screen.getByRole('button', { name: 'Notify me' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_NOTIFY_SUBMITTED,
            expect.objectContaining({ residence_country: 'RU' })
        )
        expect(posthog.setPersonProperties).toHaveBeenCalledWith(
            expect.objectContaining({ residence_notify_email: 'nomad@example.com' })
        )
        expect(screen.getByText("Got it. We'll email you when it's available.")).toBeInTheDocument()
    })

    it('returns to the selector from the heads-up', () => {
        mockSetupState.residenceCountry = 'CN'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByText('Choose a different country'))
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
        expect(screen.getByText('Have documents from more than one country?')).toBeInTheDocument()
    })
})
