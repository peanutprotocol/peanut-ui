/**
 * TASK-22762: a corridor the user cannot open yet shows its reason in a drawer
 * over the accounts list, not on a page of its own. The list stays mounted
 * underneath, the drawer keeps updating from the same polled read, and the
 * buttons that clear a block still start their flows.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import messages from '@/i18n/app/messages/en.json'
import { NuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { corridorRecord, emptyCorridorRecord } from '../rails'
import { DepositAccountsFlow } from '../components/DepositAccountsFlow'
import { tapGateButton } from '../__fixtures__/gateDrawer'
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

const CORRIDOR: DepositCorridor = 'SEPA_EU'
const GATE = messages.depositAccounts.gate
const READY: GateState = { kind: 'ready' }

const terms = (blockedBy?: ClaimableCorridor['blockedBy']): ClaimableCorridor => ({
    railId: 'bridge.sepa_eu',
    method: 'SEPA_EU',
    country: 'EU',
    currency: 'EUR',
    matching: { sender: 'anyone' },
    ...(blockedBy ? { blockedBy } : {}),
})

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

function flowProps({
    blockedBy,
    gate = READY,
    withTerms = true,
}: { blockedBy?: ClaimableCorridor['blockedBy']; gate?: GateState; withTerms?: boolean } = {}) {
    const accounts = emptyCorridorRecord<DepositAccountView>()
    accounts.ACH_US = heldAccount
    return {
        corridors: [CORRIDOR],
        accounts,
        slotsHeld: 1,
        claimable: {
            ...emptyCorridorRecord<ClaimableCorridor>(),
            ...(withTerms ? { [CORRIDOR]: terms(blockedBy) } : {}),
        },
        gates: corridorRecord(() => gate),
        isLoading: false,
        userName: 'Demo User',
        onExit: jest.fn(),
        onClaim: jest.fn(),
        onResolveGate: jest.fn(),
        onRetry: jest.fn(),
        onContactSupport: jest.fn(),
    }
}

function renderFlow(props: ReturnType<typeof flowProps>, onUrlUpdate = jest.fn<void, [UrlUpdateEvent]>()) {
    const ui = (p: ReturnType<typeof flowProps>) => (
        <NextIntlClientProvider locale="en" messages={messages}>
            <NuqsTestingAdapter searchParams={`?step=claim&corridor=${CORRIDOR}`} onUrlUpdate={onUrlUpdate}>
                <DepositAccountsFlow {...p} />
            </NuqsTestingAdapter>
        </NextIntlClientProvider>
    )
    const utils = render(ui(props))
    return { ...utils, onUrlUpdate, rerenderFlow: (next: ReturnType<typeof flowProps>) => utils.rerender(ui(next)) }
}

const drawer = () => screen.getByRole('dialog')
// `list` is the step's default, so the URL drops it rather than spelling it out
const expectBackOnList = (onUrlUpdate: jest.Mock) =>
    waitFor(() => {
        expect(onUrlUpdate).toHaveBeenCalled()
        expect(onUrlUpdate.mock.calls.at(-1)?.[0].searchParams.get('step') ?? 'list').toBe('list')
    })

describe.each([
    ['account-limit', { blockedBy: 'account-limit' as const }, GATE.limitTitle.replace(/\{count.*\}\}/, '1 account')],
    ['pending-review', { blockedBy: 'endorsement-pending' as const }, GATE.reviewTitle.replace('{currency}', 'EUR')],
    ['wait', { gate: { kind: 'pending' } as GateState, withTerms: false }, GATE.waitTitle.replace('{currency}', 'EUR')],
])('the %s gate', (_, options, title) => {
    it('opens as a bottom drawer over the list, which stays mounted', () => {
        renderFlow(flowProps(options))
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(drawer()).toHaveAttribute('data-vaul-drawer-direction', 'bottom')
        expect(drawer()).toHaveTextContent(title)
    })

    // Hugo QA 2026-09-25: the "EUR · SEPA" line under the buttons was not in the DS
    it('has no rail caption under the buttons', () => {
        renderFlow(flowProps(options))
        expect(drawer()).not.toHaveTextContent('EUR · SEPA')
        expect(drawer()).not.toHaveTextContent(messages.depositAccounts.corridors.SEPA_EU.railName)
    })
})

/*
 * With the caption gone, the title names the currency wherever the drawer is
 * about one account; the other reasons (limit, identity, terms, email) hold
 * for every account alike.
 */
