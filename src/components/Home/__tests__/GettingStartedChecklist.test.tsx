/** @jest-environment jsdom */
/**
 * GettingStartedChecklist — the Home onboarding checklist (TASK-23054).
 *
 * Contract: four rows — Create account ✓ · Verify identity · Add money · Make
 * the first payment. Every open row stays tappable in any order; the first
 * open, actionable row is outlined in pink; an ID check in review shows a pill
 * and is skipped by the outline. The first-payment row follows the one route
 * selector: card_qr → chooser, card → /card, qr → scanner, none → no row.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import GettingStartedChecklist from '@/components/Home/GettingStartedChecklist'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { OnboardingState } from '@/utils/activation-step.utils'

const NEW_USER: OnboardingState = {
    verify: 'todo',
    addMoneyDone: false,
    firstPaymentDone: false,
    firstPaymentRoute: 'card_qr',
    step: 'verify',
}

const render = (onboarding: Partial<OnboardingState> = {}) =>
    rtlRender(
        <NuqsTestingAdapter searchParams="?returnTo=%2Fprofile">
            <GettingStartedChecklist onboarding={{ ...NEW_USER, ...onboarding }} />
        </NuqsTestingAdapter>,
        { wrapper: IntlWrapper }
    )

const mockPush = jest.fn()
const mockSetHomeDrawer = jest.fn()
const mockSetIsQRScannerOpen = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('@/features/home/useHomeDrawer', () => ({
    useHomeDrawer: () => [null, mockSetHomeDrawer],
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsQRScannerOpen: mockSetIsQRScannerOpen }),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

// the standing-accounts flag rewrites the add-money subtitle; off by default
let mockDepositAccounts = false
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccounts,
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

// the chooser is its own component; here it is a marker that says whether it is open
jest.mock('@/components/Home/FirstPaymentChooser', () => ({
    __esModule: true,
    default: ({ open }: { open: boolean }) => (open ? <div>first-payment-chooser</div> : null),
}))

const outlined = (testId: string) => screen.getByTestId(testId).className.includes('outline-action-primary')

describe('GettingStartedChecklist', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRestrictions = { banking: false, card: false }
        mockDepositAccounts = false
    })

    it('renders four rows, account pre-checked, 25% for a new user', () => {
        render()
        expect(screen.getAllByTestId(/^checklist-/)).toHaveLength(4)
        expect(screen.getByText('Create account')).toBeInTheDocument()
        expect(screen.getByText('Verify identity')).toBeInTheDocument()
        expect(screen.getByText('Add money')).toBeInTheDocument()
        expect(screen.getByText('Make the first payment')).toBeInTheDocument()
        expect(screen.getByText('25%')).toBeInTheDocument()
        // the three open rows are tappable; the done account row is not
        expect(screen.getAllByRole('button')).toHaveLength(3)
    })

    it('outlines the first open row: verify for a new user', () => {
        render()
        expect(outlined('checklist-verify-identity')).toBe(true)
        expect(outlined('checklist-add-money')).toBe(false)
    })

    it('an ID check in review shows a pill, no subtitle, and passes the outline to Add money', () => {
        render({ verify: 'in_review', step: 'add_money' })
        expect(screen.getByText('In review')).toBeInTheDocument()
        expect(screen.queryByText(/A one-time ID check/)).not.toBeInTheDocument()
        expect(outlined('checklist-verify-identity')).toBe(false)
        expect(outlined('checklist-add-money')).toBe(true)
    })

    it('verify opens the ID check screen', () => {
        render()
        fireEvent.click(screen.getByText('Verify identity'))
        expect(mockPush).toHaveBeenCalledWith('/profile/accounts-and-payments')
    })

    it('Add money is tappable before verify and opens the Add drawer', () => {
        render()
        fireEvent.click(screen.getByText('Add money'))
        expect(mockSetHomeDrawer).toHaveBeenCalledWith('add')
    })

    it('money in before the ID check: Add money done, verify still outlined, 50%', () => {
        render({ addMoneyDone: true })
        expect(screen.getByTestId('checklist-add-money')).not.toHaveAttribute('role')
        expect(outlined('checklist-verify-identity')).toBe(true)
        expect(screen.getByText('50%')).toBeInTheDocument()
    })

    it('verified and funded: the first payment is outlined, 75%', () => {
        render({ verify: 'done', addMoneyDone: true, step: 'first_payment' })
        expect(outlined('checklist-first-payment')).toBe(true)
        expect(screen.getByText('75%')).toBeInTheDocument()
    })

    describe('first-payment row follows the route', () => {
        it('card and QR: both named, the tap opens the chooser', () => {
            render({ firstPaymentRoute: 'card_qr' })
            expect(screen.getByText('Get the Peanut Card or pay a QR')).toBeInTheDocument()
            fireEvent.click(screen.getByText('Make the first payment'))
            expect(screen.getByText('first-payment-chooser')).toBeInTheDocument()
        })

        it('qr: QR copy, the tap opens the scanner', () => {
            render({ firstPaymentRoute: 'qr' })
            expect(screen.getByText('Pay a QR code')).toBeInTheDocument()
            fireEvent.click(screen.getByText('Make the first payment'))
            expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
        })

        it('card only: card copy, the tap opens /card', () => {
            render({ firstPaymentRoute: 'card' })
            expect(screen.getByText('Get the Peanut Card')).toBeInTheDocument()
            fireEvent.click(screen.getByText('Make the first payment'))
            expect(mockPush).toHaveBeenCalledWith('/card')
        })

        it('none: no payment row — three rows, 100% once verified and funded', () => {
            render({ firstPaymentRoute: 'none', verify: 'done', addMoneyDone: true, step: 'completed' })
            expect(screen.getAllByTestId(/^checklist-/)).toHaveLength(3)
            expect(screen.queryByText('Make the first payment')).not.toBeInTheDocument()
            expect(screen.getByText('100%')).toBeInTheDocument()
        })
    })

    describe('add-money subtitle', () => {
        it('carries the KYC cost only while unverified', () => {
            render()
            expect(screen.getByText('Bank transfer or crypto · bank needs a one-time ID check')).toBeInTheDocument()
        })

        it('names both routes without the cost once verified', () => {
            render({ verify: 'done', step: 'add_money' })
            expect(screen.getByText('Bank transfer or crypto')).toBeInTheDocument()
        })

        it('promises the standing account once deposit accounts are live', () => {
            mockDepositAccounts = true
            render()
            expect(
                screen.getByText('Claim your own bank details. Get paid in euros, dollars and more.')
            ).toBeInTheDocument()
        })

        it('drops the bank half for a residence no bank provider onboards', () => {
            mockRestrictions = { banking: true, card: false }
            render()
            expect(screen.getByText('Crypto from any wallet or exchange')).toBeInTheDocument()
            expect(screen.queryByText(/Bank transfer/)).not.toBeInTheDocument()
        })

        it('wraps subtitles instead of truncating them', () => {
            render()
            const subtitle = screen.getByText('Bank transfer or crypto · bank needs a one-time ID check')
            expect(subtitle).toHaveClass('whitespace-normal', 'break-words')
        })
    })
})
