import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { RAIN_CARD_OVERVIEW_QUERY_KEY } from '@/hooks/useRainCardOverview'
import type { GateState } from '@/utils/capability-gate'
import { CardAcquisitionScreen } from '../components/CardAcquisitionScreen'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }))
// key passthrough; values follow in brackets so the amounts a line carries are asserted
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string, values?: Record<string, unknown>) =>
        values ? `${key}(${Object.values(values).join('|')})` : key,
    useFormatter: () => ({ list: (items: string[]) => items.join(' or ') }),
}))
jest.mock('framer-motion', () => ({ useReducedMotion: () => true }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title, onPrev }: { title?: string; onPrev?: () => void }) => (
        <div>
            {title && <span>{title}</span>}
            {onPrev && <button onClick={onPrev}>back</button>}
        </div>
    ),
}))
jest.mock('@/components/Card/share-asset/ScaledPixelatedCardFace', () => ({ ScaledPixelatedCardFace: () => null }))
jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}))
let identityStatus: string | undefined
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' }, identityVerification: { status: identityStatus } } }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ address: '0xwallet' }) }))
jest.mock('@/hooks/useBridgeProviderId', () => ({ useBridgeProviderId: () => null }))

const mockCreateDepositAddress = jest.fn()
jest.mock('@/services/rhino', () => ({
    rhinoApi: { createDepositAddress: (...args: unknown[]) => mockCreateDepositAddress(...args) },
}))

// the Rhino status poll: the test drives its status and the success callback
let pollStatus: 'not_started' | 'loading' | 'failed' | 'completed' = 'not_started'
let pollOnSuccess: ((amount: number) => void) | undefined
const mockResetStatus = jest.fn(() => Promise.resolve())
jest.mock('@/components/AddMoney/hooks/useCryptoDepositPolling', () => ({
    useCryptoDepositPolling: (_address: string | undefined, onSuccess: (amount: number) => void) => {
        pollOnSuccess = onSuccess
        return { status: pollStatus, resetStatus: mockResetStatus, isResetting: false }
    },
}))

const gates = (kind: GateState['kind'], overrides: Partial<Record<DepositCorridor, GateState>> = {}) =>
    Object.fromEntries(
        DEPOSIT_RAIL_ORDER.map((corridor) => [corridor, overrides[corridor] ?? ({ kind } as GateState)])
    ) as Record<DepositCorridor, GateState>
const noneReady = { account: [] as string[], transfer: [] as string[], pix: [] as string[], ars: [] as string[] }
let readiness = {
    isLoading: false,
    residenceIso2s: ['US'] as string[],
    ready: noneReady,
    topUpGates: gates('blocked-rejection'),
}
jest.mock('@/features/add-money/useAddMoneyReadiness', () => ({ useAddMoneyReadiness: () => readiness }))

const ACH_ACCOUNT = {
    railId: 'bridge:usd:ach',
    status: 'active',
    instructions: {
        bankName: 'Lead Bank',
        accountNumber: '900123456789',
        routingNumber: '101019644',
        paymentRails: ['ach_push'],
    },
}
let depositAccounts: Record<string, unknown> = { ACH_US: ACH_ACCOUNT }
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    DEPOSIT_ACCOUNTS_QUERY_KEY: ['deposit-accounts'],
    useDepositAccounts: () => ({ accounts: depositAccounts, isLoading: false, isError: false }),
}))

beforeAll(() => {
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    pollStatus = 'not_started'
    identityStatus = undefined
    pollOnSuccess = undefined
    readiness = { isLoading: false, residenceIso2s: ['US'], ready: noneReady, topUpGates: gates('blocked-rejection') }
    depositAccounts = { ACH_US: ACH_ACCOUNT }
    mockCreateDepositAddress.mockResolvedValue({
        depositAddress: '0xdeposit',
        minDepositLimitUsd: 5,
        maxDepositLimitUsd: 10000,
    })
})

