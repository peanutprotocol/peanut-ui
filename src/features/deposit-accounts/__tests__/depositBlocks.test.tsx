/**
 * The reasons a corridor a verified user CAN see still cannot be opened.
 *
 * None comes from the capability gate, which only knows about identity:
 * the account cap is a billing decision, and a provider review is a queue at
 * the provider — waiting on the provider, or on the user. All arrive on the corridor's own terms, and both are stated
 * on the screen behind the row rather than on the row — the row stays
 * tappable, because the tap is what asks for the review in the first place.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { depositGateView } from '../depositGate'
import { resolveScreen } from '../resolveScreen'
import { DEPOSIT_RAILS, corridorRecord, emptyCorridorRecord } from '../rails'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import type { ClaimableCorridor, DepositAccountView, DepositCorridor } from '../types'
import type { EndorsementReview } from '../useEndorsementReview'
import type { GateState } from '@/utils/capability-gate'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    usePathname: () => '/add-money',
    useSearchParams: () => new URLSearchParams(),
    useParams: () => ({}),
}))
jest.mock('../useResidenceIso2s', () => ({ useResidenceIso2s: () => [] }))
jest.mock('../components/DepositAccountsListScreen', () => ({
    DepositAccountsListScreen: () => <div data-testid="hub" />,
}))
jest.mock('../components/ClaimAccountScreen', () => ({
    ClaimAccountScreen: () => <div data-testid="claim" />,
}))

const READY: GateState = { kind: 'ready' }
const CORRIDOR: DepositCorridor = 'SEPA_EU'
const GATE = messages.depositAccounts.gate

const terms = (blockedBy?: ClaimableCorridor['blockedBy']): ClaimableCorridor => ({
    railId: 'bridge.sepa_eu',
    method: 'SEPA_EU',
    country: 'EU',
    currency: 'EUR',
    matching: { sender: 'anyone' },
    ...(blockedBy ? { blockedBy } : {}),
})

// A genuinely-held account on ANOTHER corridor, so the cap the backend reports
// on the selected (still unheld) corridor has accounts the client can see.
const heldAccount: DepositAccountView = {
    id: 'held-ach',
    railId: 'bridge.ach_us',
    country: 'US',
    currency: 'USD',
    isPrimary: true,
    status: 'active',
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: { accountHolderName: 'Demo User', paymentRails: ['ach_push'] },
}

function flowProps(blockedBy?: ClaimableCorridor['blockedBy'], heldElsewhere = false, gate: GateState = READY) {
    const accounts = emptyCorridorRecord<DepositAccountView>()
    if (heldElsewhere) accounts.ACH_US = heldAccount
    return {
        corridors: [CORRIDOR],
        accounts,
        slotsHeld: heldElsewhere ? 1 : 0,
        claimable: { ...emptyCorridorRecord<ClaimableCorridor>(), [CORRIDOR]: terms(blockedBy) },
        gates: corridorRecord(() => gate),
        isLoading: false,
        userName: 'Demo User',
        onExit: jest.fn(),
        onClaim: jest.fn(),
        onResolveGate: jest.fn(),
        onRetry: jest.fn(),
        onContactSupport: jest.fn(),
        review: reviewStub() as EndorsementReview | undefined,
    }
}

/** the hosted-page opener, as the flow sees it */
function reviewStub(over: Partial<EndorsementReview> = {}): EndorsementReview {
    return { start: jest.fn(async () => {}), needsSupport: new Set(), ...over }
}

const flow = (props: ReturnType<typeof flowProps>) => (
    <NextIntlClientProvider locale="en" messages={messages}>
        <NuqsTestingAdapter searchParams={`?step=claim&corridor=${CORRIDOR}`}>
            <DepositAccountsFlow {...props} />
        </NuqsTestingAdapter>
    </NextIntlClientProvider>
)