describe.each([
    ['support', { gate: { kind: 'blocked-rejection', userMessage: null } as GateState }, GATE.blockedTitle],
    ['pending-review', { blockedBy: 'endorsement-pending' as const }, GATE.reviewTitle],
    ['wait', { gate: { kind: 'pending' } as GateState, withTerms: false }, GATE.waitTitle],
])('the %s gate title', (_, options, title) => {
    it('names the currency the user tapped', () => {
        renderFlow(flowProps(options))
        expect(title).toContain('{currency}')
        expect(screen.getByRole('heading', { name: title.replace('{currency}', 'EUR') })).toBeInTheDocument()
    })
})

// Chip on ui#3456: verify, terms and email gates have a button yet drew the
// inactive gray. A wait is yellow; a reason with a way forward is blue.
describe.each([
    ['verify', { gate: { kind: 'needs-identity', userMessage: null } as GateState }, 'blue'],
    ['terms', { gate: { kind: 'accept-tos', tosUrl: 'https://x', userMessage: null } as GateState }, 'blue'],
    ['support', { gate: { kind: 'blocked-rejection', userMessage: null } as GateState }, 'blue'],
    ['pending-review', { blockedBy: 'endorsement-pending' as const }, 'yellow'],
    ['wait', { gate: { kind: 'pending' } as GateState, withTerms: false }, 'yellow'],
])('the %s gate bubble', (_, options, color) => {
    it(`is ${color}`, () => {
        renderFlow(flowProps(options))
        expect(drawer().querySelector('[class*="bg-background-icon-bubble-"]')).toHaveClass(
            `bg-background-icon-bubble-${color}`
        )
    })
})

