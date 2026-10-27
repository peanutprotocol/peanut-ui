/** @jest-environment jsdom */
/**
 * Residence step — legal-residence question after the sell screens.
 *
 * Contract under test: geo only prefills (never advances, never restricts),
 * one sentence asks residence and citizenship, a different citizenship
 * compares the two countries first, and Continue advances to the payment
 * plan step, reporting the residence outcome (restricted, partial or
 * congrats) for the country Peanut is set up for.
 */
import React from 'react'
import { act, render as rtlRender, screen, fireEvent } from '@testing-library/react'
import posthog from 'posthog-js'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import ResidenceStep from '@/components/Setup/Views/Residence'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockSetResidenceCountry = jest.fn()
const mockSetCitizenshipCountry = jest.fn()
let mockSetupState: { residenceCountry: string; citizenshipCountry: string }
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        ...mockSetupState,
        fundingChannel: 'crypto',
        paymentChannel: 'peanut',
        setFundingChannel: jest.fn(),
        setPaymentChannel: jest.fn(),
        setResidenceCountry: mockSetResidenceCountry,
        setCitizenshipCountry: mockSetCitizenshipCountry,
    }),
}))

const mockHandleNext = jest.fn()
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))

let mockGeoCountry: string | null = null
let mockEdgeCountry: string | null = null
let mockEdgeSettled = true
let mockRestrictionSets: unknown
let mockRestrictionSetsSettled = true
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({
        vercelIpCountry: mockEdgeCountry,
        edgeSettled: mockEdgeSettled,
        ipCountry: mockGeoCountry?.toUpperCase() ?? null,
        deviceLanguage: 'en-us',
        browserLanguages: ['en-us'],
        deviceTimezone: 'UTC',
        collectedAt: '2026-10-05T10:00:00Z',
    }),
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
        // Overridable so tests can simulate the server lists replacing the
        // bundled mirror after mount, and an unsettled in-flight lookup.
        useResidenceRestrictionSetsWithStatus: () => ({
            sets: mockRestrictionSets ?? actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
            settled: mockRestrictionSetsSettled,
        }),
        useResidenceRestrictionSets: () => mockRestrictionSets ?? actual.LOCAL_RESIDENCE_RESTRICTION_SETS,
    }
})