describe('what a block does to the gate view', () => {
    it('leaves an unblocked corridor claimable', () => {
        expect(depositGateView(READY, terms())).toEqual({ claimable: true })
    })

    it('turns the cap into a notice that offers a person', () => {
        expect(depositGateView(READY, terms('account-limit')).notice).toEqual({
            kind: 'account-limit',
            message: null,
            action: 'account-limit',
        })
    })

    it('turns a running review into a wait', () => {
        expect(depositGateView(READY, terms('endorsement-pending')).notice?.action).toBe('pending-review')
    })

    it('gives a review waiting on the user its own kind, never the identity gate', () => {
        // The user is verified already, and identity verification cannot grant
        // a provider review.
        expect(depositGateView(READY, terms('endorsement-required')).notice).toEqual({
            kind: 'endorsement-required',
            message: null,
            action: 'finish-review',
        })
    })

    it('lets the capability gate answer first', () => {
        // An unverified user is not told about a cap they are nowhere near.
        expect(depositGateView({ kind: 'needs-identity' }, terms('account-limit')).notice?.action).toBe('verify')
    })

    it('keeps an unverified user on identity, whatever the review says', () => {
        expect(depositGateView({ kind: 'needs-identity' }, terms('endorsement-required')).notice).toEqual({
            kind: 'needs-identity',
            message: null,
            action: 'verify',
        })
    })

    /**
     * The real path. A corridor offered before the user has a rail can never
     * read `ready` first: a verified user reads `needs-enrollment`, and after
     * the tap records the request, `pending`. Both used to win over the
     * backend's terms — one sent the user to identity verification, the other
     * told them there was nothing to do.
     */
    it.each([['needs-enrollment'], ['pending'], ['waiting-on-provider']] as const)(
        'lets the backend terms decide for an offered corridor whose gate is %s',
        (kind) => {
            const gate = { kind } as GateState
            expect(depositGateView(gate, terms())).toEqual({ claimable: true })
            expect(depositGateView(gate, terms('endorsement-required')).notice?.action).toBe('finish-review')
            expect(depositGateView(gate, terms('endorsement-pending')).notice?.action).toBe('pending-review')
        }
    )

    it('keeps the capability gate for a corridor the backend does not offer', () => {
        expect(depositGateView({ kind: 'needs-enrollment' }).notice?.action).toBe('verify')
        expect(depositGateView({ kind: 'pending' }).notice?.action).toBe('none')
    })

    it('never lets the terms override a rejection on the rail itself', () => {
        const rejected: GateState = { kind: 'blocked-rejection', userMessage: null } as GateState
        expect(depositGateView(rejected, terms()).notice?.action).toBe('support')
    })

    it('keeps a blocked corridor off the claim step', () => {
        expect(resolveScreen('claim', DEPOSIT_RAILS[CORRIDOR], undefined, READY, terms('account-limit'))).toBe('list')
        expect(resolveScreen('claim', DEPOSIT_RAILS[CORRIDOR], undefined, READY, terms())).toBe('claim')
    })
})

