/** @jest-environment jsdom */
/**
 * Residence step — legal-residence question between username and passkey.
 *
 * Contract under test: geo only prefills (never advances, never restricts),
 * the multi-doc link reveals a second selector, restricted residences
 * (CN/IR/RU/BY/GB) get an availability checklist before handleNext can run,
 * unrestricted residences get the congrats screen before handleNext can run,
 * and residence outcomes respect the same eligibility data.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
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
jest.mock('@/features/setup/SetupFlowContext', () => ({
    useSetupFlowContext: () => ({
        ...mockSetupState,
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
let mockDirection = 1
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading, direction: mockDirection }),
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
        mockDirection = 1
        mockSetupState = { residenceCountry: '', secondResidenceCountry: '' }
        mockGeoCountry = null
        mockEdgeCountry = null
        mockEdgeSettled = true
        mockRestrictionSets = undefined
        mockRestrictionSetsSettled = true
    })

    it('disables Continue until a country is chosen', () => {
        render(<ResidenceStep />)
        expect(screen.getByRole('button', { name: "That's my home" })).toBeDisabled()
    })

    // The chrome h1 is suppressed for this step (titleInView), so each view
    // must render exactly one top-level heading of its own.
    it('renders the step title as the only heading on the select view', () => {
        render(<ResidenceStep />)
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(screen.getByRole('heading', { level: 1, name: 'Country of legal residence' })).toBeInTheDocument()
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

    it('shows the per-country availability comparison with document guidance', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        expect(screen.getByText('Available with Brazil')).toBeInTheDocument()
        expect(screen.getByText('Available with Germany')).toBeInTheDocument()
        // BR rides Manteca only — no Bridge rail exists for it, so the card must not claim one
        expect(screen.getByText('PIX payments & transfers')).toBeInTheDocument()
        // DE is Bridge-served: one verification opens every Bridge virtual-account rail
        expect(screen.getByText('Euro bank transfers')).toBeInTheDocument()
        expect(screen.getByText('British pound bank transfers')).toBeInTheDocument()
        expect(screen.getByText('US dollar bank transfers')).toBeInTheDocument()
        expect(screen.getAllByText('Peanut to Peanut')).toHaveLength(2)
        expect(screen.getByText(en.setup.residenceStep.compare.guideTitle)).toBeInTheDocument()
        expect(screen.getByText(en.setup.residenceStep.compare.guideDeclaration)).toBeInTheDocument()
    })

    it('replaces Next with one main-residence button per declared country', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        expect(screen.queryByRole('button', { name: "That's my home" })).not.toBeInTheDocument()
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

    it('clearing the first country leaves the second as the only residence', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Remove Brazil' }))
        expect(mockSetResidenceCountry).toHaveBeenCalledWith('DE')
        expect(mockSetSecondResidenceCountry).toHaveBeenCalledWith('')
        expect(screen.queryByText('Available with Brazil')).not.toBeInTheDocument()
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
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
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
        expect(screen.queryByText('Available with Germany')).not.toBeInTheDocument()
    })

    it('shows the congrats screen for an unrestricted residence and continues on demand', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
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
        expect(
            screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
        ).toBeInTheDocument()
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
        // the screen itself never names a country
        expect(screen.queryByText(/Brazil/)).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Make a payment with: Peanut to Peanut' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Keep these choices' }))
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('uses universal choices until the authoritative lookup settles', () => {
        mockRestrictionSetsSettled = false
        mockSetupState.residenceCountry = 'BR'
        const view = render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
        mockRestrictionSetsSettled = true
        view.rerender(<ResidenceStep />)
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
    })

    it('shows the primary residence checklist even when the second residence is restricted', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'GB' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Select Brazil' }))
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getByRole('heading', { name: /I’ll add money to my Peanut account/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
    })

    it('returns to the selector from the congrats screen', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        fireEvent.click(screen.getByText('Choose a different country'))
        expect(screen.queryByText('I’ll add money to my Peanut account')).not.toBeInTheDocument()
        expect(screen.getByText(en.setup.residenceStep.multiDocLink)).toBeInTheDocument()
    })

    // TASK-23054 R1: HK was restricted for a Sumsub document rule, which never
    // decides eligibility; it is in no tier now
    it('treats Hong Kong as unrestricted', () => {
        mockSetupState.residenceCountry = 'HK'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        expect(
            screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
        ).toBeInTheDocument()
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
    })

    // mirrors peanut-api-ts FULL_RESTRICTED_RESIDENCE (api#1738)
    it.each(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'MM', 'VE', 'IQ'])(
        'shows the universal method selectors for %s before advancing',
        (iso2) => {
            mockSetupState.residenceCountry = iso2
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
            expect(mockHandleNext).not.toHaveBeenCalled()
            expect(screen.getAllByRole('heading')).toHaveLength(1)
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()
            expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
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
    ])('shows eligible methods for %s (%s restriction) and continues on demand', (iso2, kind) => {
        mockSetupState.residenceCountry = iso2
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getAllByRole('heading')).toHaveLength(1)
        expect(
            screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
        ).toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
            expect.objectContaining({ residence_country: iso2, restriction_type: kind })
        )
        fireEvent.click(screen.getByRole('button', { name: 'Keep these choices' }))
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('shows the universal funding and payment choices for Ukraine', () => {
        mockSetupState.residenceCountry = 'UA'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        expect(screen.getByRole('button', { name: 'Add money with: Crypto' })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Make a payment with: Peanut to Peanut' })).toBeInTheDocument()
        expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
        expect(mockHandleNext).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Keep these choices' }))
        expect(mockHandleNext).toHaveBeenCalledTimes(1)
    })

    it('lists sanctioned countries in the selector so residents can answer truthfully', () => {
        // countryData omits them (it is the add-money destination list); the
        // supplemental options must fill the gap so residents can reach their checklist.
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('combobox'))
        // Substring match: the selector now renders Intl.DisplayNames names,
        // which can extend the catalog title (en shows Myanmar (Burma)).
        for (const name of ['Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Myanmar']) {
            expect(screen.getByText(name, { exact: false })).toBeInTheDocument()
        }
    })

    it('lets a restricted resident continue from the checklist', () => {
        mockSetupState.residenceCountry = 'GB'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        fireEvent.click(screen.getByRole('button', { name: 'Keep these choices' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_CONTINUED,
            expect.objectContaining({ residence_country: 'GB' })
        )
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('returns to the selector from the checklist', () => {
        mockSetupState.residenceCountry = 'CN'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
        fireEvent.click(screen.getByText('Choose a different country'))
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
        expect(screen.getByText(en.setup.residenceStep.multiDocLink)).toBeInTheDocument()
    })

    describe('stepping back into the step', () => {
        // One step back must land on the screen the
        // user actually left: the checklist for a restricted pick, never the
        // username screen two steps away (TASK-22232).
        it('restores the checklist for a fully restricted pick', () => {
            mockDirection = -1
            mockSetupState.residenceCountry = 'CN'
            render(<ResidenceStep />)
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Keep these choices' })).toBeInTheDocument()
        })

        it('restores the checklist with the matching eligibility', () => {
            mockDirection = -1
            mockSetupState.residenceCountry = 'JP'
            render(<ResidenceStep />)
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()
            expect(screen.queryByRole('checkbox', { name: 'Bank accounts & transfers' })).not.toBeInTheDocument()
        })

        it('restores the plan for an unrestricted pick, then Back returns to the selector', () => {
            mockDirection = -1
            mockSetupState.residenceCountry = 'BR'
            render(<ResidenceStep />)
            expect(screen.getByRole('heading', { level: 1, name: /I’ll add money/ })).toBeInTheDocument()
            act(() => {
                dispatchBackPress()
            })
            expect(screen.getByRole('heading', { level: 1, name: 'Country of legal residence' })).toBeInTheDocument()
        })

        it('uses the page arrival direction when browser Back precedes context synchronization', () => {
            mockDirection = 1
            mockSetupState.residenceCountry = 'BR'
            render(<ResidenceStep entryDirection={-1} />)
            expect(screen.getByRole('heading', { level: 1, name: /I’ll add money/ })).toBeInTheDocument()
        })

        it('starts on the selector when entering forward with a stored pick', () => {
            mockDirection = 1
            mockSetupState.residenceCountry = 'CN'
            render(<ResidenceStep />)
            expect(screen.getByRole('heading', { level: 1, name: 'Country of legal residence' })).toBeInTheDocument()
        })
    })

    describe('hardware back', () => {
        it('returns to the selector from a checklist sub-view', () => {
            mockSetupState.residenceCountry = 'CN'
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()

            let consumed = false
            act(() => {
                consumed = dispatchBackPress()
            })
            expect(consumed).toBe(true)
            expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
            expect(screen.getByText(en.setup.residenceStep.multiDocLink)).toBeInTheDocument()
        })

        it('returns to the selector from the congrats view', () => {
            mockSetupState.residenceCountry = 'BR'
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()

            act(() => {
                dispatchBackPress()
            })
            expect(screen.queryByText('I’ll add money to my Peanut account')).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: "That's my home" })).toBeInTheDocument()
        })

        it('does not intercept on the selector itself', () => {
            render(<ResidenceStep />)
            expect(dispatchBackPress()).toBe(false)
        })

        it('consumes but holds the sub-view while the step is advancing', () => {
            mockSetupState.residenceCountry = 'CN'
            const view = render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: "That's my home" }))
            mockIsLoading = true
            view.rerender(<ResidenceStep />)

            let consumed = false
            act(() => {
                consumed = dispatchBackPress()
            })
            expect(consumed).toBe(true)
            expect(
                screen.getByRole('heading', { level: 1, name: /I’ll add money to my Peanut account/ })
            ).toBeInTheDocument()
        })
    })
})

it('lets users continue from the merged plan without changing residence', () => {
    jest.clearAllMocks()
    mockIsLoading = false
    mockRestrictionSets = undefined
    mockRestrictionSetsSettled = true
    mockSetupState = { residenceCountry: 'PT', secondResidenceCountry: '' }
    render(<ResidenceStep initialView="congrats" />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(mockSetResidenceCountry).not.toHaveBeenCalled()
    expect(mockHandleNext).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Keep these choices' }))
    expect(mockHandleNext).toHaveBeenCalledTimes(1)
})