const props = {
    userId: 'alice',
    eligible: true,
    funded: false,
    fundingRequired: false,
    spendableUsd: 2.5,
    onApply: jest.fn(),
    onPrev: jest.fn(),
}

function renderFunding(overrides: Partial<typeof props> = {}) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const urlUpdates: UrlUpdateEvent[] = []
    const Nuqs = withNuqsTestingAdapter({
        searchParams: '?card_step=funding',
        hasMemory: true,
        onUrlUpdate: (event) => urlUpdates.push(event),
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <Nuqs>{children}</Nuqs>
            </ToastProvider>
        </QueryClientProvider>
    )
    const view = render(<CardAcquisitionScreen {...props} {...overrides} />, { wrapper })
    return {
        ...view,
        queryClient,
        urlUpdates,
        rerenderWith: (next: Partial<typeof props>) =>
            view.rerender(<CardAcquisitionScreen {...props} {...overrides} {...next} />),
    }
}

const drawer = () => screen.getByTestId('card-add-money-drawer')
const drawerEvents = () =>
    mockCapture.mock.calls.filter(
        ([name]) =>
            typeof name === 'string' &&
            name.startsWith('card_gate_') &&
            name !== ANALYTICS_EVENTS.CARD_GATE_STEP_VIEWED &&
            name !== ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED
    )

describe('funding step', () => {
    it('names the gap when the balance is known, and keeps the plain body while it loads', () => {
        const { rerenderWith } = renderFunding()
        expect(screen.getByText('fundingBodyGap($10|$2.50|$7.50)')).toBeInTheDocument()
        rerenderWith({ spendableUsd: undefined })
        expect(screen.getByText('fundingBody')).toBeInTheDocument()
    })

    it('shows a balance and a gap that add up to the minimum (0.29 * 100 is 28.999…)', () => {
        renderFunding({ spendableUsd: 0.29 })
        expect(screen.getByText('fundingBodyGap($10|$0.29|$9.71)')).toBeInTheDocument()
    })

    it.each([
        ['card-add-money-crypto', 'crypto', 'networks'],
        ['card-add-money-bank', 'bank', 'details'],
    ])('opens the drawer in place from %s, without leaving the page', (testId, method, view) => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId(testId))
        expect(drawer()).toBeInTheDocument()
        expect(within(drawer()).getByText('title($7.50)')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED, {
            step: 'funding',
            method,
            funded: false,
        })
        expect(drawerEvents()).toEqual([['card_gate_add_money_drawer_opened', { method, view }]])
    })

    it('hides the bank row when no bank way is offered to this user', () => {
        renderFunding()
        expect(screen.queryByTestId('card-add-money-bank')).not.toBeInTheDocument()
        expect(screen.getByTestId('card-add-money-crypto')).toBeInTheDocument()
    })

    it('goes straight to the one bank page with the gap and the way back', () => {
        readiness = { ...readiness, residenceIso2s: ['AR'], ready: { ...noneReady, ars: ['ARS'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(screen.queryByTestId('card-add-money-drawer')).not.toBeInTheDocument()
        expect(mockPush).toHaveBeenCalledWith(
            '/add-money/argentina/manteca?step=inputAmount&amount=7.50&currency=USD&returnTo=%2Fcard%3Fcard_step%3Dfunding'
        )
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_rail_picked', { corridor: 'BANK_TRANSFER_AR', kind: 'page' }],
        ])
    })
})

