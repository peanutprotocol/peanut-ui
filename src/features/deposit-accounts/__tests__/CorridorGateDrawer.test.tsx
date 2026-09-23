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
    ['pending-review', { blockedBy: 'endorsement-pending' as const }, GATE.reviewTitle],
    ['wait', { gate: { kind: 'pending' } as GateState, withTerms: false }, GATE.waitTitle],
])('the %s gate', (_, options, title) => {
    it('opens as a bottom drawer over the list, which stays mounted', () => {
        renderFlow(flowProps(options))
        expect(screen.getByTestId('hub')).toBeInTheDocument()
        expect(drawer()).toHaveAttribute('data-vaul-drawer-direction', 'bottom')
        expect(drawer()).toHaveTextContent(title)
    })
})

describe('the gate drawer', () => {
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
        expect(drawer()).toHaveTextContent(GATE.reviewTitle)

        rerenderFlow(flowProps())
        expect(screen.getByTestId('claim')).toBeInTheDocument()
    })

    it('closes back to the list from the wait button, without leaving the flow', async () => {
        const props = flowProps({ blockedBy: 'endorsement-pending' })
        const { onUrlUpdate } = renderFlow(props)
        fireEvent.click(screen.getByTestId('corridor-gate-pending-review'))
        await expectBackOnList(onUrlUpdate)
        expect(props.onExit).not.toHaveBeenCalled()
        expect(screen.getByTestId('hub')).toBeInTheDocument()
    })

    it('opens support for the cap and closes itself, so the support sheet is not hidden behind it', async () => {
        const props = flowProps({ blockedBy: 'account-limit' })
        const { onUrlUpdate } = renderFlow(props)
        fireEvent.click(screen.getByTestId('corridor-gate-account-limit'))
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
        fireEvent.click(screen.getByTestId(`corridor-gate-${action}`))
        expect(props.onResolveGate).toHaveBeenCalledWith(gate, CORRIDOR)
        await expectBackOnList(onUrlUpdate)
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
