/** @jest-environment jsdom */
/**
 * GettingStartedChecklist — the 3-item home to-do list.
 *
 * Contract: always exactly three rows; registration pre-checked; the add-money
 * label follows residence and carries the KYC cost only while unverified; the
 * third slot is the card when eligible, otherwise the first payment (never a
 * dangling card step); renders nothing once everything is done.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'

const render = () => rtlRender(<GettingStartedChecklist />, { wrapper: IntlWrapper })

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const mockSetIsQRScannerOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsQRScannerOpen: mockSetIsQRScannerOpen }),
}))

let mockUser: {
    user?: { activationMilestone?: string }
    residence?: { declared: string | null; verified: string | null }
} | null = null
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

let mockIsEligible: boolean | undefined = true
jest.mock('@/hooks/useCardInfo', () => ({ useCardInfo: () => ({ isEligible: mockIsEligible }) }))

let mockOverview: unknown = null
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: mockOverview }) }))
jest.mock('@/components/Card/cardState.utils', () => ({
    findActiveCard: (overview: unknown) => (overview ? { id: 'card-1' } : null),
}))

describe('GettingStartedChecklist', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockUser = { user: { activationMilestone: 'registered' }, residence: { declared: 'BR', verified: null } }
        mockRestrictions = { banking: false, card: false }
        mockIsEligible = true
        mockOverview = null
    })

    it('renders exactly three rows with registration pre-checked', () => {
        render()
        expect(screen.getAllByRole('button')).toHaveLength(3)
        expect(screen.getByText('Create your account')).toBeInTheDocument()
        expect(screen.getByText('Done. Your money has a username now')).toBeInTheDocument()
    })

    it.each([
        ['BR', 'Add money with PIX'],
        ['MX', 'Add money via SPEI'],
        ['US', 'Add money from your bank'],
        ['DE', 'Add money via SEPA'],
        ['NG', 'Add money'],
    ])('the add-money label follows residence: %s → %s', (iso2, label) => {
        mockUser = { user: { activationMilestone: 'registered' }, residence: { declared: iso2, verified: null } }
        render()
        expect(screen.getByText(label)).toBeInTheDocument()
    })

    it('carries the KYC cost only while unverified', () => {
        render()
        expect(screen.getByText('Bank deposits need a one-time ID check · about 10 min')).toBeInTheDocument()
        mockUser = { user: { activationMilestone: 'verified' }, residence: { declared: 'BR', verified: 'BR' } }
        render()
        expect(screen.getAllByText(/Bank deposits need/).length).toBe(1) // only the first render's copy
    })

    it('marks add money done once funded', () => {
        mockUser = { user: { activationMilestone: 'funded' }, residence: { declared: 'BR', verified: 'BR' } }
        render()
        const addMoney = screen.getByText('Add money with PIX').closest('button')
        expect(addMoney).toBeDisabled()
    })

    it('third slot is the card when eligible, and it routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('Get your Peanut card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
        expect(screen.queryByText('Make your first payment')).not.toBeInTheDocument()
    })

    it('third slot falls back to first payment when the card is unavailable, opening the scanner', () => {
        mockRestrictions = { banking: false, card: true }
        render()
        expect(screen.queryByText('Get your Peanut card')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Make your first payment'))
        expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
    })

    it('ineligible card (server says no) also falls back to first payment', () => {
        mockIsEligible = false
        render()
        expect(screen.queryByText('Get your Peanut card')).not.toBeInTheDocument()
        expect(screen.getByText('Make your first payment')).toBeInTheDocument()
    })

    it('renders nothing once every item is done', () => {
        mockUser = { user: { activationMilestone: 'funded' }, residence: { declared: 'BR', verified: 'BR' } }
        mockOverview = { cards: [{}] } // findActiveCard mock: truthy overview = active card
        const { container } = render()
        expect(container.firstChild).toBeNull()
    })

    it('add money taps into /add-money', () => {
        render()
        fireEvent.click(screen.getByText('Add money with PIX'))
        expect(mockPush).toHaveBeenCalledWith('/add-money')
    })
})
