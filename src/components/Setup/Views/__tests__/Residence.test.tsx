/** @jest-environment jsdom */
/**
 * Residence step — legal-residence question right after the username step.
 *
 * Contract under test: geo only prefills (never advances, never restricts),
 * the multi-doc link reveals a second selector, and Confirm advances to the
 * payment plan step, reporting the residence outcome (restricted, partial or
 * congrats) for the picked primary country.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import posthog from 'posthog-js'
import { IntlWrapper } from '@/test-utils/intl'
import en from '@/i18n/app/messages/en.json'
import ResidenceStep from '@/components/Setup/Views/Residence'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockSetResidenceCountry = jest.fn()
const mockSetSecondResidenceCountry = jest.fn()
let mockSetupState: { residenceCountry: string; secondResidenceCountry: string }
// The layout re-filters the step list after the residence lands; null follows it, a country pins a stale list.
let mockStepsCountry: string | null = null
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        ...mockSetupState,
        steps: jest
            .requireActual('@/features/setup/filterSetupSteps')
            .setupFeatureScreensForResidence(
                mockRestrictionSets ??
                    jest.requireActual('@/hooks/useResidenceRestrictionSets').LOCAL_RESIDENCE_RESTRICTION_SETS,
                mockStepsCountry ?? mockSetupState.residenceCountry
            )
            .map((screenId: string) => ({ screenId })),
        fundingChannel: 'crypto',
        paymentChannel: 'peanut',
        setFundingChannel: jest.fn(),
        setPaymentChannel: jest.fn(),
        setResidenceCountry: mockSetResidenceCountry,
        setSecondResidenceCountry: mockSetSecondResidenceCountry,
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
        mockSetupState = { residenceCountry: '', secondResidenceCountry: '' }
        mockStepsCountry = null
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

    // The shared SetupWrapper title block renders the title and description,
    // so the step itself must not add a second heading.
    it('leaves the heading to the shared title block', () => {
        render(<ResidenceStep />)
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
        expect(screen.queryByText(en.setup.steps.residence.description)).not.toBeInTheDocument()
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

    it('reveals the second selector via the multi-doc link', () => {
        render(<ResidenceStep />)
        expect(screen.queryByPlaceholderText('Second country')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText(en.setup.residenceStep.multiDocLink))
        expect(screen.getByPlaceholderText('Second country')).toBeInTheDocument()
    })

    it('clears the stored second residence when the selector is collapsed', () => {
        // An invisible second residence would still be sent to analytics and
        // persisted after signup — collapsing must clear the stored pick.
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        const toggle = screen.getByRole('button', { name: en.setup.residenceStep.multiDocLink })
        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        fireEvent.click(toggle)
        expect(mockSetSecondResidenceCountry).toHaveBeenCalledWith('')
        expect(toggle).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByPlaceholderText('Second country')).not.toBeInTheDocument()
    })

    it('opening the selector clears nothing', () => {
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: en.setup.residenceStep.multiDocLink }))
        expect(mockSetSecondResidenceCountry).not.toHaveBeenCalled()
    })

    it('shows the ID note under the country field', () => {
        render(<ResidenceStep />)
        const note = screen.getByText(en.setup.residenceStep.idNote)
        expect(note.previousElementSibling).toContainElement(screen.getByRole('combobox'))
    })

    // The dual path shows the same single note, under the second field, and no
    // per-country comparison: the "Select <country>" buttons are the whole choice.
    it('moves the ID note under the second field for two countries, with no comparison', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        const notes = screen.getAllByText(en.setup.residenceStep.idNote)
        expect(notes).toHaveLength(1)
        const [, second] = screen.getAllByRole('combobox')
        expect(notes[0].previousElementSibling).toContainElement(second)
        expect(screen.queryByText(/Available with/)).not.toBeInTheDocument()
        expect(screen.queryByText('Peanut to Peanut')).not.toBeInTheDocument()
        expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })

    it('replaces Next with one main-residence button per declared country', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Select Brazil' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Select Germany' })).toBeInTheDocument()
    })

    it('promotes the picked country to main residence before continuing', () => {
        // The tap IS the declaration: picking the second entry swaps the pair's
        // order, and the outcome must be evaluated against the picked country —
        // not the store value this render closed over.
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Select Germany' }))
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('DE')
        expect(mockSetSecondResidenceCountry).toHaveBeenCalledWith('BR')
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'DE', second_residence_country: 'BR' })
        )
    })

    it('advances only once the step list follows a promoted residence that offers other sell screens', () => {
        // BR offers accounts and the card; JP offers only the card (bankingOnly here). Advancing in
        // the same click would follow BR's list onto Accounts, which JP does not show.
        mockRestrictionSets = { full: new Set(), bankingOnly: new Set(['JP']), cardOnly: new Set() }
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'JP' }
        const view = render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Select Japan' }))
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('JP')
        expect(mockHandleNext).not.toHaveBeenCalled()
        // the residence landed, but the layout has not re-filtered yet
        mockSetupState = { residenceCountry: 'JP', secondResidenceCountry: 'BR' }
        mockStepsCountry = 'BR'
        view.rerender(<ResidenceStep />)
        expect(mockHandleNext).not.toHaveBeenCalled()
        // both country buttons wait, so a second tap cannot start another advance
        view.container.querySelectorAll('[data-setup-footer] button').forEach((button) => expect(button).toBeDisabled())
        mockStepsCountry = null
        view.rerender(<ResidenceStep />)
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('clearing the first country leaves the second as the only residence', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove Brazil' }))
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('DE')
        expect(mockSetSecondResidenceCountry).toHaveBeenCalledWith('')
        expect(screen.queryByPlaceholderText('Second country')).not.toBeInTheDocument()
    })

    it('stops attributing a promoted country to the geo suggestion', () => {
        // BR was suggested by geo; the user added DE and then cleared BR. DE was
        // typed, so continuing must not report it as a prefilled geo match.
        mockGeoCountry = 'br'
        const view = render(<ResidenceStep />)
        // the geo effect prefilled BR and latched the flag
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('BR')
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        view.rerender(<ResidenceStep />)
        fireEvent.click(screen.getByText(en.setup.residenceStep.multiDocLink))
        fireEvent.click(screen.getByRole('button', { name: 'Remove Brazil' }))
        mockSetupState = { residenceCountry: 'DE', secondResidenceCountry: '' }
        view.rerender(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'DE', was_prefilled: false })
        )
    })

    it('clearing the second country keeps the first and collapses the pair', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove Germany' }))
        expect(mockSetResidenceCountry).not.toHaveBeenCalledWith('DE')
        expect(mockSetSecondResidenceCountry).toHaveBeenCalledWith('')
        expect(screen.queryByPlaceholderText('Second country')).not.toBeInTheDocument()
    })

    it('reports the congrats outcome for an unrestricted residence and advances to the plan', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
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

    it('evaluates the outcome against the picked main residence, not the second one', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'GB' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Select Brazil' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockedCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
            expect.anything()
        )
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    // TASK-23054 R1: HK was restricted for a Sumsub document rule, which never
    // decides eligibility; it is in no tier now
    it('treats Hong Kong as unrestricted', () => {
        mockSetupState.residenceCountry = 'HK'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
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
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
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
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
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
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
            expect.objectContaining({ residence_country: 'PT' })
        )
    })

    it('lists sanctioned countries in the selector so residents can answer truthfully', () => {
        // countryData omits them (it is the add-money destination list); the
        // supplemental options must fill the gap so residents can reach the plan.
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('combobox'))
        // Substring match: the selector now renders Intl.DisplayNames names,
        // which can extend the catalog title (en shows Myanmar (Burma)).
        for (const name of ['Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Myanmar']) {
            expect(screen.getByText(name, { exact: false })).toBeInTheDocument()
        }
    })

    it('does not intercept hardware back: the stepper owns it', () => {
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