describe('the gate drawer', () => {
    // The title and the button say it: one document to agree to. The identity
    // sentence belonged to a different step (sep-23 review, A5).
    it('asks for the terms with a heading and a button, and no identity sentence', () => {
        renderFlow(flowProps({ gate: { kind: 'accept-tos', tosUrl: 'https://x', userMessage: null } as GateState }))
        expect(drawer()).toHaveTextContent(GATE.tosTitle)
        expect(drawer()).toHaveTextContent(GATE.tosCta)
        expect(drawer()).not.toHaveTextContent(GATE.verifyBody)
    })

    it('keeps updating while open: a wait picks up the provider message from the next poll', () => {
        const { rerenderFlow } = renderFlow(flowProps({ gate: { kind: 'pending' }, withTerms: false }))
        expect(drawer()).toHaveTextContent(GATE.waitBody)

        rerenderFlow(
            flowProps({
                gate: { kind: 'waiting-on-provider', userMessage: 'Your bank details are on their way' },
                withTerms: false,
            })
        )
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(drawer()).toHaveTextContent('Your bank details are on their way')
    })

    it('keeps the list mounted while a pending review polls, then moves on to the claim', () => {
        const { rerenderFlow } = renderFlow(flowProps({ blockedBy: 'endorsement-pending' }))
        rerenderFlow(flowProps({ blockedBy: 'endorsement-pending' }))
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(drawer()).toHaveTextContent(GATE.reviewTitle.replace('{currency}', 'EUR'))

        rerenderFlow(flowProps())
        expect(screen.getByTestId('claim')).toBeInTheDocument()
    })

    it('closes back to the list from the wait button, without leaving the flow', async () => {
        const props = flowProps({ blockedBy: 'endorsement-pending' })
        const { onUrlUpdate } = renderFlow(props)
        tapGateButton(screen.getByTestId('corridor-gate-pending-review'))
        await expectBackOnList(onUrlUpdate)
        expect(props.onExit).not.toHaveBeenCalled()
        expect(screen.getByTestId('hub')).toBeInTheDocument()
    })

    // Chip on ui#3434: Accounts and payments links straight here, so a dismissal leaves the flow
    it('goes back where the user came from when dismissed, a direct link included', () => {
        const props = flowProps({ blockedBy: 'account-limit' })
        renderFlow(props)
        fireEvent.keyDown(drawer(), { key: 'Escape' })
        expect(props.onExit).toHaveBeenCalled()
    })

    it('opens support for the cap and closes itself, so the support sheet is not hidden behind it', async () => {
        const props = flowProps({ blockedBy: 'account-limit' })
        const { onUrlUpdate } = renderFlow(props)
        tapGateButton(screen.getByTestId('corridor-gate-account-limit'))
        expect(props.onContactSupport).toHaveBeenCalledWith(CORRIDOR, 'account-limit')
        await expectBackOnList(onUrlUpdate)
    })

    it.each([
        ['verify', { kind: 'needs-identity' } as GateState],
        ['accept-tos', { kind: 'accept-tos', tosUrl: 'https://x', userMessage: null } as GateState],
        ['provide-email', { kind: 'provide-email', userMessage: null } as GateState],
    ])('the %s button still starts its flow, and the drawer gives way to it', async (action, gate) => {
        const props = flowProps({ gate })
        const { onUrlUpdate } = renderFlow(props)
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        tapGateButton(screen.getByTestId(`corridor-gate-${action}`))
        expect(props.onResolveGate).toHaveBeenCalledWith(gate, CORRIDOR)
        await expectBackOnList(onUrlUpdate)
    })

    /*
     * The flow the drawer hands off to runs on the list. When it clears the
     * gate, the user goes on to the claim for the corridor they tapped, as the
     * full-page gate did — not back to a list they must tap again.
     */
    it('continues to the claim for that corridor once verification clears the gate', async () => {
        const props = flowProps({ gate: { kind: 'needs-identity' } })
        const { onUrlUpdate, rerenderFlow } = renderFlow(props)
        tapGateButton(screen.getByTestId('corridor-gate-verify'))
        expect(props.onResolveGate).toHaveBeenCalledWith({ kind: 'needs-identity' }, CORRIDOR)
        await expectBackOnList(onUrlUpdate)

        rerenderFlow(flowProps())
        await waitFor(() => {
            const last = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams
            expect(last?.get('step')).toBe('claim')
            expect(last?.get('corridor') ?? 'SEPA_EU').toBe(CORRIDOR)
        })
        expect(screen.getByTestId('claim')).toBeInTheDocument()
    })

    it('keeps the drawer open while the provider review page is being opened', () => {
        const review = { start: jest.fn(async () => {}), needsSupport: new Set<DepositCorridor>() }
        const props = { ...flowProps({ blockedBy: 'endorsement-required' }), review }
        renderFlow(props)
        fireEvent.click(screen.getByTestId('corridor-gate-finish-review'))
        expect(review.start).toHaveBeenCalledWith(CORRIDOR)
        expect(drawer()).toBeInTheDocument()
    })

    it('stays closed on the list step', () => {
        const props = flowProps({ blockedBy: 'account-limit' })
        render(
            <NextIntlClientProvider locale="en" messages={messages}>
                <NuqsTestingAdapter searchParams={`?step=list&corridor=${CORRIDOR}`}>
                    <DepositAccountsFlow {...props} />
                </NuqsTestingAdapter>
            </NextIntlClientProvider>
        )
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})

/*
 * TASK-23054 (C11): a verified user whose own review for the corridor waits on
 * them used to read "Verify identity first". The gate's action is the right
 * one; only its words were about another step.
 */
describe('a corridor held by the user own review', () => {
    const fixable: GateState = { kind: 'fixable-rejection', userMessage: null, actionKey: 'bridge-hosted' }
    const reviewProps = (cause?: 'review-action') => ({
        ...flowProps({ gate: fixable, withTerms: false }),
        unavailable: {
            ...emptyCorridorRecord(),
            [CORRIDOR]: {
                railId: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                reason: 'not-offered' as const,
                ...(cause ? { cause } : {}),
            },
        },
    })

    it('names the extra check, not identity, and starts the gate action that clears it', () => {
        const props = reviewProps('review-action')
        renderFlow(props)

        expect(drawer()).toHaveTextContent(GATE.finishReviewTitle.replace('{currency}', 'EUR'))
        expect(drawer()).toHaveTextContent(GATE.providerReviewBody.replace('{currency}', 'EUR'))
        expect(drawer()).not.toHaveTextContent(GATE.verifyTitle)

        tapGateButton(screen.getByTestId('corridor-gate-provider-review'))
        return waitFor(() => expect(props.onResolveGate).toHaveBeenCalledWith(fixable, CORRIDOR))
    })

    it('keeps the identity words for an API that sends no cause', () => {
        renderFlow(reviewProps())
        expect(drawer()).toHaveTextContent(GATE.verifyTitle)
    })
})

/*
 * A rail the residence rule blocks (api#1738) used to end on "Contact support":
 * the gate reads it as a terminal rejection, and support cannot lift a
 * residence rule. It now states the rule and closes; an ordinary rejection
 * keeps support.
 */
describe('a corridor the residence rule blocks', () => {
    const blocked = (code?: string): GateState => ({
        kind: 'blocked-rejection',
        userMessage: 'Bank transfers are not available.',
        ...(code ? { reason: { code, userMessage: 'x' } } : {}),
    })

    it('states a restricted residence in the app words and only closes', () => {
        const props = flowProps({ gate: blocked('residence_bank_restricted'), withTerms: false })
        renderFlow(props)

        expect(drawer()).toHaveTextContent(GATE.blockedTitle.replace('{currency}', 'EUR'))
        expect(drawer()).toHaveTextContent(
            messages.depositAccounts.list.residenceRestrictedBody.replace('{currency}', 'EUR')
        )
        expect(drawer()).not.toHaveTextContent(messages.identity.reasons.uk_resident_blocked)
        tapGateButton(screen.getByTestId('corridor-gate-residence-restricted'))
        expect(screen.getByTestId('corridor-gate-residence-restricted')).toHaveTextContent(messages.common.gotIt)
        expect(props.onContactSupport).not.toHaveBeenCalled()
        expect(props.onResolveGate).not.toHaveBeenCalled()
    })

    it('keeps the UK words for a UK residence only', () => {
        const props = flowProps({ gate: blocked('uk_resident_blocked'), withTerms: false })
        renderFlow(props)

        expect(drawer()).toHaveTextContent(messages.kyc.initiate.titleRegionUnavailable)
        expect(drawer()).toHaveTextContent(messages.identity.reasons.uk_resident_blocked)
        tapGateButton(screen.getByTestId('corridor-gate-residence-restricted'))
        expect(props.onContactSupport).not.toHaveBeenCalled()
        expect(props.onResolveGate).not.toHaveBeenCalled()
    })

    it('keeps an ordinary rejection on support', () => {
        const props = flowProps({ gate: blocked('provider_rejected'), withTerms: false })
        renderFlow(props)

        tapGateButton(screen.getByTestId('corridor-gate-support'))
        expect(props.onContactSupport).not.toHaveBeenCalled()
        expect(props.onResolveGate).toHaveBeenCalledWith(blocked('provider_rejected'), CORRIDOR)
    })
})