describe('the screen a blocked corridor lands on', () => {
    it('offers support for the cap, through the one support door the app has', () => {
        // The backend reports the cap AND the client can see the accounts it
        // names — a genuinely-held account elsewhere — so the cap screen is true.
        const props = flowProps('account-limit', true)
        render(flow(props))
        expect(screen.getByText('You already have 1 account')).toBeInTheDocument()
        expect(screen.getByText(GATE.limitBody)).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('corridor-gate-account-limit'))
        expect(props.onContactSupport).toHaveBeenCalledWith(CORRIDOR, 'account-limit')
        // Support is the answer, never the identity flow: verifying again
        // cannot open a third account.
        expect(props.onResolveGate).not.toHaveBeenCalled()
    })

    it('does not claim two accounts the user does not hold after a failed claim', () => {
        // A failed claim can leave the backend reporting the cap for a user who
        // holds zero accounts (on staging the shared provider customer already
        // has some). "You already have two accounts" is then false, so the
        // honest "we cannot open an account" support screen shows instead.
        const props = flowProps('account-limit')
        render(flow(props))
        expect(screen.queryByText(GATE.limitBody)).not.toBeInTheDocument()
        expect(screen.getByText(GATE.blockedTitle)).toBeInTheDocument()
        expect(screen.queryByTestId('corridor-gate-account-limit')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('corridor-gate-support'))
        expect(props.onContactSupport).toHaveBeenCalledWith(CORRIDOR, 'blocked')
        expect(props.onResolveGate).not.toHaveBeenCalled()
    })

    it('never shows the identity sentence on a support screen', () => {
        render(flow(flowProps('account-limit')))
        expect(screen.getByText(GATE.blockedBody)).toBeInTheDocument()
        expect(screen.queryByText(GATE.verifyBody)).not.toBeInTheDocument()
    })

    it('states the number of accounts the user holds, not a default', () => {
        render(flow({ ...flowProps('account-limit', true), slotsHeld: 3 }))
        expect(screen.getByText('You already have 3 accounts')).toBeInTheDocument()
    })

    describe('a review that waits on a verified user', () => {
        const PENDING: GateState = { kind: 'pending' }

        it('opens the provider page for this corridor, and never identity verification', () => {
            const props = flowProps('endorsement-required', false, PENDING)
            render(flow(props))
            expect(screen.getByText(GATE.finishReviewTitle)).toBeInTheDocument()
            expect(screen.getByText(GATE.finishReviewBody.replace('{currency}', 'EUR'))).toBeInTheDocument()
            expect(screen.queryByText(GATE.verifyTitle)).not.toBeInTheDocument()
            expect(screen.queryByText(GATE.waitTitle)).not.toBeInTheDocument()
            fireEvent.click(screen.getByTestId('corridor-gate-finish-review'))
            expect(props.review?.start).toHaveBeenCalledWith(CORRIDOR)
            expect(props.onResolveGate).not.toHaveBeenCalled()
        })

        it.each([
            ['the caller cannot open a page', () => undefined],
            ['the claim answered with no page', () => reviewStub({ needsSupport: new Set([CORRIDOR]) })],
        ])('says what is needed and offers support when %s', (_, review) => {
            const props = { ...flowProps('endorsement-required', false, PENDING), review: review() }
            render(flow(props))
            expect(screen.getByText(GATE.finishReviewTitle)).toBeInTheDocument()
            expect(screen.getByText(GATE.finishReviewSupportBody.replace('{currency}', 'EUR'))).toBeInTheDocument()
            fireEvent.click(screen.getByTestId('corridor-gate-finish-review-support'))
            expect(props.onContactSupport).toHaveBeenCalledWith(CORRIDOR, 'review')
            expect(props.onResolveGate).not.toHaveBeenCalled()
        })

        it.each([['rejected'], ['REVOKED']])('goes straight to support for a corridor the provider %s', (issue) => {
            const props = flowProps('endorsement-required', false, PENDING)
            props.claimable[CORRIDOR] = {
                ...terms('endorsement-required'),
                requirements: { pending: [], missing: [], issues: [issue] },
            }
            render(flow(props))
            expect(screen.getByTestId('corridor-gate-finish-review-support')).toBeInTheDocument()
        })

        it('says so when the page could not be opened, and keeps the button as the retry', () => {
            const props = {
                ...flowProps('endorsement-required', false, PENDING),
                review: reviewStub({ failedCorridor: CORRIDOR }),
            }
            render(flow(props))
            expect(screen.getByText(GATE.actFailed)).toBeInTheDocument()
            expect(screen.getByTestId('corridor-gate-finish-review')).toBeEnabled()
        })

        it('disables the button while the page is being fetched', () => {
            const props = {
                ...flowProps('endorsement-required', false, PENDING),
                review: reviewStub({ startingCorridor: CORRIDOR }),
            }
            render(flow(props))
            expect(screen.getByTestId('corridor-gate-finish-review')).toBeDisabled()
        })

        it('leaves an unverified user on identity verification', () => {
            const props = flowProps('endorsement-required', false, { kind: 'needs-identity' })
            render(flow(props))
            expect(screen.getByText(GATE.verifyTitle)).toBeInTheDocument()
            fireEvent.click(screen.getByTestId('corridor-gate-verify'))
            expect(props.onResolveGate).toHaveBeenCalledTimes(1)
            expect(props.review?.start).not.toHaveBeenCalled()
        })

        it('keeps the under-review wait for a review the provider is still running', () => {
            render(flow(flowProps('endorsement-pending', false, PENDING)))
            expect(screen.getByText(GATE.reviewTitle)).toBeInTheDocument()
        })
    })

    it('waits while the review runs, with nothing for the user to press but back', () => {
        const props = flowProps('endorsement-pending')
        render(flow(props))
        expect(screen.getByText(GATE.reviewTitle)).toBeInTheDocument()
        expect(screen.getByText(GATE.reviewBody)).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('corridor-gate-pending-review'))
        expect(props.onResolveGate).not.toHaveBeenCalled()
        expect(props.onContactSupport).not.toHaveBeenCalled()
    })

    it('continues into the claim by itself once the review clears', () => {
        const { rerender } = render(flow(flowProps('endorsement-pending')))
        expect(screen.getByText(GATE.reviewTitle)).toBeInTheDocument()
        // The preview stops saying it is blocked, and the flow moves on with no
        // tap: the user is watching this screen while the provider answers.
        rerender(flow(flowProps()))
        expect(screen.getByTestId('claim')).toBeInTheDocument()
    })
})
