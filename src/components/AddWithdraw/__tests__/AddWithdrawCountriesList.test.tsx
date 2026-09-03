/**
 * Regression coverage for the deposit/withdraw method list's bank gate.
 *
 * P0 (2026-06-01 → 06-06): a user whose own-country bank rail was ENABLED
 * (scoped gate = `ready`) but who ALSO had a sibling bank rail in `pending`
 * (a second-country enrollment / a still-provisioning rail) got intercepted
 * by an unscoped `isBankRailUnderReview` check and dead-ended behind a
 * "You're all set / Go back" modal — unable to deposit. The gate already
 * ranks `ready` above `pending`; the extra check re-litigated that and lost.
 *
 * Fix: the gate's `kind` is the sole go/no-go signal (matching the sibling
 * /add-money/[country]/bank page). These tests assert (1) a `ready` user with
 * a pending sibling rail PROCEEDS, and (2) gating is still enforced when the
 * gate is NOT ready — so the fix didn't just delete the guard wholesale.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, within, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import AddWithdrawCountriesList from '../AddWithdrawCountriesList'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { addBankAccount } from '@/app/actions/users'

const render = (ui: React.ReactElement) => rtlRender(<IntlWrapper>{ui}</IntlWrapper>)

// ---- routing ----
const mockPush = jest.fn()
const mockParams: Record<string, string> = { country: 'testland' }
// mutable: the send-flow hand-off case needs ?method=bank visible to the REAL
// useSendFlowOrigin (which reads useSearchParams)
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useParams: () => mockParams,
    useSearchParams: () => mockSearchParams,
}))

// ---- consts: one country ('testland', id 'US') with a bank add-method and a
// Bridge bank withdraw-method (the withdraw path also runs checkBridgeGate). ----
jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [{ type: 'country', path: 'testland', id: 'US', title: 'Testland', currency: 'usd' }],
    COUNTRY_SPECIFIC_METHODS: {
        US: {
            add: [
                {
                    id: 'bank-add',
                    title: 'Bank',
                    description: 'Add via bank transfer',
                    icon: 'bank',
                    path: '/add-money/testland/bank',
                },
                {
                    id: 'pix-add',
                    title: 'Pix',
                    description: 'Instant transfers',
                    icon: 'pix',
                    path: '/add-money/brazil/manteca',
                },
            ],
            // id contains 'default-bank-withdraw' → routes through checkBridgeGate
            // (not the Manteca direct path), so it exercises the same gate.
            withdraw: [
                {
                    id: 'us-default-bank-withdraw',
                    title: 'To Bank',
                    description: 'Withdraw to your bank',
                    icon: 'bank',
                    isSoon: false,
                },
            ],
        },
    },
}))

// ---- capability gate (the unit under test reads gateFor) ----
// `setCapabilities` lets each test pick the gate kind + the rail set so we can
// reproduce the exact bug fixture: ready gate + a pending sibling rail.
const mockUseCapabilities = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => mockUseCapabilities(),
}))
function setCapabilities(gateKind: string, rails: Array<{ status: string; channel?: string; country?: string }>) {
    mockUseCapabilities.mockReturnValue({
        isKycApproved: rails.some((r) => r.status === 'enabled'),
        gateFor: () => ({ kind: gateKind }),
        // bankRails is intentionally NOT consumed by the component any more;
        // expose a faithful (scope-honoring) impl so a future re-introduction
        // of an unscoped read is caught rather than silently passing.
        bankRails: (opts?: { country?: string }) =>
            rails.filter((r) => r.channel === 'bank' && (!opts?.country || r.country === opts.country)),
    })
}

// ---- light mocks for everything else the component imports ----
// fetchUser is configurable: the new-account submit path refetches the user
// and picks the account that appeared (Chip round 10)
const mockFetchUser = jest.fn().mockResolvedValue(undefined)
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: mockFetchUser }),
}))
const mockSetSelectedBankAccount = jest.fn()
const mockSetSelectedMethod = jest.fn()
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    useOptionalWithdrawFlow: () => ({
        setSelectedBankAccount: mockSetSelectedBankAccount,
        setSelectedMethod: mockSetSelectedMethod,
    }),
}))
let mockUrlAmount = ''
jest.mock('@/features/withdraw/useWithdrawAmount', () => ({
    useWithdrawAmount: () => [mockUrlAmount, jest.fn()],
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }),
}))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn(),
        handleSelfHealResubmit: jest.fn(),
        isLoading: false,
        error: null,
        showWrapper: false,
    }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' },
    useDeviceType: () => ({ deviceType: 'WEB' }),
}))
jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('@/redux/slices/bank-form-slice', () => ({ bankFormActions: { clearFormData: () => ({ type: 'noop' }) } }))
jest.mock('@/app/actions/users', () => ({ addBankAccount: jest.fn() }))
jest.mock('@/utils/native-routes', () => ({
    rewriteMethodPath: (p: string) => p,
    withdrawBankUrl: (p: string, qs: string = '') => `/withdraw/${p}/bank${qs}`,
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/utils/color.utils', () => ({ getColorForUsername: () => ({ lightShade: '#fff' }) }))
jest.mock('@/utils/withdraw.utils', () => ({ getCountryCodeForWithdraw: (id: string) => id }))
// bridge.utils + regions.utils are direct util collaborators that transitively
// pull the heavy @/components/AddMoney/consts barrel (regions.utils computes a
// top-level `Object.values(BRIDGE_ALPHA3_TO_ALPHA2)` at import time, which throws
// under jest when consts is stubbed). The gate is mocked, so neither return value
// affects these assertions — stub both so the real consts is never evaluated.
jest.mock('@/utils/bridge.utils', () => ({ railJurisdictionForBank: () => 'US' }))
jest.mock('@/utils/regions.utils', () => ({ getRegionIntent: () => 'STANDARD' }))

jest.mock('@/components/0_Bruddle/ListItem', () => ({
    ListItem: (props: any) => (
        <button
            data-testid={`method-${props.title?.toLowerCase()}`}
            onClick={props.disabled ? undefined : props.onClick}
            disabled={props.disabled}
        >
            {props.title}
            {props.trailing}
        </button>
    ),
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-header" />,
}))
jest.mock('@/components/Global/Badges/StatusBadge', () => ({
    __esModule: true,
    default: (props: any) => <span data-testid="status-badge">{props.customText ?? props.status}</span>,
}))
jest.mock('@/components/Profile/AvatarWithBadge', () => ({ __esModule: true, default: () => <span /> }))
jest.mock('@/components/Global/EmptyStates/EmptyState', () => ({ __esModule: true, default: () => <div /> }))
// capture the props the list hands the bank form — the existing-account
// handler is the withdraw destination selector (Chip round 9)
const mockBankFormProps = jest.fn()
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({
    DynamicBankAccountForm: (props: unknown) => {
        mockBankFormProps(props)
        return <div data-testid="bank-form" />
    },
}))
jest.mock('@/components/Global/TokenAndNetworkConfirmationModal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Kyc/ProvideEmailStep', () => ({
    __esModule: true,
    default: (props: any) => (props.visible ? <div data-testid="provide-email-sheet" /> : null),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: any) => (props.visible ? <div data-testid="initiate-kyc-modal" /> : null),
}))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

describe('AddWithdrawCountriesList — bank gate', () => {
    beforeEach(() => {
        mockPush.mockClear()
    })

    it('P0 regression: ready gate + a pending sibling bank rail still lets the user proceed', () => {
        // own-country (US) rail enabled → scoped gate = ready; a *second* bank
        // rail elsewhere is pending. Pre-fix this opened the dead-end modal.
        setCapabilities('ready', [
            { status: 'enabled', channel: 'bank', country: 'US' },
            { status: 'pending', channel: 'bank', country: 'EU' },
        ])

        render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        // navigates to the bank deposit page; no KYC/status modal intercept
        expect(mockPush).toHaveBeenCalledWith('/add-money/testland/bank')
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
    })

    it('also proceeds when the pending sibling rail is in the SAME country (country-scoping alone would not fix this)', () => {
        // The kyc-2.0 case the documented one-liner missed: a working Manteca-
        // style rail and a pending rail share the user's own country.
        setCapabilities('ready', [
            { status: 'enabled', channel: 'bank', country: 'US' },
            { status: 'pending', channel: 'bank', country: 'US' },
        ])

        render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        expect(mockPush).toHaveBeenCalledWith('/add-money/testland/bank')
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
    })

    it('still gates: a non-ready gate blocks navigation and surfaces the KYC modal', () => {
        setCapabilities('needs-identity', [])

        render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
    })

    // checkBridgeGate is shared by BOTH flows — cover the withdraw entry too so
    // the removal can't silently regress bank withdrawals.
    it('withdraw flow: ready gate + pending sibling proceeds to /withdraw (no dead-end modal)', () => {
        setCapabilities('ready', [
            { status: 'enabled', channel: 'bank', country: 'US' },
            { status: 'pending', channel: 'bank', country: 'EU' },
        ])

        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByText('To Bank'))

        // method chosen → land on the amount step (named screen id in the URL)
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount')
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
    })

    it('withdraw flow: a non-ready gate still blocks + surfaces the KYC modal', () => {
        setCapabilities('needs-identity', [])

        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByText('To Bank'))

        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
    })

    // provide-email is a self-serve gate (one email unblocks the rail) — it must
    // open the email sheet, NEVER the contact-support KYC modal. Both the click
    // gate (checkBridgeGate) and the form-submit gate (handleFormSubmit) must
    // route it there; a missing branch on the submit path turned self-serve
    // recovery into a support ticket (2026-07 review finding).
    it('an email-blocked gate opens the provide-email sheet, not the contact-support KYC modal', () => {
        setCapabilities('provide-email', [{ status: 'blocked', channel: 'bank', country: 'US' }])

        render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        expect(screen.getByTestId('provide-email-sheet')).toBeInTheDocument()
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

/**
 * When the BRL-via-PIX onramp degrades, the Pix option gets flagged "under
 * maintenance" (config: pixBrazilOnrampMaintenance) — warn-only: it stays
 * visible and clickable.
 */
