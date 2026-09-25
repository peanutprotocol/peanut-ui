/** @jest-environment jsdom */
/**
 * GettingStartedChecklist — the Home onboarding checklist (TASK-23054).
 *
 * Contract: four rows — Create account ✓ · Verify identity · Add money · Make
 * the first payment. Every open row stays tappable in any order; the first
 * row has the same border (no highlight on the next step); an ID check in
 * review says so. The first-payment row follows the one route
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

const mockOnHide = jest.fn()
const render = (onboarding: Partial<OnboardingState> = {}) =>
    rtlRender(
        <NuqsTestingAdapter searchParams="?returnTo=%2Fprofile">
            <GettingStartedChecklist onboarding={{ ...NEW_USER, ...onboarding }} onHide={mockOnHide} />
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
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))

// the standing-accounts flag rewrites the add-money subtitle; off by default
let mockDepositAccounts = false
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockDepositAccounts,
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

// the mascot is a lottie animation; here it is a marker
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <span data-testid="mascot" />,
}))

// the chooser is its own component; here it is a marker that says whether it is open
jest.mock('@/components/Home/FirstPaymentChooser', () => ({
    __esModule: true,
    default: ({ open }: { open: boolean }) => (open ? <div>first-payment-chooser</div> : null),
}))

describe('GettingStartedChecklist', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRestrictions = { banking: false, card: false }
        mockDepositAccounts = false
    })

    it('renders four rows, account pre-checked, 1 of 4 done for a new user', () => {
        render()
        expect(screen.getAllByTestId(/^checklist-/)).toHaveLength(4)
        expect(screen.getByText('Create account')).toBeInTheDocument()
        expect(screen.getByText('Verify identity')).toBeInTheDocument()
        expect(screen.getByText('Add money')).toBeInTheDocument()
        expect(screen.getByText('First payment')).toBeInTheDocument()
        expect(screen.getByText('1 of 4 done')).toBeInTheDocument()
        // the three open rows are tappable; the done account row is not
        expect(screen.getAllByRole('button')).toHaveLength(3)
    })

    it('every row has the same border: no highlight on the next step', () => {
        render({ verify: 'in_review', addMoneyDone: false, step: 'add_money' })
        for (const row of screen.getAllByTestId(/^checklist-/)) {
            // focus-visible outlines are the focus state, not a highlight
            expect(row.className).not.toMatch(/(^|\s)(outline-2|outline-action-primary|border-action-primary)/)
            expect(row).toHaveClass('border-border-default')
        }
    })

    it('an ID check in review says so on its subtitle line', () => {
        render({ verify: 'in_review', step: 'add_money' })
        expect(screen.getByText('In review')).toBeInTheDocument()
        expect(screen.queryByText('One-time ID check')).not.toBeInTheDocument()
    })

    it('verify opens the ID check screen', () => {
        render()
        fireEvent.click(screen.getByText('Verify identity'))
        expect(mockPush).toHaveBeenCalledWith('/profile/accounts')
    })

    it('Add money is tappable before verify and opens the Add drawer', () => {
        render()
        fireEvent.click(screen.getByText('Add money'))
        expect(mockSetHomeDrawer).toHaveBeenCalledWith('add')
    })

    it('money in before the ID check: Add money done, verify still open, 2 of 4', () => {
        render({ addMoneyDone: true })
        expect(screen.getByTestId('checklist-add-money')).not.toHaveAttribute('role')
        expect(screen.getByText('2 of 4 done')).toBeInTheDocument()
    })

    it('verified and funded: the first payment is the one open row, 3 of 4', () => {
        render({ verify: 'done', addMoneyDone: true, step: 'first_payment' })
        expect(screen.getByText('3 of 4 done')).toBeInTheDocument()
    })

    describe('first-payment row follows the route', () => {
        it('card and QR: both named, the tap opens the chooser', () => {
            render({ firstPaymentRoute: 'card_qr' })
            expect(screen.getByText('Get the card or pay a QR')).toBeInTheDocument()
            fireEvent.click(screen.getByText('First payment'))
            expect(screen.getByText('first-payment-chooser')).toBeInTheDocument()
        })

        it('qr: QR copy, the tap opens the scanner', () => {
            render({ firstPaymentRoute: 'qr' })
            expect(screen.getByText('Pay a QR code')).toBeInTheDocument()
            fireEvent.click(screen.getByText('First payment'))
            expect(mockSetIsQRScannerOpen).toHaveBeenCalledWith(true)
        })

        it('a held card (issued or applied for) says pay with it, never get it again', () => {
            render({ firstPaymentRoute: 'card', cardHeld: true })
            expect(screen.getByText('Pay with the card')).toBeInTheDocument()
            fireEvent.click(screen.getByText('First payment'))
            expect(mockPush).toHaveBeenCalledWith('/card')
        })

        it('switches copy when the card becomes held (application submitted mid-session)', () => {
            const onboarding = { ...NEW_USER, firstPaymentRoute: 'card' as const, cardHeld: false }
            const view = rtlRender(
                <NuqsTestingAdapter>
                    <GettingStartedChecklist onboarding={onboarding} onHide={mockOnHide} />
                </NuqsTestingAdapter>,
                { wrapper: IntlWrapper }
            )
            expect(screen.getByText('Get the Peanut Card')).toBeInTheDocument()
            view.rerender(
                <NuqsTestingAdapter>
                    <GettingStartedChecklist onboarding={{ ...onboarding, cardHeld: true }} onHide={mockOnHide} />
                </NuqsTestingAdapter>
            )
            expect(screen.getByText('Pay with the card')).toBeInTheDocument()
            expect(screen.queryByText('Get the Peanut Card')).not.toBeInTheDocument()
        })

        it('a held card with QR open', () => {
            render({ firstPaymentRoute: 'card_qr', cardHeld: true })
            expect(screen.getByText('Pay with the card or a QR')).toBeInTheDocument()
        })

        it('card only: card copy, the tap opens /card', () => {
            render({ firstPaymentRoute: 'card' })
            expect(screen.getByText('Get the Peanut Card')).toBeInTheDocument()
            fireEvent.click(screen.getByText('First payment'))
            expect(mockPush).toHaveBeenCalledWith('/card')
        })

        it('none: no payment row — 3 of 3 done once verified and funded, one done row shown', () => {
            render({ firstPaymentRoute: 'none', verify: 'done', addMoneyDone: true, step: 'completed' })
            expect(screen.getAllByTestId(/^checklist-/)).toHaveLength(1)
            expect(screen.queryByText('First payment')).not.toBeInTheDocument()
            expect(screen.getByText('3 of 3 done')).toBeInTheDocument()
        })
    })

    it('pending card eligibility: the payment row holds its place with a placeholder and no tap', () => {
        render({ verify: 'done', addMoneyDone: true, firstPaymentRoute: 'pending', step: 'first_payment' })
        const row = screen.getByTestId('checklist-first-payment')
        expect(row).not.toHaveAttribute('role')
        expect(row.querySelector('.animate-pulse')).not.toBeNull()
        expect(screen.getByText('3 of 4 done')).toBeInTheDocument()
    })

    describe('every row is one height: title plus one subtitle line, in every state', () => {
        const states: Array<[string, Partial<OnboardingState>]> = [
            ['new user', {}],
            ['in review', { verify: 'in_review', step: 'add_money' }],
            ['verified and funded', { verify: 'done', addMoneyDone: true, step: 'first_payment' }],
            ['pending card', { verify: 'done', addMoneyDone: true, firstPaymentRoute: 'pending' }],
        ]
        it.each(states)('%s', (_label, onboarding) => {
            render(onboarding)
            for (const row of screen.getAllByTestId(/^checklist-/)) {
                const lines = row.querySelectorAll('span.text-body-m-semibold, span.text-body-s, .animate-pulse')
                // one title line, one subtitle line (text or placeholder)
                expect(lines).toHaveLength(2)
                for (const line of row.querySelectorAll('span.text-body-m-semibold, span.text-body-s')) {
                    expect(line).toHaveClass('truncate')
                }
            }
        })

        it('done rows keep a subtitle', () => {
            render()
            expect(screen.getByText('Username ready')).toBeInTheDocument()
            render({ verify: 'done', step: 'add_money' })
            expect(screen.getByText('ID verified')).toBeInTheDocument()
            render({ verify: 'done', addMoneyDone: true, step: 'first_payment' })
            expect(screen.getByText('Money received')).toBeInTheDocument()
        })

        it('the in-review row says so on its subtitle line', () => {
            render({ verify: 'in_review', step: 'add_money' })
            expect(screen.getByText('In review')).toBeInTheDocument()
        })
    })

    describe('add-money subtitle', () => {
        it('names both routes', () => {
            render()
            expect(screen.getByText('Bank transfer or crypto')).toBeInTheDocument()
        })

        it('names the standing account once deposit accounts are live', () => {
            mockDepositAccounts = true
            render()
            expect(screen.getByText('Bank details or crypto')).toBeInTheDocument()
        })

        it('drops the bank half for a residence no bank provider onboards', () => {
            mockRestrictions = { banking: true, card: false }
            render()
            expect(screen.getByText('Crypto from any wallet')).toBeInTheDocument()
            expect(screen.queryByText(/Bank/)).not.toBeInTheDocument()
        })
    })
})

describe('GettingStartedChecklist — Hide', () => {
    beforeEach(() => jest.clearAllMocks())

    it('shows once only the payment row is left, and hides on tap with an event', () => {
        render({ verify: 'done', addMoneyDone: true, step: 'first_payment' })
        fireEvent.click(screen.getByText('Hide'))
        expect(mockOnHide).toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith('home_checklist_hidden', { first_payment_route: 'card_qr' })
    })

    it.each<[string, Partial<OnboardingState>]>([
        ['before verify', { addMoneyDone: true }],
        ['before Add money', { verify: 'done', step: 'add_money' }],
        ['while the ID check is in review', { verify: 'in_review', addMoneyDone: true, step: 'first_payment' }],
    ])('never %s', (_label, onboarding) => {
        render(onboarding)
        expect(screen.queryByText('Hide')).not.toBeInTheDocument()
    })
})

describe('GettingStartedChecklist — welcome card and one done row', () => {
    it('welcomes with the real step count and the progress', () => {
        render()
        // visible title (hidden from screen readers) plus its spoken form
        expect(screen.getAllByText('Welcome to Peanut!')).toHaveLength(2)
        expect(screen.getByText('4 quick steps to pay, send and receive')).toBeInTheDocument()
        expect(screen.getByText('1 of 4 done')).toBeInTheDocument()
    })

    it('says three steps when there is no payment row', () => {
        render({ firstPaymentRoute: 'none' })
        expect(screen.getByText('3 quick steps to pay, send and receive')).toBeInTheDocument()
        expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    })

    it('shows only the latest done row, and every open row in order', () => {
        render({ verify: 'done', addMoneyDone: true, step: 'first_payment' })
        const ids = screen.getAllByTestId(/^checklist-/).map((row) => row.getAttribute('data-testid'))
        expect(ids).toEqual(['checklist-add-money', 'checklist-first-payment'])
    })

    it('a done row after an open one: the open row stays, the latest done one shows', () => {
        render({ addMoneyDone: true })
        const ids = screen.getAllByTestId(/^checklist-/).map((row) => row.getAttribute('data-testid'))
        expect(ids).toEqual(['checklist-verify-identity', 'checklist-add-money', 'checklist-first-payment'])
    })
})
