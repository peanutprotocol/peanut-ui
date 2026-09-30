/**
 * EnableAutoBalanceBanner — the Home prompt for managed card funding.
 *
 * An existing cardholder whose permission is missing gets today's centered,
 * non-dismissible modal: the plain description of the permission and ONE
 * explicit, unchecked authorization checkbox. Locked down here:
 *
 *  1. Continue is gated on that checkbox; consent is never implied, and a grant
 *     carries exactly what was ticked and the statement shown
 *  2. it shows only when the backend says the permission is missing or pending —
 *     never for ready, temporarily unavailable, an unknown state or an allowance
 *  3. a legacy user is told there are two confirmations; nobody else is
 *  4. a passkey that fails or is cancelled never traps the user (Skip for now),
 *     and skipping grants nothing and forgets nothing in flight
 *  5. a grant the backend accepted waits in the SAME dialog as the button's
 *     Working… state (no second, different dialog); only a stalled wait shows
 *     Check status, and nothing asks again
 *  6. success closes onto Home; the 2026-07-02 duplicate-card shape still keys
 *     off the ACTIVE card, never `cards[0]`, and errors never leak between cards
 *  7. no removal, revoke, pause or "Automatic card payments" control exists
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { RainFundingError } from '@/utils/rain-funding.utils'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

const AUTHORIZATION = 'I authorize transfers according to the Real-Time Funding Terms.'
type Status = 'required' | 'migration_required' | 'pending' | 'ready' | 'temporarily_unavailable' | undefined

const mockGrant = jest.fn()
const mockRecheck = jest.fn()
let mockStatus: Status
let mockRetired = false
let mockLastError: RainFundingError | null
let mockIsSubmitting: boolean
let mockStep: string
let mockFundingEnabledArg: boolean | undefined
jest.mock('@/constants/general.consts', () => ({
    ...jest.requireActual('@/constants/general.consts'),
    BASE_URL: 'https://peanut.mucu.dev',
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: ({ enabled }: { enabled?: boolean }) => {
        mockFundingEnabledArg = enabled
        return {
            funding: mockStatus
                ? {
                      permission: { authorizationText: AUTHORIZATION, termsVersion: 'rtf-2026-09-29' },
                      allowance: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
                  }
                : undefined,
            status: mockStatus,
            needsGrant:
                mockStatus === undefined
                    ? undefined
                    : (mockStatus === 'required' || mockStatus === 'migration_required') && !mockRetired,
            isMigration: mockStatus === 'migration_required',
            isPending: mockStatus === 'pending',
            grant: mockGrant,
            recheck: mockRecheck,
            isSubmitting: mockIsSubmitting,
            step: mockStep,
            lastError: mockLastError,
            isWithdrawalInFlight: mockInFlight,
        }
    },
}))

type MockCard = { id?: string; status: string; hasWithdrawApproval?: boolean }
let mockCards: MockCard[] = []
let mockSpendingPower: number | null = null
let mockBalanceUnavailable = false
let mockInFlight = false
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: {
            cards: mockCards,
            status: {},
            balance: mockSpendingPower === null ? null : { spendingPower: mockSpendingPower },
            balanceUnavailable: mockBalanceUnavailable,
        },
    }),
}))

jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: (props: {
        visible: boolean
        description?: string
        content?: React.ReactNode
        preventClose?: boolean
        hideModalCloseButton?: boolean
        ctas?: { text: string; onClick: () => void; disabled?: boolean }[]
        tertiaryCta?: { text: string; disabled?: boolean; onClick?: () => void }
    }) =>
        props.visible ? (
            <div data-testid="modal" data-prevent-close={String(!!props.preventClose)}>
                <p data-testid="description">{props.description}</p>
                {props.content}
                {props.ctas?.map((c) => (
                    <button key={c.text} onClick={c.onClick} disabled={c.disabled}>
                        {c.text}
                    </button>
                ))}
                {props.tertiaryCta && (
                    <button onClick={props.tertiaryCta.onClick} disabled={props.tertiaryCta.disabled}>
                        {props.tertiaryCta.text}
                    </button>
                )}
            </div>
        ) : null,
}))

import EnableAutoBalanceBanner from '../EnableAutoBalanceBanner'

const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[]
const tickBoth = () => boxes().forEach((box) => fireEvent.click(box))

beforeEach(() => {
    jest.clearAllMocks()
    mockStatus = 'required'
    mockRetired = false
    mockLastError = null
    mockIsSubmitting = false
    mockStep = 'idle'
    mockFundingEnabledArg = undefined
    mockGrant.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })
    mockRecheck.mockResolvedValue(undefined)
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: true }]
    mockSpendingPower = null
    mockBalanceUnavailable = false
    mockInFlight = false
})

describe('EnableAutoBalanceBanner — what is shown', () => {
    it('is today’s centered, non-dismissible Home modal with its own title and the plain permission text', () => {
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toHaveAttribute('data-prevent-close', 'true')
        expect(screen.getByTestId('description')).toHaveTextContent('One passkey tap to start using your card.')
        expect(
            screen.getByText(/Peanut manages how much our third party provider can take from your wallet/)
        ).toBeInTheDocument()
        expect(screen.getByText(/renews automatically, including for money you add later/)).toBeInTheDocument()
        expect(
            screen.getByText(/The permission stays in place. The amount it allows at any one time is limited./)
        ).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it('asks for the one authorization only, unchecked — no management box, never the old card checklist', () => {
        render(<EnableAutoBalanceBanner />)
        expect(boxes()).toHaveLength(1)
        expect(boxes()[0].checked).toBe(false)
        expect(screen.queryByTestId('funding-management-consent')).not.toBeInTheDocument()
        expect(screen.queryByText(/I agree that Peanut manages/)).not.toBeInTheDocument()
        expect(screen.getByTestId('funding-authorization-statement')).toHaveTextContent(AUTHORIZATION)
        expect(screen.queryByText(/E-Sign|Privacy|solicitation/i)).not.toBeInTheDocument()
    })

    it('never names the provider, offers removal, or names a feature', () => {
        render(<EnableAutoBalanceBanner />)
        expect(document.body.textContent).not.toMatch(/\bRain\b/)
        expect(document.body.textContent).not.toMatch(/automatic card payments|remove|revoke|pause|resume|emergency/i)
        expect(document.body.textContent).not.toMatch(/never sign|no one|total spend/i)
    })

    it.each<[Status]>([['ready'], ['temporarily_unavailable'], [undefined]])(
        'shows nothing when the backend state is %s — even with a large allowance',
        (status) => {
            mockStatus = status
            render(<EnableAutoBalanceBanner />)
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        }
    )

    it('shows no prompt for a retired permission: it needs internal support, not a prompt nobody can complete', () => {
        mockStatus = 'required'
        mockRetired = true
        render(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it.each<[string]>([['scope-retired'], ['unavailable']])(
        'a grant that ended as %s closes the prompt for good, with no Try again and no Skip',
        (kind) => {
            mockLastError = { kind } as RainFundingError
            render(<EnableAutoBalanceBanner />)
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        }
    )

    it('shows nothing without an ACTIVE card, and does not even read the funding state', () => {
        mockCards = [{ id: 'card-x', status: 'CANCELED' }]
        render(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(false)
    })

    it('keys off the ACTIVE card, not cards[0] — a CANCELED newest row does not drive the modal', () => {
        mockCards = [
            { id: 'card-dup', status: 'CANCELED' },
            { id: 'card-real', status: 'ACTIVE' },
        ]
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(true)
    })
})

describe('EnableAutoBalanceBanner — consent gates Continue', () => {
    it('keeps Continue off until the authorization is ticked, and off again if it is cleared', () => {
        render(<EnableAutoBalanceBanner />)
        const cont = screen.getByRole('button', { name: 'Continue' })
        expect(cont).toBeDisabled()
        fireEvent.click(boxes()[0])
        expect(cont).toBeEnabled()
        fireEvent.click(boxes()[0])
        expect(cont).toBeDisabled()
    })

    it('does nothing when Continue is pressed without consent', () => {
        render(<EnableAutoBalanceBanner />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('grants with exactly what was ticked and the statement shown', async () => {
        render(<EnableAutoBalanceBanner />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(mockGrant).toHaveBeenCalledWith({
            authorizationAccepted: true,
            authorizationText: AUTHORIZATION,
        })
    })

    it('links the terms to the public page without ticking the box, and shows no draft placeholder', () => {
        render(<EnableAutoBalanceBanner />)
        const link = screen.getByRole('link', { name: 'Real-Time Funding Terms' })
        expect(link).toHaveAttribute('href', 'https://peanut.mucu.dev/en/real-time-funding-terms')
        expect(link).toHaveAttribute('target', '_blank')
        fireEvent.click(link)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
        expect(document.body.textContent).not.toMatch(/draft|rtf-sandbox/i)
    })

    it('unticks everything when the terms changed under the person', () => {
        const { rerender } = render(<EnableAutoBalanceBanner />)
        tickBoth()
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
        mockLastError = { kind: 'terms-changed' }
        rerender(<EnableAutoBalanceBanner />)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(screen.getByRole('button', { name: /Continue|Try again/ })).toBeDisabled()
        expect(screen.getByTestId('description')).toHaveTextContent(/terms changed/i)
    })
})

describe('EnableAutoBalanceBanner — one confirmation or two', () => {
    it('does not promise one tap to a legacy user: it says there are two confirmations', () => {
        mockStatus = 'migration_required'
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('description')).toHaveTextContent(/confirm twice with your passkey/i)
        expect(screen.getByTestId('description')).not.toHaveTextContent('One passkey tap')
    })

    it('names the first confirmation while the old permission is being updated', () => {
        mockStatus = 'migration_required'
        mockIsSubmitting = true
        mockStep = 'updating-permission'
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Confirm the card permission update' })).toBeDisabled()
    })

    it('shows Working… during the new permission and keeps the button off', () => {
        mockIsSubmitting = true
        mockStep = 'signing'
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })
})

describe('EnableAutoBalanceBanner — card balance moves back first', () => {
    const description = () => screen.getByTestId('description')

    it.each<[Status]>([['required'], ['migration_required']])(
        '%s: names the amount and more than one confirmation, with no exact count, in one dialog',
        (status) => {
            mockSpendingPower = 1_234.7
            mockStatus = status
            render(<EnableAutoBalanceBanner />)
            expect(description()).toHaveTextContent(
                'First, $12.34 of card balance moves back to your wallet. This may take more than one passkey confirmation.'
            )
            expect(description()).not.toHaveTextContent(/One passkey tap|twice|\d+ times/)
            expect(boxes()).toHaveLength(1)
            expect(screen.getAllByTestId('modal')).toHaveLength(1)
        }
    )

    it.each([
        ['zero', 0, false],
        ['sub-cent dust', 0.4, false],
        ['a cached figure', 5_000, true],
    ])('%s adds no return to the copy', (_label, spendingPower, unavailable) => {
        mockSpendingPower = spendingPower
        mockBalanceUnavailable = unavailable
        render(<EnableAutoBalanceBanner />)
        expect(description()).toHaveTextContent('One passkey tap to start using your card.')
    })

    it('shows the return as the button state while it runs', () => {
        mockSpendingPower = 500
        mockIsSubmitting = true
        mockStep = 'returning-balance'
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Moving card balance…' })).toBeDisabled()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it.each([
        ['return-pending', /not confirmed yet/],
        ['return-wait', /cannot move right now/],
        ['balance-unavailable', /couldn't read your card balance/i],
        ['return-failed', /couldn't finish setting up your card/],
    ])('a %s stop explains it and offers Try again and Skip for now in the same dialog', (kind, text) => {
        mockSpendingPower = 500
        mockLastError = { kind } as RainFundingError
        render(<EnableAutoBalanceBanner />)
        expect(description()).toHaveTextContent(text)
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(screen.getAllByTestId('modal')).toHaveLength(1)
    })

    describe('a card withdrawal still confirming', () => {
        afterEach(() => jest.useRealTimers())

        it('keeps the same dialog as a wait, never as done, then offers Check status and Skip', () => {
            jest.useFakeTimers()
            mockStatus = 'temporarily_unavailable'
            mockInFlight = true
            render(<EnableAutoBalanceBanner />)
            expect(screen.getByTestId('modal')).toBeInTheDocument()
            expect(description()).toHaveTextContent('A card withdrawal is still confirming.')
            expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
            expect(boxes()).toHaveLength(1)

            act(() => void jest.advanceTimersByTime(60_001))
            expect(description()).toHaveTextContent('A card withdrawal is still confirming.')
            expect(description()).not.toHaveTextContent(/do not approve twice/i)
            expect(screen.getByRole('button', { name: 'Check status' })).toBeInTheDocument()
            expect(screen.getByText('Skip for now')).toBeInTheDocument()
            expect(mockGrant).not.toHaveBeenCalled()
        })

        it('once it settles, the normal prompt returns with no error copy', () => {
            mockStatus = 'migration_required'
            mockLastError = { kind: 'withdrawal-in-flight' }
            render(<EnableAutoBalanceBanner />)
            expect(description()).toHaveTextContent(/confirm twice with your passkey/i)
            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
            expect(screen.getByText('Skip for now')).toBeInTheDocument()
        })
    })

    it('skipping after a stopped return grants nothing', () => {
        mockSpendingPower = 500
        mockLastError = { kind: 'return-pending' }
        render(<EnableAutoBalanceBanner />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })
})

describe('EnableAutoBalanceBanner — cancel, failure and skip', () => {
    it('after a cancelled passkey, offers Skip for now and keeps the normal copy', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(screen.getByTestId('description')).toHaveTextContent('One passkey tap')
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    })

    it('after a hard failure, explains it, says Try again, and offers Skip for now', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    it('Skip for now closes the modal without granting anything', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<EnableAutoBalanceBanner />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('a skipped prompt comes back on the next Home visit', () => {
        mockLastError = { kind: 'user-cancelled' }
        const first = render(<EnableAutoBalanceBanner />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        first.unmount()

        mockLastError = null
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('cannot be skipped while a grant is running', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        mockIsSubmitting = true
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByText('Skip for now')).toBeDisabled()
    })

    it('a failure on one card never leaks error copy or the escape into a re-issued card', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'unexpected', message: 'boom' } })
        mockCards = [{ id: 'card-a', status: 'ACTIVE' }]
        const { rerender } = render(<EnableAutoBalanceBanner />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
        expect(screen.queryByText('Try again')).not.toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
        // consent is per card: the new card starts unticked
        expect(boxes().every((box) => !box.checked)).toBe(true)
    })

    it('skipping a stuck card does not suppress the prompt for a different card later', () => {
        mockLastError = { kind: 'user-cancelled' }
        mockCards = [{ id: 'card-a', status: 'ACTIVE' }]
        const { rerender } = render(<EnableAutoBalanceBanner />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
})

describe('EnableAutoBalanceBanner — pending and success', () => {
    afterEach(() => jest.useRealTimers())
    const stall = () => act(() => void jest.advanceTimersByTime(60_001))

    it('while the backend confirms a grant, the wait stays in this dialog as a disabled Working… button — no second view, no re-grant', () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        render(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
        expect(screen.getByTestId('description')).toHaveTextContent('One passkey tap')
        expect(screen.queryByText('Check status')).not.toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
        expect(screen.queryByText(/not confirmed yet/i)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Working…' }))
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('waits on a stalled grant: Check status and Skip, no boxes, no second grant', async () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        render(<EnableAutoBalanceBanner />)
        stall()
        expect(screen.getByTestId('description')).toHaveTextContent(/not confirmed yet/i)
        expect(screen.getByTestId('description')).toHaveTextContent(/do not approve twice/i)
        expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
        expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Check status' }))
        })
        expect(mockRecheck).toHaveBeenCalledTimes(1)
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('a different card that is pending gets its own fresh wait, not the earlier card’s expired one', () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        mockCards = [{ id: 'card-a', status: 'ACTIVE' }]
        const { rerender } = render(<EnableAutoBalanceBanner />)
        stall()
        expect(screen.getByRole('button', { name: 'Check status' })).toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
        expect(screen.queryByText('Check status')).not.toBeInTheDocument()
    })

    it('skipping a stalled grant closes the modal and grants or claims nothing', () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        render(<EnableAutoBalanceBanner />)
        stall()
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('a pending grant that becomes ready closes onto Home with no success screen', () => {
        mockStatus = 'pending'
        const { rerender } = render(<EnableAutoBalanceBanner />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        mockStatus = 'ready'
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(document.body.textContent).toBe('')
    })

    it('a grant that succeeds closes the modal once the backend reports ready', async () => {
        mockGrant.mockImplementation(async () => {
            mockStatus = 'ready'
            return { ok: true, status: 'ready' }
        })
        const { rerender } = render(<EnableAutoBalanceBanner />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        rerender(<EnableAutoBalanceBanner />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
})