describe('bank views', () => {
    it('shows the held account details at once when it is the only way', () => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const details = within(drawer()).getByTestId('card-add-money-bank-details')
        expect(within(details).getByText('amountToSend($7.50)')).toBeInTheDocument()
        expect(within(details).getByText('900123456789')).toBeInTheDocument()
        expect(within(details).getByText('101019644')).toBeInTheDocument()
        expect(within(details).getByText('corridors.ACH_US.arrivalDetail')).toBeInTheDocument()
        // the details are the root: no way back to a list of one
        expect(within(drawer()).queryByText('back')).not.toBeInTheDocument()

        fireEvent.click(within(details).getByText('moreWays'))
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding')
    })

    it('lists two or more ways; an account opens its details, a page row leaves with the gap', () => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'], transfer: ['EUR'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(drawerEvents()).toEqual([['card_gate_add_money_drawer_opened', { method: 'bank', view: 'rows' }]])
        fireEvent.click(within(drawer()).getByTestId('card-add-money-rail-ach_us'))
        expect(within(drawer()).getByTestId('card-add-money-bank-details')).toBeInTheDocument()
        fireEvent.click(within(drawer()).getByText('back'))
        fireEvent.click(within(drawer()).getByTestId('card-add-money-rail-sepa_eu'))
        // a EUR transfer takes its amount in euros, so the dollar gap is not prefilled
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/add-money\/[a-z-]+\/bank\?returnTo=%2Fcard/))
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_drawer_opened', { method: 'bank', view: 'rows' }],
            ['card_gate_add_money_rail_picked', { corridor: 'ACH_US', kind: 'account' }],
            ['card_gate_add_money_rail_picked', { corridor: 'SEPA_EU', kind: 'page' }],
        ])
    })

    it('asks for the value in the rail currency on a non-dollar account, with no invented rate', () => {
        readiness = { ...readiness, residenceIso2s: ['DE'], ready: { ...noneReady, account: ['EUR'] } }
        depositAccounts = {
            SEPA_EU: {
                railId: 'bridge:eur:sepa',
                status: 'active',
                instructions: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', paymentRails: ['sepa'] },
            },
        }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(within(drawer()).getByText('amountToSendConverted($7.50|EUR)')).toBeInTheDocument()
        expect(within(drawer()).getByText('DE89370400440532013000')).toBeInTheDocument()
    })

    it('says the account is being set up and offers crypto now', () => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'pending' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-setting-up')
        expect(within(status).getByText('activation.settingUpTitle(USD)')).toBeInTheDocument()
        fireEvent.click(within(status).getByTestId('card-add-money-use-crypto'))
        expect(within(drawer()).getByTestId('choose-network-evm')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('says a review runs and offers crypto now', () => {
        readiness = {
            ...readiness,
            topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'waiting-on-provider', userMessage: null } }),
        }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-under-review')
        expect(within(status).getByText('underReviewTitle')).toBeInTheDocument()
        expect(within(status).getByTestId('card-add-money-use-crypto')).toHaveTextContent('useCrypto($7.50)')
    })

    it('sends an unverified user to verify, named as the card entry', () => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-identity' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-not-verified')
        expect(within(status).getByText('notVerifiedTitle')).toBeInTheDocument()
        expect(within(status).getByTestId('card-add-money-use-crypto')).toBeInTheDocument()
        fireEvent.click(within(status).getByTestId('card-add-money-verify'))
        expect(sessionStorage.getItem('peanut:verify-source-pending')).toBe('card')
        expect(mockPush).toHaveBeenCalledWith('/verify')
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_drawer_opened', { method: 'bank', view: 'not_verified' }],
            ['card_gate_add_money_verify_tapped', {}],
        ])
    })

    it('says the identity check is in review, not "Verify identity", while it processes', () => {
        identityStatus = 'processing'
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-identity' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-under-review')
        expect(within(status).getByText('underReviewTitle')).toBeInTheDocument()
        expect(within(drawer()).queryByTestId('card-add-money-verify')).not.toBeInTheDocument()
    })

    it('sends a user with one step left to the bank page, with the way back', () => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-enrollment' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-finish-setup')
        fireEvent.click(within(status).getByText('continue'))
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding')
    })
})