describe('ResidenceStep', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        resetBackHandlersForTests()
        mockIsLoading = false
        mockSetupState = { residenceCountry: '', citizenshipCountry: '' }
        mockGeoCountry = null
        mockEdgeCountry = null
        mockEdgeSettled = true
        mockRestrictionSets = undefined
        mockRestrictionSetsSettled = true
    })

    it('disables Continue until a country is chosen', () => {
        const { container } = render(<ResidenceStep />)
        const confirm = container.querySelector('[data-setup-footer] button')
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm!)
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('prefills from geo as a suggestion without advancing', () => {
        mockGeoCountry = 'br'
        render(<ResidenceStep />)
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('BR')
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('does not prefill over an existing choice', () => {
        mockGeoCountry = 'br'
        mockSetupState.residenceCountry = 'AR'
        render(<ResidenceStep />)
        expect(mockSetResidenceCountry).not.toHaveBeenCalled()
    })

    it('prefers Vercel country when it disagrees with the IP lookup', () => {
        mockEdgeCountry = 'AR'
        mockGeoCountry = 'BR'
        render(<ResidenceStep />)
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('AR')
        expect(mockHandleNext).not.toHaveBeenCalled()
    })

    it('waits for the higher-priority edge signal before prefilling from IP', () => {
        mockEdgeSettled = false
        mockGeoCountry = 'BR'
        const { rerender } = render(<ResidenceStep />)
        expect(mockSetResidenceCountry).not.toHaveBeenCalled()
        mockEdgeSettled = true
        rerender(<ResidenceStep />)
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('BR')
    })

    it('retains a manual choice when the edge country resolves late', () => {
        mockEdgeSettled = false
        mockSetupState.residenceCountry = 'DE'
        const { rerender } = render(<ResidenceStep />)
        mockEdgeSettled = true
        mockEdgeCountry = 'AR'
        rerender(<ResidenceStep />)
        expect(mockSetResidenceCountry).not.toHaveBeenCalled()
    })

    it('asks residence and citizenship in one sentence, the citizenship starting as the same country', () => {
        mockSetupState.residenceCountry = 'PT'
        render(<ResidenceStep />)
        expect(screen.getByRole('heading')).toHaveTextContent(
            /I’m a resident of\s*Portugal\s*and have citizenship in\s*the same country/
        )
        expect(screen.getByTestId('setup-citizenship-country')).toHaveAccessibleName(
            'Where do you have citizenship?: the same country, Portugal'
        )
        expect(screen.getByText(en.setup.residenceStep.hint)).toBeInTheDocument()
    })

    it('compares the two countries before going on when the citizenship differs', () => {
        mockSetupState = { residenceCountry: 'PT', citizenshipCountry: 'BR' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { name: en.setup.residenceStep.compare.title })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: 'Portugal' })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 2, name: 'Brazil' })).toBeInTheDocument()
        expect(screen.getByText(en.setup.residenceStep.compare.guideTitle)).toBeInTheDocument()
        // Back returns to the sentence instead of leaving the step.
        act(() => expect(dispatchBackPress()).toBe(true))
        expect(screen.getByTestId('setup-citizenship-country')).toBeInTheDocument()
    })

    it('sets Peanut up for the residence when it is picked on the comparison', () => {
        mockSetupState = { residenceCountry: 'PT', citizenshipCountry: 'BR' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        fireEvent.click(screen.getByRole('button', { name: 'Select Portugal' }))
        expect(mockSetResidenceCountry).not.toHaveBeenCalled()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'PT', citizenship_differs: true, compared: true })
        )
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('advances only once the citizenship country picked on the comparison has landed', () => {
        mockSetupState = { residenceCountry: 'PT', citizenshipCountry: 'JP' }
        const view = render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        fireEvent.click(screen.getByRole('button', { name: 'Select Japan' }))
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('JP')
        expect(mockSetCitizenshipCountry).not.toHaveBeenCalled()
        // the plan reads the residence from the flow, so the step waits for it to land
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
            expect.objectContaining({ residence_country: 'JP', restriction_type: 'banking' })
        )
        mockSetupState = { residenceCountry: 'JP', citizenshipCountry: 'JP' }
        view.rerender(<ResidenceStep />)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('says to verify with the residence card when the citizenship’s passports are refused', () => {
        mockSetupState = { residenceCountry: 'DE', citizenshipCountry: 'RU' }
        render(<ResidenceStep />)
        expect(screen.getByText(/We can’t verify passports or ID cards from Russia/)).toHaveTextContent(
            'Use your residence card from Germany'
        )
        expect(screen.queryByText(en.setup.residenceStep.hint)).not.toBeInTheDocument()
    })

    it('reports the congrats outcome for an unrestricted residence and advances to the plan', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    // TASK-23054 R1: HK was restricted for a Sumsub document rule, which never
    // decides eligibility; it is in no tier now
    it('treats Hong Kong as unrestricted', () => {
        mockSetupState.residenceCountry = 'HK'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.objectContaining({ residence_country: 'HK' })
        )
    })

    // mirrors peanut-api-ts FULL_RESTRICTED_RESIDENCE (api#1738)
    it.each(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'MM', 'VE', 'IQ'])(
        'reports %s as restricted and still advances to the plan',
        (iso2) => {
            mockSetupState.residenceCountry = iso2
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
            expect(mockedCapture).toHaveBeenCalledWith(
                ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
                expect.objectContaining({ residence_country: iso2 })
            )
            expect(mockedCapture).not.toHaveBeenCalledWith(
                ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
                expect.anything()
            )
            expect(mockHandleNext).toHaveBeenCalledTimes(1)
        }
    )

    it.each([
        ['IN', 'card'],
        ['TR', 'card'],
        ['UA', 'card'],
        ['VN', 'card'],
        ['IL', 'card'],
        ['NP', 'card'],
        ['NI', 'card'],
        ['DZ', 'banking'],
        ['BI', 'banking'],
        ['GW', 'banking'],
        ['JP', 'banking'],
        ['TN', 'banking'],
        // Bridge's Prohibited list (api#1738, TASK-23054 R2)
        ['AF', 'banking'],
        ['SD', 'banking'],
        ['LY', 'banking'],
        ['PS', 'banking'],
        ['LB', 'banking'],
        ['YE', 'banking'],
        ['SO', 'banking'],
        ['SS', 'banking'],
        ['CD', 'banking'],
    ])('reports %s as a partial (%s) restriction and advances', (iso2, kind) => {
        mockSetupState.residenceCountry = iso2
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
            expect.objectContaining({ residence_country: iso2, restriction_type: kind })
        )
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('uses updated server tiers when classifying the outcome', () => {
        mockRestrictionSets = { full: new Set(['PT']), cardOnly: new Set(), bankingOnly: new Set() }
        mockSetupState.residenceCountry = 'PT'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
            expect.objectContaining({ residence_country: 'PT' })
        )
    })

    it('lists sanctioned countries in the selector so residents can answer truthfully', () => {
        // countryData omits them (it is the add-money destination list); the
        // supplemental options must fill the gap so residents can reach the plan.
        render(<ResidenceStep />)
        fireEvent.click(screen.getByTestId('setup-residence-country'))
        // Substring match: the selector now renders Intl.DisplayNames names,
        // which can extend the catalog title (en shows Myanmar (Burma)).
        for (const name of ['Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Myanmar']) {
            expect(screen.getByText(name, { exact: false })).toBeInTheDocument()
        }
    })

    it('does not intercept hardware back on the sentence: the stepper owns it', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        expect(dispatchBackPress()).toBe(false)
    })

    it('does not advance while the flow is already loading', () => {
        mockIsLoading = true
        mockSetupState.residenceCountry = 'BR'
        const { container } = render(<ResidenceStep />)
        const confirm = container.querySelector('[data-setup-footer] button')
        expect(confirm).toBeDisabled()
        fireEvent.click(confirm!)
        expect(mockHandleNext).not.toHaveBeenCalled()
    })
})
