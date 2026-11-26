import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import type { ReactNode } from 'react'
import { ToastProvider } from '@/components/0_Bruddle/Toast'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { DEPOSIT_RAIL_ORDER } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
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
    default: ({ title, onPrev, hideBackBtn }: { title?: string; onPrev?: () => void; hideBackBtn?: boolean }) => (
        <div>
            {title && <span>{title}</span>}
            {onPrev && !hideBackBtn && <button onClick={onPrev}>back</button>}
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
// as the real hook: a successful clear leaves the address "not started"
const mockResetStatus = jest.fn(async () => {
    pollStatus = 'not_started'
})
jest.mock('@/components/AddMoney/hooks/useCryptoDepositPolling', () => ({
    useCryptoDepositPolling: (_address: string | undefined, onSuccess: (amount: number) => void) => {
        pollOnSuccess = onSuccess
        return {
            status: pollStatus,
            resetStatus: mockResetStatus,
            isResetting: false,
            isStatusRead: true,
            statusError: false,
            refetchStatus: jest.fn(),
        }
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
    matching: { nameOnAccount: 'user', sender: 'anyone' },
    instructions: {
        bankName: 'Lead Bank',
        accountNumber: '900123456789',
        routingNumber: '101019644',
        paymentRails: ['ach_push'],
    },
}
let depositAccounts: Record<string, unknown> = { ACH_US: ACH_ACCOUNT }
const mockClaim = jest.fn()
jest.mock('@/features/deposit-accounts/useDepositAccounts', () => ({
    DEPOSIT_ACCOUNTS_QUERY_KEY: ['deposit-accounts'],
    useDepositAccounts: () => ({ accounts: depositAccounts, isLoading: false, isError: false, claim: mockClaim }),
}))
// the deposit view's fresh balance read (its own tests cover the deposit arithmetic)
let mockLive = 2.5
jest.mock('@/features/card/readLiveSpendableUsd', () => ({ readLiveSpendableUsd: async () => mockLive }))
// account-currency units per dollar from the client rate feed; 0 is the hook's "no rate"
let usdRate = 0.92
let rateLoading = false
jest.mock('@/hooks/useExchangeRate', () => ({
    useExchangeRate: () => ({ exchangeRate: usdRate, isLoading: rateLoading, isError: usdRate === 0 }),
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
    mockLive = 2.5
    jest.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
    pollStatus = 'not_started'
    identityStatus = undefined
    pollOnSuccess = undefined
    readiness = { isLoading: false, residenceIso2s: ['US'], ready: noneReady, topUpGates: gates('blocked-rejection') }
    depositAccounts = { ACH_US: ACH_ACCOUNT }
    usdRate = 0.92
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
        // crypto opens on the gap; the one held account opens on its own name, with the amount in the body
        expect(within(drawer()).getByText(method === 'crypto' ? 'title' : /^details\.heading\(USD/)).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_GATE_ADD_FUNDS_TAPPED, {
            step: 'funding',
            method,
            funded: false,
        })
        expect(drawerEvents()).toEqual([['card_gate_add_money_drawer_opened', { method, view }]])
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
        // the drawer title already names the dollar gap, so a dollar account repeats no amount
        expect(within(details).queryByText(/amountToSend|sendAbout|sendInCurrency/)).not.toBeInTheDocument()
        expect(within(details).getByText('900123456789')).toBeInTheDocument()
        expect(within(details).getByText('101019644')).toBeInTheDocument()
        // arrival and fee read once, behind the same toggle as on the details screen
        expect(within(details).queryByText('fees.noFee')).not.toBeInTheDocument()
        fireEvent.click(within(details).getByText('details.termsToggle'))
        expect(within(details).getByText('fees.noFee')).toBeInTheDocument()
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

    const SEPA_ACCOUNT = {
        railId: 'bridge:eur:sepa',
        status: 'active',
        matching: { nameOnAccount: 'user', sender: 'anyone' },
        instructions: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', paymentRails: ['sepa'] },
    }
    const openOnlyAccount = (currency: string) => {
        readiness = { ...readiness, ready: { ...noneReady, account: [currency] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        return within(drawer()).getByTestId('card-add-money-bank-details')
    }

    it('asks for about the gap in euros on a euro account, rounded up, at the client rate', () => {
        readiness = { ...readiness, residenceIso2s: ['DE'] }
        depositAccounts = { SEPA_EU: SEPA_ACCOUNT }
        const details = openOnlyAccount('EUR')
        // $7.50 at 0.92 is €6.90, rounded up to a whole euro so a moving rate does not land short
        expect(within(details).getByText('sendAbout(€8)')).toBeInTheDocument()
        expect(within(details).getByText('DE89370400440532013000')).toBeInTheDocument()
    })

    it('names no euro amount when there is no rate', () => {
        usdRate = 0
        readiness = { ...readiness, residenceIso2s: ['DE'] }
        depositAccounts = { SEPA_EU: SEPA_ACCOUNT }
        const details = openOnlyAccount('EUR')
        expect(within(details).getByText('sendInCurrency(EUR)')).toBeInTheDocument()
        expect(within(details).queryByText(/\$7\.50|€/)).not.toBeInTheDocument()
    })

    it('keeps an own-name-only rule beside the numbers', () => {
        depositAccounts = {
            ACH_US: { ...ACH_ACCOUNT, matching: { nameOnAccount: 'user', sender: 'own-name-only' } },
        }
        const details = openOnlyAccount('USD')
        expect(within(details).getByText(/^rules\.ownName\.line/)).toBeInTheDocument()
    })

    it('shows the skeleton while the account opens, with no "sent" to tap yet', () => {
        depositAccounts = { ACH_US: { ...ACH_ACCOUNT, status: 'provisioning', instructions: undefined } }
        const details = openOnlyAccount('USD')
        expect(within(details).getByTestId('deposit-details-skeleton')).toBeInTheDocument()
        expect(within(details).getByText('details.provisioning')).toBeInTheDocument()
        expect(within(details).queryByText('sentTransfer')).not.toBeInTheDocument()
        expect(within(details).getByText('moreWays')).toBeInTheDocument()
    })

    it('says revoked details no longer work, and offers only the other ways', () => {
        depositAccounts = { ACH_US: { ...ACH_ACCOUNT, status: 'revoked' } }
        const details = openOnlyAccount('USD')
        expect(within(details).getByText('details.revokedTitle(USD)')).toBeInTheDocument()
        expect(within(details).getByText('details.revokedBody')).toBeInTheDocument()
        expect(within(details).queryByText('900123456789')).not.toBeInTheDocument()
        expect(within(details).queryByText('sentTransfer')).not.toBeInTheDocument()
        fireEvent.click(within(details).getByText('moreWays'))
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding')
    })

    it('says the account could not open after the wait, and retries the claim', () => {
        depositAccounts = {
            ACH_US: { ...ACH_ACCOUNT, status: 'provisioning', instructions: undefined, timedOut: true },
        }
        const details = openOnlyAccount('USD')
        expect(within(details).getByText('details.timedOutTitle(USD)')).toBeInTheDocument()
        expect(within(details).getByText('details.timedOutBody')).toBeInTheDocument()
        expect(within(details).queryByTestId('deposit-details-skeleton')).not.toBeInTheDocument()
        fireEvent.click(within(details).getByText('details.timedOutRetry'))
        expect(mockClaim).toHaveBeenCalledWith('ACH_US')
        expect(within(details).getByText('moreWays')).toBeInTheDocument()
    })

    it('says the details are not ready when the account is missing, not a blank card', () => {
        depositAccounts = {}
        const details = openOnlyAccount('USD')
        expect(within(details).getByText('details.unavailableTitle(USD)')).toBeInTheDocument()
        expect(within(details).queryByText('sentTransfer')).not.toBeInTheDocument()
        expect(within(details).getByText('moreWays')).toBeInTheDocument()
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
        // the bank partner reviews the account, not the user's ID
        expect(within(status).getByText('bankUnderReviewTitle')).toBeInTheDocument()
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
        // option B: the check ends back on this step
        expect(mockPush).toHaveBeenCalledWith('/verify?returnTo=%2Fcard%3Fcard_step%3Dfunding')
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
        mockLive = overrides.spendableUsd ?? props.spendableUsd
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
        expect(ask).toHaveTextContent('raisedToMinimum(evmNetworks|$5|$3)')
    })

    it('goes back from the address to the network list', async () => {
        await openAddress('sol')
        fireEvent.click(within(drawer()).getByText('back'))
        expect(within(drawer()).getByTestId('choose-network-sol')).toBeInTheDocument()
    })

    it('holds a completed outcome found at open, and does not clear it before it lands', async () => {
        pollStatus = 'completed'
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-tron'))
        await waitFor(() => expect(within(drawer()).getByTestId('card-add-money-processing')).toBeInTheDocument())
        expect(within(drawer()).queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockResetStatus).not.toHaveBeenCalled()
    })

    it('keeps a deposit already on its way and shows it processing', async () => {
        pollStatus = 'loading'
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-tron'))
        await waitFor(() => expect(within(drawer()).getByTestId('card-add-money-processing')).toBeInTheDocument())
        expect(within(drawer()).queryByTestId('qr')).not.toBeInTheDocument()
        expect(mockResetStatus).not.toHaveBeenCalled()
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

    it('offers a retry when the market moved', async () => {
        const { rerenderWith } = await openAddress('evm')
        pollStatus = 'failed'
        rerenderWith({})
        expect(within(drawer()).getByText('marketMovedTitle')).toBeInTheDocument()
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

// fix round 1 (laptop verification of #4279): one amount, one heading, no dead ends
let mockBankingRestricted = false
const mockOpenSupport = jest.fn()
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: mockBankingRestricted, card: false }),
}))
// whether the residence tier lists loaded: a residence rule is known only then (or from the server)
let mockSetsSettled = true
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    useResidenceRestrictionSetsWithStatus: () => ({ sets: null, settled: mockSetsSettled }),
}))
jest.mock('@/context/ModalsContext', () => ({
    ...jest.requireActual('@/context/ModalsContext'),
    useModalsContext: () => ({ openSupportWithMessage: mockOpenSupport }),
}))

describe('one amount, one heading, no dead ends', () => {
    beforeEach(() => {
        mockBankingRestricted = false
        mockSetsSettled = true
    })

    it('keeps one title with no amount, so it never disagrees with a raised ask', async () => {
        mockCreateDepositAddress.mockResolvedValue({
            depositAddress: '0xdeposit',
            minDepositLimitUsd: 10,
            maxDepositLimitUsd: 10000,
        })
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-evm'))
        await within(drawer()).findByTestId('card-add-money-address')
        // the visible title and its screen-reader twin
        expect(within(drawer()).getAllByText('title').length).toBeGreaterThan(0)
        expect(within(drawer()).queryByText(/^title\(/)).not.toBeInTheDocument()
        expect(within(drawer()).getByTestId('card-add-money-ask')).toHaveTextContent('sendAsk($10)')
    })

    it('keeps the one drawer title over a status view, which names itself in body text', () => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-identity' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        within(drawer()).getByTestId('card-add-money-status-not-verified')
        // the drawer's one title stays; the status is not a second heading
        expect(
            within(drawer())
                .getAllByText('title')
                .some((el) => !el.classList.contains('sr-only'))
        ).toBe(true)
        const status = within(drawer()).getByTestId('card-add-money-status-not-verified')
        expect(status.querySelector('[class*="text-heading"]')).toBeNull()
    })

    it('offers crypto as the tertiary link beside Verify identity, and comes back to the status', () => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'needs-identity' } }) }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const crypto = within(drawer()).getByTestId('card-add-money-use-crypto')
        expect(crypto).toHaveTextContent('useCryptoInstead')
        fireEvent.click(crypto)
        expect(within(drawer()).getByTestId('choose-network-evm')).toBeInTheDocument()
        fireEvent.click(within(drawer()).getByText('back'))
        expect(within(drawer()).getByTestId('card-add-money-status-not-verified')).toBeInTheDocument()
    })

    it('keeps a bank row that is not offered, last, and says why on tap', () => {
        mockBankingRestricted = true
        renderFunding()
        const rows = screen.getAllByTestId(/^card-add-money-(bank|crypto)$/)
        expect(rows.map((row) => row.dataset.testid)).toEqual(['card-add-money-crypto', 'card-add-money-bank'])
        expect(within(screen.getByTestId('card-add-money-bank')).getByText('list.badgeNotOffered')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-not-offered')
        expect(within(status).getByText('bankOnlyNotAvailableNote')).toBeInTheDocument()
        fireEvent.click(within(status).getByTestId('card-add-money-use-crypto'))
        expect(within(drawer()).getByTestId('choose-network-evm')).toBeInTheDocument()
    })

    it('takes a not-offered answer with no residence rule as one step left, not "not available"', () => {
        renderFunding()
        // an ordinary row: no Not available badge, not sorted last
        const rows = screen.getAllByTestId(/^card-add-money-(bank|crypto)$/)
        expect(rows.map((row) => row.dataset.testid)).toEqual(['card-add-money-bank', 'card-add-money-crypto'])
        expect(within(rows[0]).queryByText('list.badgeNotOffered')).not.toBeInTheDocument()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-not-offered')
        expect(within(status).getByText('finishSetupTitle')).toBeInTheDocument()
        expect(within(status).queryByText('bankOnlyNotAvailableNote')).not.toBeInTheDocument()
        fireEvent.click(within(status).getByText('continue'))
        expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank&returnTo=%2Fcard%3Fcard_step%3Dfunding')
    })

    it('GB: says bank is not available where the user lives only once the residence rule is known', () => {
        readiness = { ...readiness, residenceIso2s: ['GB'] }
        mockBankingRestricted = true
        // the tier lists have not loaded: an unknown residence withholds offers but refuses nothing
        mockSetsSettled = false
        const view = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(within(drawer()).queryByText('bankOnlyNotAvailableNote')).not.toBeInTheDocument()
        expect(within(drawer()).getByText('finishSetupTitle')).toBeInTheDocument()
        view.unmount()
        // the lists loaded and refuse banking for GB: now the residence copy, in gray, with the fix
        mockSetsSettled = true
        renderFunding()
        expect(within(screen.getByTestId('card-add-money-bank')).getByText('list.badgeNotOffered')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-not-offered')
        expect(within(status).getByText('bankOnlyNotAvailableNote')).toBeInTheDocument()
        expect(within(status).getByTestId('card-add-money-residence')).toBeInTheDocument()
    })

    it('shows the transfer as on its way after "I\'ve sent the transfer"', async () => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        const { rerenderWith } = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(within(drawer()).getByText('sentTransfer'))
        expect(await screen.findByText('bankSentPending($7.50)')).toBeInTheDocument()
        rerenderWith({ funded: true, spendableUsd: 10 })
        await waitFor(() => expect(screen.queryByText('bankSentPending($7.50)')).not.toBeInTheDocument())
    })

    it('keeps the pending line through a smaller deposit and drops it once the gap is covered', async () => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        const { rerenderWith } = renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(within(drawer()).getByText('sentTransfer'))
        expect(await screen.findByText('bankSentPending($7.50)')).toBeInTheDocument()
        // another $1 lands meanwhile: the $7.50 transfer is still on its way
        rerenderWith({ spendableUsd: 3.5 })
        expect(screen.getByTestId('card-add-money-bank-sent')).toBeInTheDocument()
        rerenderWith({ funded: true, spendableUsd: 10 })
        await waitFor(() => expect(screen.queryByTestId('card-add-money-bank-sent')).not.toBeInTheDocument())
    })
})