describe('crypto views', () => {
    async function openAddress(network: 'evm' | 'sol' | 'tron' = 'tron', overrides: Partial<typeof props> = {}) {
        const view = renderFunding(overrides)
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        expect(within(drawer()).getByText('pickNetwork')).toBeInTheDocument()
        fireEvent.click(within(drawer()).getByTestId(`choose-network-${network}`))
        await waitFor(() => expect(within(drawer()).getByTestId('card-add-money-address')).toBeInTheDocument())
        return view
    }

    it('shows the address for the picked network and asks for the gap', async () => {
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: 'Tdeposit', minDepositLimitUsd: 1 })
        await openAddress('tron')
        const address = within(drawer()).getByTestId('card-add-money-address')
        expect(within(address).getByText('depositAddress(Tron)')).toBeInTheDocument()
        expect(within(address).getByTestId('qr')).toHaveTextContent('Tdeposit')
        expect(within(address).getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($7.50)')
        expect(within(address).queryByText(/raisedToMinimum/)).not.toBeInTheDocument()
        expect(within(address).getByText('waiting')).toBeInTheDocument()
        expect(mockCreateDepositAddress).toHaveBeenCalledWith('0xwallet', 'TRON', 'u1')
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_drawer_opened', { method: 'crypto', view: 'networks' }],
            ['card_gate_add_money_network_picked', { network: 'TRON' }],
        ])
    })

    it('raises the ask to the network minimum and says where the extra goes', async () => {
        await openAddress('evm', { spendableUsd: 8 })
        const ask = within(drawer()).getByTestId('card-add-money-ask')
        expect(ask).toHaveTextContent('sendAsk($5)')
        expect(ask).toHaveTextContent('raisedToMinimum(EVM|$5|$3)')
    })

    it('goes back from the address to the network list', async () => {
        await openAddress('sol')
        fireEvent.click(within(drawer()).getByText('back'))
        expect(within(drawer()).getByTestId('choose-network-sol')).toBeInTheDocument()
    })

    it('shows what is still missing after a short deposit and watches for the rest', async () => {
        const { queryClient } = await openAddress('tron')
        queryClient.setQueryData(['balance', '0xwallet'], 1)
        await act(async () => pollOnSuccess?.(4))
        const short = within(drawer()).getByTestId('card-add-money-short')
        expect(short).toHaveTextContent('partialContribution.title($4|$7.50)')
        // $3.50 is left, but the network takes at least $5: a smaller transfer would strand
        expect(short).toHaveTextContent('partialContribution.description($5)')
        // the address stays to send the rest to
        expect(within(drawer()).getByTestId('qr')).toBeInTheDocument()
        expect(mockResetStatus).toHaveBeenCalled()
        expect(queryClient.getQueryState(['balance', '0xwallet'])?.isInvalidated).toBe(true)
    })

    it('asks for the exact rest after a short deposit when the network minimum is lower', async () => {
        mockCreateDepositAddress.mockResolvedValue({ depositAddress: 'Tdeposit', minDepositLimitUsd: 1 })
        await openAddress('tron')
        await act(async () => pollOnSuccess?.(4))
        expect(within(drawer()).getByTestId('card-add-money-short')).toHaveTextContent(
            'partialContribution.description($3.50)'
        )
    })

    it('turns a full deposit into a short one when the refreshed balance still leaves a gap', async () => {
        const { rerenderWith } = await openAddress('tron')
        await act(async () => pollOnSuccess?.(7.5))
        expect(within(drawer()).getByTestId('card-add-money-processing')).toBeInTheDocument()
        // a fee was taken on the way: the balance read lands $1 short of the minimum
        await act(async () => rerenderWith({ spendableUsd: 9 }))
        const short = within(drawer()).getByTestId('card-add-money-short')
        expect(short).toHaveTextContent('partialContribution.title($6.50|$7.50)')
        expect(within(drawer()).getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($5)')
    })

    it('clears a status left by an earlier deposit before the first poll can read it as this one', async () => {
        await openAddress('tron')
        await waitFor(() => expect(mockResetStatus).toHaveBeenCalledTimes(1))
    })

    it('sends the deposit event the add-money crypto page sends', async () => {
        await openAddress('tron')
        await act(async () => pollOnSuccess?.(7.5))
        expect(mockCapture).toHaveBeenCalledWith(
            ANALYTICS_EVENTS.DEPOSIT_COMPLETED,
            expect.objectContaining({ amount: 7.5, chain_type: 'TRON', method_type: 'crypto' })
        )
    })

    it('lists the EVM chains the address works on', async () => {
        await openAddress('evm')
        expect(within(drawer()).getByText('supportedEvmNetworks')).toBeInTheDocument()
    })

    it('shows the processing state after a full deposit and refreshes the balance and card reads', async () => {
        const { queryClient } = await openAddress('tron')
        queryClient.setQueryData(['balance', '0xwallet'], 1)
        queryClient.setQueryData([RAIN_CARD_OVERVIEW_QUERY_KEY, 'u1'], {})
        await act(async () => pollOnSuccess?.(7.5))
        expect(within(drawer()).getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(queryClient.getQueryState(['balance', '0xwallet'])?.isInvalidated).toBe(true)
        expect(queryClient.getQueryState([RAIN_CARD_OVERVIEW_QUERY_KEY, 'u1'])?.isInvalidated).toBe(true)
    })

    it('offers a retry when the market moved', async () => {
        pollStatus = 'failed'
        await act(async () => {
            renderFunding()
        })
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-evm'))
        await waitFor(() => expect(within(drawer()).getByText('marketMovedTitle')).toBeInTheDocument())
        fireEvent.click(within(drawer()).getByText('tryAgain'))
        expect(mockResetStatus).toHaveBeenCalled()
    })

    it('explains an address that could not be prepared and retries it', async () => {
        mockCreateDepositAddress.mockRejectedValueOnce(new Error('down'))
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-evm'))
        await waitFor(() => expect(within(drawer()).getByText('addressErrorTitle')).toBeInTheDocument())
        fireEvent.click(within(drawer()).getByText('retry'))
        await waitFor(() => expect(within(drawer()).getByTestId('card-add-money-address')).toBeInTheDocument())
    })
})

