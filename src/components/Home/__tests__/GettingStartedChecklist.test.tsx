/** @jest-environment jsdom */
/**
 * GettingStartedChecklist — the 3-item home to-do list.
 *
 * Contract: always exactly three rows; registration pre-checked; the add-money
 * label follows residence and carries the KYC cost only while unverified; the
 * third slot is the card when eligible, otherwise the first payment (never a
 * dangling card step); the reachable Home progress state stays visible.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'

const mockUrlUpdate = jest.fn()
const render = () =>
    rtlRender(
        <NuqsTestingAdapter searchParams="?returnTo=%2Fprofile" onUrlUpdate={mockUrlUpdate}>
            <GettingStartedChecklist />
        </NuqsTestingAdapter>,
        { wrapper: IntlWrapper }
    )

const mockPush = jest.fn()
const mockSetHomeDrawer = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/features/home/useHomeDrawer', () => ({
    useHomeDrawer: () => [null, mockSetHomeDrawer],
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

let mockUser: {
    user?: { activationMilestone?: string; firstPaymentAt?: string | null }
    residence?: { declared: string | null; verified: string | null }
} | null = null
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

// the standing-accounts flag rewrites the add-money subtitle; off by default
// here, so every case below reads the pre-launch copy unless it says otherwise
let mockDepositAccounts = false
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccounts,
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

let mockIsEligible: boolean | undefined = true
let mockIsCardInfoFetching = false
jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ isEligible: mockIsEligible, isFetching: mockIsCardInfoFetching }),
}))

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
        mockDepositAccounts = false
        mockIsEligible = true
        mockIsCardInfoFetching = false
        mockOverview = null
    })

    // ListItem renders a div[role=button] only for tappable rows. Done rows are
    // plain rows, not disabled ones, so rows are counted by test id.
    it('renders exactly three rows with registration pre-checked', () => {
        render()
        expect(screen.getAllByTestId(/^checklist-/)).toHaveLength(3)
        expect(screen.getAllByRole('button')).toHaveLength(2)
        expect(screen.getByText('Create your account')).toBeInTheDocument()
        expect(screen.getByTestId('checklist-create-account')).not.toHaveAttribute('aria-disabled')
        expect(screen.getByTestId('checklist-create-account')).not.toHaveAttribute('role')
        expect(screen.getByText('Done. Your money has a username now')).toBeInTheDocument()
    })

    it('keeps completed rows on the same white surface as pending rows', () => {
        render()
        const completed = screen.getByTestId('checklist-create-account')
        expect(completed).toHaveClass('bg-background-default', 'border-border-default')
        expect(screen.getByTestId('checklist-add-money')).toHaveClass('bg-background-default', 'border-border-default')
        expect(screen.getByTestId('checklist-get-card')).toHaveClass('bg-background-default', 'border-border-default')
        expect(completed).not.toHaveClass('bg-background-disabled', 'bg-background-icon-bubble-green/10')
        expect(completed).not.toHaveClass('border-border-subtle')
    })

    it('uses Get started for the reachable 33% Home state', () => {
        render()
        expect(screen.getByText('Get started')).toBeInTheDocument()
        expect(screen.getByText('33%')).toBeInTheDocument()
        expect(screen.queryByText('Keep going')).not.toBeInTheDocument()
    })

    it('wraps checklist subtitles instead of truncating them', () => {
        render()
        const subtitle = screen.getByText('Bank transfer or crypto · bank needs a one-time ID check')
        expect(subtitle).toHaveClass('whitespace-normal', 'break-words')
        expect(subtitle).not.toHaveClass('truncate')
    })

    // The row opens the Add drawer, offering bank transfer AND crypto, so
    // it no longer names one rail per residence — that promised a route the
    // chooser does not take you straight to.
    it.each([['BR'], ['MX'], ['US'], ['DE'], ['NG']])(
        'the add-money label names the action, not a rail: %s',
        (iso2) => {
            mockUser = { user: { activationMilestone: 'registered' }, residence: { declared: iso2, verified: null } }
            render()
            expect(screen.getByText('Add money')).toBeInTheDocument()
            expect(screen.queryByText(/PIX|SPEI|SEPA|from your bank/)).not.toBeInTheDocument()
        }
    )

    it('carries the KYC cost only while unverified', () => {
        render()
        expect(screen.getByText('Bank transfer or crypto · bank needs a one-time ID check')).toBeInTheDocument()
        mockUser = { user: { activationMilestone: 'verified' }, residence: { declared: 'BR', verified: 'BR' } }
        render()
        // the verified render names both routes without the ID-check cost
        expect(screen.getAllByText('Bank transfer or crypto').length).toBe(1)
        expect(screen.getAllByText(/one-time ID check/).length).toBe(1) // only the first render's copy
    })

    /**
     * Once standing accounts are live the step stops being a chore. The row
     * promises the thing the user gets, not the ID check it costs.
     */
    it('promises the standing account once deposit accounts are live', () => {
        mockDepositAccounts = true
        render()

        expect(
            screen.getByText('Claim your own bank details. Get paid in euros, dollars and more.')
        ).toBeInTheDocument()
        expect(screen.queryByText(/one-time ID check/)).not.toBeInTheDocument()
        expect(screen.getByText('Add money')).toBeInTheDocument()
    })

    it('keeps the pre-launch line while the flag is off', () => {
        render()

        expect(screen.getByText('Bank transfer or crypto · bank needs a one-time ID check')).toBeInTheDocument()
        expect(screen.queryByText(/Claim your own bank details/)).not.toBeInTheDocument()
    })

    it('drops the bank half for a residence no bank provider onboards', () => {
        // the ID check would unlock nothing there, so it must not be the price
        // named on the row (same ruling as the signup residence step)
        mockRestrictions = { banking: true, card: false }
        render()
        expect(screen.getByText('Crypto from any wallet or exchange')).toBeInTheDocument()
        expect(screen.queryByText(/one-time ID check/)).not.toBeInTheDocument()
        expect(screen.queryByText(/Bank transfer/)).not.toBeInTheDocument()
    })

    it('marks add money done once funded', () => {
        mockUser = { user: { activationMilestone: 'funded' }, residence: { declared: 'BR', verified: 'BR' } }
        render()
        expect(screen.getByTestId('checklist-add-money')).not.toHaveAttribute('aria-disabled')
        expect(screen.getByTestId('checklist-add-money')).not.toHaveAttribute('role')
    })

    // Any outgoing peer payment (a send to a saved contact included) completes
    // the row, even though activation itself stays card/QR spend only.
    it('marks the first payment done once the user has sent money to anyone', () => {
        mockRestrictions = { banking: false, card: true }
        // verified but not yet funded keeps the list on screen; the payment row
        // alone completes from the peer-payment fact
        mockUser = {
            user: { activationMilestone: 'verified', firstPaymentAt: '2026-09-01T10:00:00.000Z' },
            residence: { declared: 'BR', verified: 'BR' },
        }
        render()
        expect(screen.getByTestId('checklist-first-payment')).not.toHaveAttribute('role')
        expect(screen.getByTestId('checklist-add-money')).not.toHaveAttribute('aria-disabled')
        expect(screen.getByTestId('checklist-add-money')).toHaveAttribute('role', 'button')
    })

    it('third slot is the card when eligible, and it routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('Get your Peanut card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
        expect(screen.queryByText('Make your first payment')).not.toBeInTheDocument()
    })

    // The note promises a send to a Peanut user, ENS name or wallet address —
    // that is the /send flow, not the QR scanner the row used to open.
    it('third slot falls back to first payment when the card is unavailable, routing to /send', () => {
        mockRestrictions = { banking: false, card: true }
        render()
        expect(screen.queryByText('Get your Peanut card')).not.toBeInTheDocument()
        expect(
            screen.getByText('Send a few dollars to a Peanut user, ENS name or wallet address. It lands in seconds.')
        ).toBeInTheDocument()
        fireEvent.click(screen.getByText('Make your first payment'))
        expect(mockPush).toHaveBeenCalledWith('/send')
    })

    it('ineligible card (server says no) also falls back to first payment', () => {
        mockIsEligible = false
        render()
        expect(screen.queryByText('Get your Peanut card')).not.toBeInTheDocument()
        expect(screen.getByText('Make your first payment')).toBeInTheDocument()
    })

    it('unknown eligibility (still loading) never shows the card step', () => {
        // The first-payment step is always a valid action; a card step the
        // server may yet deny is not. Undefined must not read as eligible.
        mockIsEligible = undefined
        render()
        expect(screen.queryByText('Get your Peanut card')).not.toBeInTheDocument()
        expect(screen.getByText('Make your first payment')).toBeInTheDocument()
    })

    it('keeps the cached card row stable while eligibility is refetching', () => {
        mockIsEligible = true
        mockIsCardInfoFetching = true
        render()
        expect(screen.getByText('Get your Peanut card')).toBeInTheDocument()
        expect(screen.queryByText('Make your first payment')).not.toBeInTheDocument()
    })

    it('opens the Home add-money drawer directly', () => {
        render()
        fireEvent.click(screen.getByText('Add money'))
        expect(mockSetHomeDrawer).toHaveBeenCalledWith('add')
    })
})