describe('AddWithdrawCountriesList — PIX onramp maintenance tag', () => {
    // snapshot/restore the shipped flag so each test can flip it without leaking
    // state — and without coupling the restore to the committed default
    let originalPixMaintenance: boolean

    beforeEach(() => {
        mockPush.mockClear()
        // a ready gate so a click can navigate — proving the option is not blocked
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
        originalPixMaintenance = underMaintenanceConfig.pixBrazilOnrampMaintenance
    })

    afterEach(() => {
        underMaintenanceConfig.pixBrazilOnrampMaintenance = originalPixMaintenance
    })

    it('tags the Pix option "Maintenance" but keeps it clickable (warn-only)', () => {
        underMaintenanceConfig.pixBrazilOnrampMaintenance = true

        render(<AddWithdrawCountriesList flow="add" />)

        const pixCard = screen.getByTestId('method-pix')
        expect(within(pixCard).getByText('Maintenance')).toBeInTheDocument()

        // warn-only: still navigates into the deposit flow
        fireEvent.click(pixCard)
        expect(mockPush).toHaveBeenCalledWith('/add-money/brazil/manteca')
    })

    it('shows no maintenance tag when the flag is off, and never tags non-Pix methods', () => {
        underMaintenanceConfig.pixBrazilOnrampMaintenance = false

        render(<AddWithdrawCountriesList flow="add" />)

        expect(within(screen.getByTestId('method-pix')).queryByText('Maintenance')).toBeNull()
        expect(within(screen.getByTestId('method-bank')).queryByText('Maintenance')).toBeNull()
    })
})

