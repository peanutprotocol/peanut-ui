/**
 * The two reasons a corridor a verified user CAN see still cannot be opened.
 *
 * Neither comes from the capability gate, which only knows about identity:
 * the account cap is a billing decision, and a provider review is somebody
 * else's queue. Both arrive on the corridor's own terms, and both are stated
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

function flowProps(blockedBy?: ClaimableCorridor['blockedBy']) {
    return {
        corridors: [CORRIDOR],
        accounts: emptyCorridorRecord<DepositAccountView>(),
        claimable: { ...emptyCorridorRecord<ClaimableCorridor>(), [CORRIDOR]: terms(blockedBy) },
        gates: corridorRecord(() => READY),
        isLoading: false,
        userName: 'Demo User',
        onExit: jest.fn(),
        onClaim: jest.fn(),
        onResolveGate: jest.fn(),
        onRetry: jest.fn(),
        onContactSupport: jest.fn(),
    }
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

    it('sends a review waiting on the user to the identity gate it already has', () => {
        // Not a third screen: the user has to verify something, which is the
        // one flow that can clear it.
        expect(depositGateView(READY, terms('endorsement-required')).notice).toEqual({
            kind: 'needs-identity',
            message: null,
            action: 'verify',
        })
    })

    it('lets the capability gate answer first', () => {
        // An unverified user is not told about a cap they are nowhere near.
        expect(depositGateView({ kind: 'needs-identity' }, terms('account-limit')).notice?.action).toBe('verify')
    })

    it('keeps a blocked corridor off the claim step', () => {
        expect(resolveScreen('claim', DEPOSIT_RAILS[CORRIDOR], undefined, READY, terms('account-limit'))).toBe('list')
        expect(resolveScreen('claim', DEPOSIT_RAILS[CORRIDOR], undefined, READY, terms())).toBe('claim')
    })
})

describe('the screen a blocked corridor lands on', () => {
    it('offers support for the cap, through the one support door the app has', () => {
        const props = flowProps('account-limit')
        render(flow(props))
        expect(screen.getByText(GATE.limitTitle)).toBeInTheDocument()
        expect(screen.getByText(GATE.limitBody)).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('corridor-gate-account-limit'))
        expect(props.onContactSupport).toHaveBeenCalledWith(CORRIDOR, 'account-limit')
        // Support is the answer, never the identity flow: verifying again
        // cannot open a third account.
        expect(props.onResolveGate).not.toHaveBeenCalled()
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