// laptop verification round 2 of #4279
describe('round 2: badges, one heading on details, the residence fix, no back while settling', () => {
    beforeEach(() => {
        mockBankingRestricted = false
        rateLoading = false
    })

    it.each([
        ['needs-identity', 'list.badgeVerifyId'],
        ['waiting-on-provider', 'list.badgeUnderReview'],
    ] as const)('badges a bank row blocked by %s', (kind, badge) => {
        readiness = {
            ...readiness,
            topUpGates: gates('blocked-rejection', {
                ACH_US: kind === 'needs-identity' ? { kind } : { kind, userMessage: null },
            }),
        }
        renderFunding()
        expect(within(screen.getByTestId('card-add-money-bank')).getByText(badge)).toBeInTheDocument()
    })

    it.each([
        ['being set up', { kind: 'pending' as const }, 'list.badgeSettingUp'],
        ['one step left', { kind: 'accept-tos' as const, userMessage: null }, 'list.badgeActionNeeded'],
    ])('badges a bank row %s', (_label, gate, badge) => {
        readiness = { ...readiness, topUpGates: gates('blocked-rejection', { ACH_US: gate }) }
        renderFunding()
        expect(within(screen.getByTestId('card-add-money-bank')).getByText(badge)).toBeInTheDocument()
    })

    it("says the bank partner reviews the account, not the user's ID, on a provider wait", () => {
        readiness = {
            ...readiness,
            topUpGates: gates('blocked-rejection', { ACH_US: { kind: 'waiting-on-provider', userMessage: null } }),
        }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        const status = within(drawer()).getByTestId('card-add-money-status-under-review')
        expect(within(status).getByText('bankUnderReviewTitle')).toBeInTheDocument()
        expect(within(status).queryByText('underReviewTitle')).not.toBeInTheDocument()
    })

    it('badges nothing on a bank row the user can use', () => {
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        renderFunding()
        expect(within(screen.getByTestId('card-add-money-bank')).queryByText(/^list\.badge/)).not.toBeInTheDocument()
    })

    it('offers the residence as the fix when a residence rule blocks bank, and support otherwise', () => {
        mockBankingRestricted = true
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        fireEvent.click(within(drawer()).getByTestId('card-add-money-residence'))
        expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/^\/settings\/details\?open=residence&returnTo=/))
        expect(within(drawer()).queryByText('contactSupport')).not.toBeInTheDocument()
    })

    it('names the account once on its details and says the dollar amount in the body', () => {
        depositAccounts = { ACH_US: ACH_ACCOUNT }
        readiness = { ...readiness, ready: { ...noneReady, account: ['USD'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(within(drawer()).getAllByText(/^details\.heading\(USD/)).toHaveLength(1)
        expect(within(drawer()).queryByText('title($7.50)')).not.toBeInTheDocument()
        expect(within(drawer()).getByTestId('card-add-money-bank-amount')).toHaveTextContent('sendAsk($7.50)')
    })

    it('puts no dollar amount on a euro transfer and holds the euro line while the rate loads', () => {
        rateLoading = true
        depositAccounts = {
            SEPA_EU: {
                railId: 'bridge:eur:sepa',
                status: 'active',
                matching: { nameOnAccount: 'user', sender: 'anyone' },
                instructions: { iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', paymentRails: ['sepa'] },
            },
        }
        readiness = { ...readiness, residenceIso2s: ['DE'], ready: { ...noneReady, account: ['EUR'] } }
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-bank'))
        expect(within(drawer()).queryByText(/\$7\.50/)).not.toBeInTheDocument()
        expect(within(drawer()).getByTestId('card-add-money-bank-amount-loading')).toBeInTheDocument()
        expect(within(drawer()).queryByTestId('card-add-money-bank-amount')).not.toBeInTheDocument()
    })

    it('hides the back while a deposit settles', async () => {
        renderFunding()
        fireEvent.click(screen.getByTestId('card-add-money-crypto'))
        fireEvent.click(within(drawer()).getByTestId('choose-network-tron'))
        await within(drawer()).findByTestId('card-add-money-address')
        expect(within(drawer()).getByText('back')).toBeInTheDocument()
        await act(async () => pollOnSuccess?.(7.5))
        expect(within(drawer()).getByTestId('card-add-money-processing')).toBeInTheDocument()
        expect(within(drawer()).queryByText('back')).not.toBeInTheDocument()
    })
})