describe('AddWithdrawCountriesList — existing-account shortcut (Chip round 9)', () => {
    beforeEach(() => {
        mockPush.mockClear()
        mockSetSelectedBankAccount.mockClear()
        mockBankFormProps.mockClear()
        mockUrlAmount = '50'
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    afterEach(() => {
        mockUrlAmount = ''
    })

    it('withdraw flow: a typed account that already exists selects it and routes to review with the amount', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)

        // flow=withdraw + ?amount= lands straight on the bank form
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()
        const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
            onExistingAccount?: (account: unknown) => void
        }
        expect(typeof props.onExistingAccount).toBe('function')

        const existing = { id: 'acct-1', identifier: 'de89370400440532013000', type: 'iban' }
        props.onExistingAccount!(existing)

        // the account becomes the withdraw flow's destination…
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(existing)
        // …and the push carries the typed amount into the review page
        expect(mockPush).toHaveBeenCalledWith('/withdraw/testland/bank?amount=50')
    })
})

/**
 * The first-time path on the same screen (Chip round 10): a successfully
 * ADDED account must become the flow's destination AND the push must carry
 * the typed amount — the amount no longer travels in flow context, so a
 * dropped ?amount= makes useBridgeOfframpFlow's prerequisite effect bounce
 * the user back to /withdraw right after they typed their bank details.
 */
describe('AddWithdrawCountriesList — new-account submit hand-off (Chip round 10)', () => {
    const newAccount = { id: 'acct-new', bridgeAccountId: 'ext-new', identifier: 'de89370400440532013000' }
    const payload = {
        countryCode: 'US',
        countryName: 'Testland',
        accountOwnerName: { firstName: 'Ada', lastName: 'Lovelace' },
    }

    const submitForm = async () => {
        const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
            onSuccess: (payload: unknown, rawData: unknown) => Promise<{ error?: string }>
        }
        expect(typeof props.onSuccess).toBe('function')
        let result: { error?: string } | undefined
        await act(async () => {
            result = await props.onSuccess(payload, {})
        })
        return result
    }

    beforeEach(() => {
        mockPush.mockClear()
        mockSetSelectedBankAccount.mockClear()
        mockBankFormProps.mockClear()
        mockUrlAmount = '50'
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
        ;(addBankAccount as jest.Mock).mockResolvedValue({ data: { id: newAccount.id } })
        // the refetched user carries the freshly added account
        mockFetchUser.mockResolvedValue({ accounts: [newAccount] })
    })

    afterEach(() => {
        mockUrlAmount = ''
        mockSearchParams = new URLSearchParams()
        ;(addBankAccount as jest.Mock).mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(undefined)
    })

    it('withdraw flow: the added account becomes the destination and the push carries ?amount= to review', async () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()

        const result = await submitForm()

        expect(result).toEqual({})
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(newAccount)
        expect(mockPush).toHaveBeenCalledWith('/withdraw/testland/bank?amount=50')
    })

    it('entered from the send flow, the method marker rides along with the amount', async () => {
        mockSearchParams = new URLSearchParams('method=bank')
        render(<AddWithdrawCountriesList flow="withdraw" />)

        const result = await submitForm()

        expect(result).toEqual({})
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(newAccount)
        expect(mockPush).toHaveBeenCalledWith('/withdraw/testland/bank?method=bank&amount=50')
    })
})
