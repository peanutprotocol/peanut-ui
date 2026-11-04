/**
 * FundingSetupPrompt — the Home prompt for managed card funding.
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
const mockContinueSetup = jest.fn()
let mockOwesReturn = false
let mockReturnError: RainFundingError | null = null
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
            owesReturn: mockOwesReturn,
            returnError: mockReturnError,
            continueSetup: mockContinueSetup,
        }
    },
}))

// The server's funding decision; undefined is an unread or failed decision.
let mockAccess: { fundingMode: 'legacy' | 'managed'; enrollmentAllowed: boolean } | undefined
jest.mock('@/hooks/useCardFundingAccess', () => {
    const { fundingSetupPath } = jest.requireActual('@/utils/rain-funding.utils')
    return {
        useCardFundingAccess: () => ({ access: mockAccess, setupPath: fundingSetupPath(mockAccess) }),
    }
})

type MockCard = { id?: string; status: string; hasWithdrawApproval?: boolean; hasStoredWithdrawApproval?: boolean }
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
        title?: React.ReactNode
        description?: React.ReactNode
        content?: React.ReactNode
        preventClose?: boolean
        hideModalCloseButton?: boolean
        ctas?: { text: string; onClick: () => void; disabled?: boolean }[]
        tertiaryCta?: { text: string; disabled?: boolean; onClick?: () => void }
    }) =>
        props.visible ? (
            <div data-testid="modal" data-prevent-close={String(!!props.preventClose)}>
                <h3>{props.title}</h3>
                <div data-testid="description">{props.description}</div>
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

import FundingSetupPrompt from '../FundingSetupPrompt'
import { getFundingPromptHold, resetFundingPromptHoldsForTests } from '@/features/attention/cardFunding'

const onActed = jest.fn()
const onDismissed = jest.fn()
const onSnoozed = jest.fn()
const surfaceProps = {
    presentation: 'modal',
    askId: 'finish-card-funding',
    onActed,
    onDismissed,
    onSnoozed,
} as const

const boxes = () => screen.getAllByRole('checkbox') as HTMLInputElement[]
const tickBoth = () => boxes().forEach((box) => fireEvent.click(box))

beforeEach(() => {
    jest.clearAllMocks()
    resetFundingPromptHoldsForTests()
    mockStatus = 'required'
    mockRetired = false
    mockLastError = null
    mockIsSubmitting = false
    mockStep = 'idle'
    mockFundingEnabledArg = undefined
    mockGrant.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })
    mockRecheck.mockResolvedValue(undefined)
    mockContinueSetup.mockResolvedValue({ ok: true, status: 'ready' })
    mockOwesReturn = false
    mockReturnError = null
    mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: false }]
    mockSpendingPower = null
    mockBalanceUnavailable = false
    mockInFlight = false
    mockAccess = { fundingMode: 'managed', enrollmentAllowed: true }
})

// Which prompt an account gets is the server's decision, never this client's.
describe('FundingSetupPrompt — the funding decision', () => {
    it('an account on the existing permission that managed funding is not open to gets nothing here', () => {
        mockAccess = { fundingMode: 'legacy', enrollmentAllowed: false }
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(false)
    })

    it('an unread or failed decision shows nothing and reads no funding state', () => {
        mockAccess = undefined
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(false)
    })

    it('a managed account keeps its setup even after new enrollment closed', () => {
        mockAccess = { fundingMode: 'managed', enrollmentAllowed: false }
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(true)
    })

    it('a managed account waiting on confirmation keeps the wait after new enrollment closed', () => {
        mockAccess = { fundingMode: 'managed', enrollmentAllowed: false }
        mockStatus = 'pending'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('an account open to managed funding is offered setup before it has accepted', () => {
        mockAccess = { fundingMode: 'legacy', enrollmentAllowed: true }
        // before acceptance the server reports the funding state as not yet available
        mockStatus = 'temporarily_unavailable'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(true)
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
    })

    it('a refused enrollment ends the prompt', () => {
        mockAccess = { fundingMode: 'legacy', enrollmentAllowed: true }
        mockStatus = 'temporarily_unavailable'
        mockLastError = { kind: 'enrollment-not-allowed' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
})

describe('FundingSetupPrompt — what is shown', () => {
    it('is today’s centered, non-dismissible Home modal with its own title and the plain permission text', () => {
        render(<FundingSetupPrompt {...surfaceProps} />)
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
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(boxes()).toHaveLength(1)
        expect(boxes()[0].checked).toBe(false)
        expect(screen.queryByTestId('funding-management-consent')).not.toBeInTheDocument()
        expect(screen.queryByText(/I agree that Peanut manages/)).not.toBeInTheDocument()
        expect(screen.getByTestId('funding-authorization-statement')).toHaveTextContent(AUTHORIZATION)
        expect(screen.queryByText(/E-Sign|Privacy|solicitation/i)).not.toBeInTheDocument()
    })

    it('never names the provider, offers removal, or names a feature', () => {
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(document.body.textContent).not.toMatch(/\bRain\b/)
        expect(document.body.textContent).not.toMatch(/automatic card payments|remove|revoke|pause|resume|emergency/i)
        expect(document.body.textContent).not.toMatch(/never sign|no one|total spend/i)
    })

    it.each<[Status]>([['ready'], ['temporarily_unavailable'], [undefined]])(
        'shows nothing when the backend state is %s — even with a large allowance',
        (status) => {
            mockStatus = status
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        }
    )

    it('shows no prompt for a retired permission: it needs internal support, not a prompt nobody can complete', () => {
        mockStatus = 'required'
        mockRetired = true
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })

    it.each<[string]>([['scope-retired'], ['unavailable']])(
        'a grant that ended as %s closes the prompt for good, with no Try again and no Skip',
        (kind) => {
            mockLastError = { kind } as RainFundingError
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        }
    )

    it('shows nothing without an ACTIVE card, and does not even read the funding state', () => {
        mockCards = [{ id: 'card-x', status: 'CANCELED' }]
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(false)
    })

    it('keys off the ACTIVE card, not cards[0] — a CANCELED newest row does not drive the modal', () => {
        mockCards = [
            { id: 'card-dup', status: 'CANCELED' },
            { id: 'card-real', status: 'ACTIVE' },
        ]
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        expect(mockFundingEnabledArg).toBe(true)
    })
})

describe('FundingSetupPrompt — consent gates Continue', () => {
    it('keeps Continue off until the authorization is ticked, and off again if it is cleared', () => {
        render(<FundingSetupPrompt {...surfaceProps} />)
        const cont = screen.getByRole('button', { name: 'Continue' })
        expect(cont).toBeDisabled()
        fireEvent.click(boxes()[0])
        expect(cont).toBeEnabled()
        fireEvent.click(boxes()[0])
        expect(cont).toBeDisabled()
    })

    it('does nothing when Continue is pressed without consent', () => {
        render(<FundingSetupPrompt {...surfaceProps} />)
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('grants with exactly what was ticked and the statement shown', async () => {
        render(<FundingSetupPrompt {...surfaceProps} />)
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
        render(<FundingSetupPrompt {...surfaceProps} />)
        const link = screen.getByRole('link', { name: 'Real-Time Funding Terms' })
        expect(link).toHaveAttribute('href', 'https://peanut.mucu.dev/en/real-time-funding-terms')
        expect(link).toHaveAttribute('target', '_blank')
        fireEvent.click(link)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
        expect(document.body.textContent).not.toMatch(/draft|rtf-sandbox/i)
    })

    it('unticks everything when the terms changed under the person', () => {
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        tickBoth()
        expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled()
        mockLastError = { kind: 'terms-changed' }
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(boxes().every((box) => !box.checked)).toBe(true)
        expect(screen.getByRole('button', { name: /Continue|Try again/ })).toBeDisabled()
        expect(screen.getByTestId('description')).toHaveTextContent(/terms changed/i)
    })
})

describe('FundingSetupPrompt — one confirmation or two', () => {
    it('shows the approved update copy for enrollment without a return paragraph at zero balance', () => {
        mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: true }]
        mockAccess = { fundingMode: 'legacy', enrollmentAllowed: true }
        mockStatus = 'temporarily_unavailable'
        mockSpendingPower = 0
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('description')).toHaveTextContent('Approve the update with your passkey.')
        expect(screen.getByTestId('description')).not.toHaveTextContent('will return to your wallet')
    })
    it('explains the update and asks for a passkey without promising a number of confirmations', () => {
        mockStatus = 'migration_required'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByText('Card payments update')).toBeInTheDocument()
        expect(screen.queryByText(/Peanut manages how much our third party provider/)).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Real-Time Funding Terms' })).toBeInTheDocument()
        expect(screen.getByTestId('description')).toHaveTextContent(
            'We’re changing how the card payments are processed. From now on, your card will pay directly from your Peanut balance.'
        )
        expect(screen.getByTestId('description')).toHaveTextContent('Approve the update with your passkey.')
        expect(screen.getByTestId('description')).not.toHaveTextContent('One passkey tap')
    })

    it('keeps the initial setup title for a new managed permission', () => {
        mockStatus = 'required'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByText('Finish setting up the card')).toBeInTheDocument()
    })

    it('names the first confirmation while the old permission is being updated', () => {
        mockStatus = 'migration_required'
        mockIsSubmitting = true
        mockStep = 'updating-permission'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Confirm the card permission update' })).toBeDisabled()
    })

    it('shows Working… during the new permission and keeps the button off', () => {
        mockIsSubmitting = true
        mockStep = 'signing'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })
})

describe('FundingSetupPrompt — card balance moves back after setup is confirmed', () => {
    const description = () => screen.getByTestId('description')

    it.each<[Status]>([['required'], ['migration_required']])(
        '%s: card balance makes it an update that names the amount, with no exact count, in one dialog',
        (status) => {
            mockSpendingPower = 1_234.7
            mockStatus = status
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(screen.getByText('Card payments update')).toBeInTheDocument()
            expect(description()).toHaveTextContent(
                'Once the update is confirmed, $12.34 on your card will return to your wallet.'
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
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(description()).toHaveTextContent('One passkey tap to start using your card.')
    })

    it('shows the return as the button state while it runs', () => {
        mockSpendingPower = 500
        mockIsSubmitting = true
        mockStep = 'returning-balance'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Moving card balance…' })).toBeDisabled()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
    })

    it.each([
        ['return-pending', /not confirmed yet/],
        ['return-wait', /cannot move right now/],
        ['balance-unavailable', /couldn't read your card balance/i],
        ['return-failed', /couldn't finish the update/],
    ])('a %s stop explains it and offers Try again and Skip for now in the same dialog', (kind, text) => {
        mockSpendingPower = 500
        mockLastError = { kind } as RainFundingError
        render(<FundingSetupPrompt {...surfaceProps} />)
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
            render(<FundingSetupPrompt {...surfaceProps} />)
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
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(description()).toHaveTextContent('Approve the update with your passkey.')
            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
            expect(screen.getByText('Skip for now')).toBeInTheDocument()
        })
    })

    it('skipping after a stopped return grants nothing', () => {
        mockSpendingPower = 500
        mockLastError = { kind: 'return-pending' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })

    describe('funding is ready and this setup still owes the move', () => {
        beforeEach(() => {
            mockStatus = 'ready'
            mockOwesReturn = true
            mockSpendingPower = 500
        })

        it('stays open with one explicit move step: no consent box, no new grant', async () => {
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(description()).toHaveTextContent(
                'The update is done. Move $5.00 of card balance to your wallet now, or later from the card screen.'
            )
            expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
            expect(screen.getByText('Skip for now')).toBeInTheDocument()
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Move card balance to wallet' }))
            })
            expect(mockContinueSetup).toHaveBeenCalledTimes(1)
            expect(mockGrant).not.toHaveBeenCalled()
        })

        it('shows the move as the button state while it runs', () => {
            mockIsSubmitting = true
            mockStep = 'returning-balance'
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(screen.getByRole('button', { name: 'Moving card balance…' })).toBeDisabled()
        })

        it.each([
            ['return-failed', /the update is done, but moving your card balance didn't finish/i],
            ['return-pending', /not confirmed yet/],
            ['return-wait', /cannot move right now/],
            ['balance-unavailable', /couldn't read your card balance/i],
        ])('a %s move explains it and offers Try again (no new grant) and Skip', async (kind, text) => {
            mockReturnError = { kind } as RainFundingError
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(description()).toHaveTextContent(text)
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
            })
            expect(mockContinueSetup).toHaveBeenCalledTimes(1)
            expect(mockGrant).not.toHaveBeenCalled()
            expect(screen.getByText('Skip for now')).toBeInTheDocument()
        })

        it('a cancelled move simply offers the move again', () => {
            mockReturnError = { kind: 'user-cancelled' }
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(description()).toHaveTextContent(/^The update is done\. Move \$5\.00/)
            expect(screen.getByRole('button', { name: 'Move card balance to wallet' })).toBeEnabled()
        })

        it('Skip for now closes without moving or granting', () => {
            render(<FundingSetupPrompt {...surfaceProps} />)
            fireEvent.click(screen.getByText('Skip for now'))
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
            expect(mockContinueSetup).not.toHaveBeenCalled()
            expect(mockGrant).not.toHaveBeenCalled()
        })

        it('with no card balance to move there is no extra step', () => {
            mockSpendingPower = 0
            render(<FundingSetupPrompt {...surfaceProps} />)
            expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        })
    })

    it('a ready state this session did not set up never prompts a move, even with card balance', () => {
        mockStatus = 'ready'
        mockSpendingPower = 500
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockContinueSetup).not.toHaveBeenCalled()
    })

    it('an owed move is never offered before the backend reports ready', () => {
        mockStatus = 'pending'
        mockOwesReturn = true
        mockSpendingPower = 500
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByRole('button', { name: 'Move card balance to wallet' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
    })
})

describe('FundingSetupPrompt — cancel, failure and skip', () => {
    it('after a cancelled passkey, offers Skip for now and keeps the normal copy', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
        expect(screen.getByTestId('description')).toHaveTextContent('One passkey tap')
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    })

    it('after a hard failure, explains it, says Try again, and offers Skip for now', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByText(/couldn't finish setting up your card/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.getByText('Skip for now')).toBeInTheDocument()
    })

    it('Skip for now closes the modal without granting anything', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('a remounted prompt starts fresh (the manager brings it back once the snooze ends)', () => {
        mockLastError = { kind: 'user-cancelled' }
        const first = render(<FundingSetupPrompt {...surfaceProps} />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        first.unmount()

        mockLastError = null
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    it('cannot be skipped while a grant is running', () => {
        mockLastError = { kind: 'unexpected', message: 'boom' }
        mockIsSubmitting = true
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByText('Skip for now')).toBeDisabled()
    })

    it('a failure on one card never leaks error copy or the escape into a re-issued card', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'unexpected', message: 'boom' } })
        mockCards = [{ id: 'card-a', status: 'ACTIVE' }]
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
        expect(screen.queryByText('Try again')).not.toBeInTheDocument()
        expect(screen.queryByText('Skip for now')).not.toBeInTheDocument()
        // consent is per card: the new card starts unticked
        expect(boxes().every((box) => !box.checked)).toBe(true)
    })

    it('skipping a stuck card does not suppress the prompt for a different card later', () => {
        mockLastError = { kind: 'user-cancelled' }
        mockCards = [{ id: 'card-a', status: 'ACTIVE' }]
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
    })
})

describe('FundingSetupPrompt — pending and success', () => {
    afterEach(() => jest.useRealTimers())
    const stall = () => act(() => void jest.advanceTimersByTime(60_001))

    it('while the backend confirms a grant, the wait stays in this dialog as a disabled Working… button — no second view, no re-grant', () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        render(<FundingSetupPrompt {...surfaceProps} />)
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
        render(<FundingSetupPrompt {...surfaceProps} />)
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
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        stall()
        expect(screen.getByRole('button', { name: 'Check status' })).toBeInTheDocument()

        mockCards = [
            { id: 'card-a', status: 'CANCELED' },
            { id: 'card-b', status: 'ACTIVE' },
        ]
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled()
        expect(screen.queryByText('Check status')).not.toBeInTheDocument()
    })

    it('skipping a stalled grant closes the modal and grants or claims nothing', () => {
        jest.useFakeTimers()
        mockStatus = 'pending'
        render(<FundingSetupPrompt {...surfaceProps} />)
        stall()
        fireEvent.click(screen.getByText('Skip for now'))
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(mockGrant).not.toHaveBeenCalled()
    })

    it('a pending grant that becomes ready closes onto Home with no success screen', () => {
        mockStatus = 'pending'
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.getByTestId('modal')).toBeInTheDocument()
        mockStatus = 'ready'
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
        expect(document.body.textContent).toBe('')
    })

    it('a grant that succeeds closes the modal once the backend reports ready', async () => {
        mockGrant.mockImplementation(async () => {
            mockStatus = 'ready'
            return { ok: true, status: 'ready' }
        })
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
    })
})

// The prompt is the manager's `finish-card-funding` ask: it answers through the surface props.
describe('FundingSetupPrompt — as an attention ask', () => {
    const HOUR_MS = 60 * 60 * 1000

    it('Skip for now snoozes the ask for an hour and answers nothing else', () => {
        mockLastError = { kind: 'user-cancelled' }
        render(<FundingSetupPrompt {...surfaceProps} />)
        const before = Date.now()
        fireEvent.click(screen.getByText('Skip for now'))
        expect(onSnoozed).toHaveBeenCalledTimes(1)
        expect(Math.abs(onSnoozed.mock.calls[0][0] - (before + HOUR_MS))).toBeLessThanOrEqual(60_000)
        expect(onActed).not.toHaveBeenCalled()
        expect(onDismissed).not.toHaveBeenCalled()
    })

    it('a grant made here reports acted once the backend reports ready', async () => {
        mockGrant.mockImplementation(async () => {
            mockStatus = 'ready'
            return { ok: true, status: 'ready' }
        })
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        tickBoth()
        expect(onActed).not.toHaveBeenCalled()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(onActed).toHaveBeenCalledTimes(1)
    })

    it('a grant that is accepted but still pending reports nothing yet', async () => {
        mockGrant.mockImplementation(async () => {
            mockStatus = 'pending'
            return { ok: true, status: 'pending' }
        })
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        tickBoth()
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        })
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(onActed).not.toHaveBeenCalled()
    })

    it('a setup still moving the card balance reports acted only once the move is done', async () => {
        mockOwesReturn = true
        mockSpendingPower = 1250
        mockStatus = 'ready'
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Move card balance to wallet' }))
        })
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(onActed).not.toHaveBeenCalled()
        mockOwesReturn = false
        mockSpendingPower = 0
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(onActed).toHaveBeenCalledTimes(1)
    })

    it('tells the manager while it still owes the card-balance move, and forgets it when it closes', () => {
        mockOwesReturn = true
        const view = render(<FundingSetupPrompt {...surfaceProps} />)
        expect(getFundingPromptHold('card-a').owesReturn).toBe(true)
        view.unmount()
        expect(getFundingPromptHold('card-a').owesReturn).toBe(false)
    })

    it('a grant that ended for good ends the ask for this app load', () => {
        mockLastError = { kind: 'scope-retired' }
        const view = render(<FundingSetupPrompt {...surfaceProps} />)
        expect(getFundingPromptHold('card-a').endedForGood).toBe(true)
        view.unmount()
        expect(getFundingPromptHold('card-a').endedForGood).toBe(true)
        expect(getFundingPromptHold('card-b').endedForGood).toBe(false)
    })
})

// R2: a long-time cardholder is never told to finish setting up a card that already worked.
describe('FundingSetupPrompt — an update for a card that already worked', () => {
    const title = () => screen.getByRole('heading', { level: 3 }).textContent
    const description = () => screen.getByTestId('description')
    const SETUP_COPY = /finish setting up|set up|start using/i
    const EXISTING: MockCard = {
        id: 'card-a',
        status: 'ACTIVE',
        hasWithdrawApproval: false,
        hasStoredWithdrawApproval: true,
    }
    const NEW_CARD_B: MockCard = { id: 'card-b', status: 'ACTIVE', hasWithdrawApproval: false }

    afterEach(() => jest.useRealTimers())

    const STATES: [string, () => void][] = [
        ['the permission is missing', () => (mockStatus = 'required')],
        ['the old permission is still on the wallet', () => (mockStatus = 'migration_required')],
        [
            'managed funding is offered',
            () => {
                mockAccess = { fundingMode: 'legacy', enrollmentAllowed: true }
                mockStatus = 'temporarily_unavailable'
            },
        ],
        ['the passkey was cancelled', () => (mockLastError = { kind: 'user-cancelled' })],
        ['the grant failed', () => (mockLastError = { kind: 'unexpected', message: 'boom' })],
        ['the grant is pending', () => (mockStatus = 'pending')],
        [
            'a card withdrawal is confirming',
            () => {
                mockStatus = 'temporarily_unavailable'
                mockInFlight = true
            },
        ],
        [
            'the balance move is owed',
            () => {
                mockStatus = 'ready'
                mockOwesReturn = true
                mockSpendingPower = 500
            },
        ],
        [
            'the balance move failed',
            () => {
                mockStatus = 'ready'
                mockOwesReturn = true
                mockSpendingPower = 500
                mockReturnError = { kind: 'return-failed' }
            },
        ],
    ]

    it.each(STATES)('an existing card reads as an update when %s', (_state, arrange) => {
        mockCards = [EXISTING]
        arrange()
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
        expect(description()).not.toHaveTextContent(SETUP_COPY)
    })

    it('an existing card whose wait stalled still reads as an update', () => {
        jest.useFakeTimers()
        mockCards = [EXISTING]
        mockStatus = 'pending'
        render(<FundingSetupPrompt {...surfaceProps} />)
        act(() => void jest.advanceTimersByTime(60_001))
        expect(screen.getByRole('button', { name: 'Check status' })).toBeInTheDocument()
        expect(title()).toBe('Card payments update')
    })

    // the old permission and card balance are themselves the evidence of a card that worked
    const NEW_CARD_STATES = STATES.filter(([state]) => !/old permission|balance move/.test(state))

    it.each(NEW_CARD_STATES)('a new card keeps finishing setup when %s', (_state, arrange) => {
        arrange()
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Finish setting up the card')
    })

    it('a new card offered managed funding gets the setup copy and the permission description', () => {
        mockAccess = { fundingMode: 'legacy', enrollmentAllowed: true }
        mockStatus = 'temporarily_unavailable'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Finish setting up the card')
        expect(description()).toHaveTextContent('One passkey tap to start using your card.')
        expect(screen.getByText(/Peanut manages how much our third party provider/)).toBeInTheDocument()
    })

    it('an approval from an API without the stored-approval flag still marks an existing card', () => {
        mockCards = [{ id: 'card-a', status: 'ACTIVE', hasWithdrawApproval: true }]
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
    })

    it('card balance alone marks an existing card, so a reload mid-update stays an update', () => {
        mockStatus = 'pending'
        mockSpendingPower = 500
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
    })

    it('keeps the update through pending, an error and the move back after the old permission is gone', () => {
        mockCards = [EXISTING]
        mockStatus = 'migration_required'
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')

        // the grant clears the stored approval and retires the old permission
        mockCards = [{ ...EXISTING, hasStoredWithdrawApproval: false }]
        mockStatus = 'pending'
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')

        mockStatus = 'required'
        mockLastError = { kind: 'unexpected', message: 'boom' }
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
        expect(description()).toHaveTextContent(
            "We couldn't finish the update. Try again, or skip for now. We'll ask again later."
        )

        mockLastError = null
        mockStatus = 'ready'
        mockOwesReturn = true
        mockReturnError = { kind: 'return-failed' }
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
        expect(description()).toHaveTextContent(
            "The update is done, but moving your card balance didn't finish. Try again now, or later from the card screen."
        )
    })

    it('the update outlives the prompt closing and reopening in the same app load', () => {
        mockCards = [EXISTING]
        mockStatus = 'migration_required'
        render(<FundingSetupPrompt {...surfaceProps} />).unmount()

        mockCards = [{ ...EXISTING, hasStoredWithdrawApproval: false }]
        mockStatus = 'pending'
        render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')
    })

    it('a re-issued new card does not inherit the earlier card’s update', () => {
        mockCards = [EXISTING]
        const { rerender } = render(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Card payments update')

        mockCards = [{ ...EXISTING, status: 'CANCELED' }, NEW_CARD_B]
        rerender(<FundingSetupPrompt {...surfaceProps} />)
        expect(title()).toBe('Finish setting up the card')
    })
})