describe('funded while the drawer is open', () => {
    it('closes the drawer, moves to the application and reports the drawer as the path', async () => {
        const { rerenderWith, urlUpdates } = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        expect(drawer()).toBeInTheDocument()
        rerenderWith({ funded: true, spendableUsd: 10 })
        await waitFor(() => expect(screen.queryByTestId('card-add-money-drawer')).not.toBeInTheDocument())
        expect(urlUpdates.at(-1)?.queryString).toBe('?card_step=entry')
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_drawer_opened', { method: 'crypto', view: 'networks' }],
            ['card_gate_came_back_funded', { in_drawer: true, method: 'crypto' }],
        ])
    })

    it('reports a funding that came another way once, with no drawer open', () => {
        const { rerenderWith, urlUpdates } = renderFunding()
        rerenderWith({ funded: true, spendableUsd: 12 })
        rerenderWith({ funded: true, spendableUsd: 13 })
        expect(urlUpdates).toEqual([])
        expect(drawerEvents()).toEqual([['card_gate_came_back_funded', { in_drawer: false, method: null }]])
    })

    it('keeps a funded user in the drawer they opened', () => {
        renderFunding({ funded: true, spendableUsd: 12 })
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        expect(drawer()).toBeInTheDocument()
    })

    it('reports a funding that came another way after the step remounts', () => {
        const first = renderFunding()
        first.unmount()
        renderFunding({ funded: true, spendableUsd: 12 })
        expect(drawerEvents()).toContainEqual(['card_gate_came_back_funded', { in_drawer: false, method: null }])
    })

    it('reports a dismissed drawer with the view it showed', () => {
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.keyDown(drawer(), { key: 'Escape' })
        expect(drawerEvents()).toEqual([
            ['card_gate_add_money_drawer_opened', { method: 'crypto', view: 'networks' }],
            ['card_gate_add_money_drawer_closed', { method: 'crypto', view: 'networks' }],
        ])
    })
})
