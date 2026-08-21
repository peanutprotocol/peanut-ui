/** @jest-environment jsdom */
/**
 * Residence step — legal-residence question between username and passkey.
 *
 * Contract under test: geo only prefills (never advances, never restricts),
 * the multi-doc link reveals a second selector, restricted residences
 * (CN/IR/RU/BY/GB) get the generic heads-up before handleNext can run, and
 * the notify exit validates the email before capturing it.
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

    it('advances directly for an unrestricted residence', () => {
        mockSetupState.residenceCountry = 'BR'
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_SELECTED,
            expect.objectContaining({ residence_country: 'BR' })
        )
        expect(mockHandleNext).toHaveBeenCalled()
        expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
    })

    it.each(['CN', 'IR', 'RU', 'BY', 'GB'])('shows the generic heads-up for %s before advancing', (iso2) => {
        mockSetupState.residenceCountry = iso2
        render(<ResidenceStep />)
        fireEvent.click(screen.getByRole('button', { name: 'Next' }))
        expect(mockHandleNext).not.toHaveBeenCalled()
        expect(screen.getByText('Heads up')).toBeInTheDocument()
        // the screen itself never names a country
        expect(screen.queryByText(/United Kingdom|China|Iran|Russia|Belarus/)).not.toBeInTheDocument()
        expect(mockedCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.SIGNUP_RESIDENCE_RESTRICTED_SHOWN,
            expect.objectContaining({ residence_country: iso2 })
        )
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
