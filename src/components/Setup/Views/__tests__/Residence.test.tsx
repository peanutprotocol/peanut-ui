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
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import posthog from 'posthog-js'
import { IntlWrapper } from '@/test-utils/intl'
import ResidenceStep from '@/components/Setup/Views/Residence'
import { setupActions } from '@/redux/slices/setup-slice'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: IntlWrapper })

const mockDispatch = jest.fn()
let mockSetupState: { residenceCountry: string; secondResidenceCountry: string }
jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => mockDispatch,
    useSetupStore: () => mockSetupState,
}))

const mockHandleNext = jest.fn()
let mockIsLoading = false
jest.mock('@/hooks/useSetupFlow', () => ({
    useSetupFlow: () => ({ handleNext: mockHandleNext, isLoading: mockIsLoading }),
}))

let mockGeoCountry: string | null = null
let mockRestrictionSets: unknown
let mockRestrictionSetsSettled = true
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
        mockGeoCountry = null
        mockRestrictionSets = undefined
        mockRestrictionSetsSettled = true
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
        expect(screen.getByRole('heading', { level: 1, name: 'Where do you legally live?' })).toBeInTheDocument()
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
        expect(screen.queryByPlaceholderText('Select your second country')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Have documents from more than one country?'))
        expect(screen.getByPlaceholderText('Select your second country')).toBeInTheDocument()
    })

    it('clears the stored second residence when the selector is collapsed', () => {
        // An invisible second residence would still be sent to analytics and
        // persisted after signup — collapsing must clear the stored pick.
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByText('Have documents from more than one country?'))
        expect(mockDispatch).toHaveBeenCalledWith(setupActions.setSecondResidenceCountry(''))
    })

    it('shows the per-country availability comparison with the truth-first guidance', () => {
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'DE' }
        render(<ResidenceStep />)
        expect(screen.getByText('Available with Brazil')).toBeInTheDocument()
        expect(screen.getByText('Available with Germany')).toBeInTheDocument()
        // BR rides Manteca only — no Bridge rail exists for it, so the card must not claim one
        expect(screen.getByText('PIX payments & transfers')).toBeInTheDocument()
        // DE is Bridge-served: one verification opens every Bridge virtual-account rail
        expect(screen.getByText('SEPA transfers (EUR)')).toBeInTheDocument()
        expect(screen.getByText('GBP transfers (Faster Payments)')).toBeInTheDocument()
        expect(screen.getByText('USD transfers (ACH & Wire)')).toBeInTheDocument()
        expect(screen.getAllByText('Peanut-to-Peanut payments')).toHaveLength(2)
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
        // gates stay separated in prose: no-ID features first, the bank rail
        // behind the ID check (named per country), then the card behind BOTH
        // of its remaining gates. Naming the card without the waitlist is the
        // regression this guards (2026-09-05 policy change).
        expect(screen.getByText(/work right away, and a quick ID check unlocks PIX transfers/)).toBeInTheDocument()
        expect(screen.getByText(/The Peanut card is also available/)).toBeInTheDocument()
        expect(screen.getByText(/it needs an ID check, and you'll join a waitlist/)).toBeInTheDocument()
        // Rain §7 bans availability framing keyed to a place — no country here
        expect(screen.queryByText(/in your country/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockHandleNext).toHaveBeenCalled()
    })

    it('drops the ID-check clause for a country with no fiat rail', () => {
        // NG is in no restriction set, but no fiat rail serves it (blockchain
        // only): the congrats screen must not frame the ID check as unlocking
        // bank transfers there — the rail clause disappears entirely.
        mockSetupState.residenceCountry = 'NG'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        // the rail clause disappears; the card clause is self-contained, so the
        // same string serves both branches
        expect(screen.getByText(/work right away\./)).toBeInTheDocument()
        expect(screen.getByText(/it needs an ID check, and you'll join a waitlist/)).toBeInTheDocument()
        expect(screen.queryByText(/in your country/)).not.toBeInTheDocument()
        expect(screen.queryByText(/unlocks/)).not.toBeInTheDocument()
        expect(screen.queryByText(/bank transfers/i)).not.toBeInTheDocument()
    })

    it('advances silently instead of claiming congrats while the server lookup is unsettled', () => {
        // The mirror alone must not back a definitive "nothing is restricted"
        // claim: before the lookup resolves, the step behaves like the
        // pre-congrats flow and just advances.
        mockRestrictionSetsSettled = false
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockHandleNext).toHaveBeenCalled()
        expect(screen.queryByText('Good news')).not.toBeInTheDocument()
        expect(mockedCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.anything()
        )
    })

    it('demotes the congrats view when server lists later restrict the country', () => {
        // The sets render from the bundled mirror and the server response can
        // land after Next was tapped: the "nothing is restricted" claim must
        // not outlive the data it was based on.
        mockSetupState.residenceCountry = 'BR'
        const view = render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(screen.getByRole('heading', { level: 1, name: 'Good news' })).toBeInTheDocument()
        const actual = jest.requireActual('@/hooks/useResidenceRestrictionSets')
        const local = actual.LOCAL_RESIDENCE_RESTRICTION_SETS
        mockRestrictionSets = { ...local, bankingOnly: new Set([...local.bankingOnly, 'BR']) }
        view.rerender(<ResidenceStep />)
        expect(screen.getByRole('heading', { level: 1, name: 'Heads up' })).toBeInTheDocument()
        expect(screen.getByText(/Bank transfers aren't available in your country/)).toBeInTheDocument()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_PARTIAL_SHOWN,
            expect.objectContaining({ residence_country: 'BR', restriction_type: 'banking' })
        )
    })

    it('skips the congrats claim when the second residence is restricted', () => {
        // "Nothing is restricted where you live" would contradict the compare
        // cards the user just saw for a restricted second country: advance
        // silently, like the flow did before the congrats screen existed.
        mockSetupState = { residenceCountry: 'BR', secondResidenceCountry: 'GB' }
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockHandleNext).toHaveBeenCalled()
        expect(screen.queryByText('Good news')).not.toBeInTheDocument()
        expect(mockedCapture).not.toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_CONGRATS_SHOWN,
            expect.anything()
        )
    })

    it('returns to the selector from the congrats screen', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        fireEvent.click(screen.getByText('Choose a different country'))
        expect(screen.queryByText('Good news')).not.toBeInTheDocument()
        expect(screen.getByText('Have documents from more than one country?')).toBeInTheDocument()
    })

    it.each(['CN', 'IR', 'RU', 'BY', 'GB', 'KP', 'SY', 'CU', 'HK', 'MM'])(
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

    describe('hardware back', () => {
        it('returns to the selector from a heads-up sub-view', () => {
            mockSetupState.residenceCountry = 'CN'
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            expect(screen.getByRole('heading', { level: 1, name: 'Heads up' })).toBeInTheDocument()

            let consumed = false
            act(() => {
                consumed = dispatchBackPress()
            })
            expect(consumed).toBe(true)
            expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
            expect(screen.getByText('Have documents from more than one country?')).toBeInTheDocument()
        })

        it('returns to the selector from the congrats view', () => {
            mockSetupState.residenceCountry = 'BR'
            render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            expect(screen.getByRole('heading', { level: 1, name: 'Good news' })).toBeInTheDocument()

            act(() => {
                dispatchBackPress()
            })
            expect(screen.queryByText('Good news')).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
        })

        it('does not intercept on the selector itself', () => {
            render(<ResidenceStep />)
            expect(dispatchBackPress()).toBe(false)
        })

        it('consumes but holds the sub-view while the step is advancing', () => {
            mockSetupState.residenceCountry = 'CN'
            const view = render(<ResidenceStep />)
            fireEvent.click(screen.getByRole('button', { name: 'Next' }))
            mockIsLoading = true
            view.rerender(<ResidenceStep />)

            let consumed = false
            act(() => {
                consumed = dispatchBackPress()
            })
            expect(consumed).toBe(true)
            expect(screen.getByRole('heading', { level: 1, name: 'Heads up' })).toBeInTheDocument()
        })
    })
})
