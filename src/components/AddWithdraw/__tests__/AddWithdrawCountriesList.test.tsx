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
import { render as rtlRender, screen, fireEvent, within, act, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import AddWithdrawCountriesList from '../AddWithdrawCountriesList'
import underMaintenanceConfig from '@/config/underMaintenance.config'
import { addBankAccount } from '@/app/actions/users'

// the screen is named in the URL (`?step=form`), so every render needs the
// nuqs adapter — and the tests that want the bank form say so by setting it
let mockNuqsParams: Record<string, string> = {}
const mockUrlUpdate = jest.fn()
const withProviders = (ui: React.ReactElement) => (
    <IntlWrapper>
        <NuqsTestingAdapter searchParams={mockNuqsParams} onUrlUpdate={mockUrlUpdate}>
            {ui}
        </NuqsTestingAdapter>
    </IntlWrapper>
)
const render = (ui: React.ReactElement) => rtlRender(withProviders(ui))

// ---- routing ----
const mockPush = jest.fn()
const mockParams: Record<string, string> = { country: 'testland' }
// mutable: the send-flow hand-off case needs ?method=bank visible to the REAL
// useSendFlowOrigin (which reads useSearchParams)
let mockSearchParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockPush }),
    useParams: () => mockParams,
    useSearchParams: () => mockSearchParams,
}))

// ---- consts: one country ('testland', id 'US') with a bank add-method and a
// Bridge bank withdraw-method (the withdraw path also runs checkBridgeGate). ----
jest.mock('@/components/AddMoney/consts', () => ({
    countryData: [
        { type: 'country', path: 'testland', id: 'US', title: 'Testland', currency: 'usd' },
        // a real catalogue country with NO bank corridor — reachable only by
        // hand-editing the URL, which is the hole F9 names
        { type: 'country', path: 'nocorridor', id: 'IND', title: 'Nocorridor', currency: 'inr' },
        { type: 'country', path: 'aland', id: 'ALA', title: 'Åland', currency: 'eur' },
    ],
    // the corridor table reads this; the real module exports it
    BRIDGE_ALPHA3_TO_ALPHA2: { DEU: 'DE', ALA: 'AX' },
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
                    id: 'crypto-add',
                    title: 'Crypto',
                    description: 'Usually arrives instantly',
                    icon: 'wallet-outline',
                    path: '/add-money/crypto',
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
// captures the operation the screen asks the gate for, so a test can assert the
// withdraw flow requests the 'withdraw' capability and the add flow 'deposit'.
const mockGateForOp = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => mockUseCapabilities(),
}))
type GateScopeArg = { channel?: string; country?: string } | undefined
function setCapabilities(
    gateKind: string,
    rails: Array<{ status: string; channel?: string; country?: string }>,
    // a per-scope answer, for the case where the screen's country-scoped gate
    // and another read (the ToS guard's unscoped deposit read) disagree
    gateByScope?: (op: string, scope: GateScopeArg) => string
) {
    mockUseCapabilities.mockReturnValue({
        isKycApproved: rails.some((r) => r.status === 'enabled'),
        gateFor: (op: string, scope: GateScopeArg) => {
            mockGateForOp(op, scope)
            return { kind: gateByScope?.(op, scope) ?? gateKind }
        },
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
// one stable reference, as React Query hands out: a submit tells "the context
// has rendered a newer user" apart from "the same user" by identity
let mockAuthUser: unknown = { accounts: [] }
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockAuthUser, fetchUser: mockFetchUser }),
}))
// The submit resolves its gate from the profile the fetch returns, through the
// real deriveGate — so a fetched profile says what its own bank rail allows.
const enabledUsBankRail = { id: 'bridge.us', provider: 'bridge', channel: 'bank', country: 'US', status: 'enabled' }
const fetchedProfile = (accounts: unknown[] = [], rails: unknown[] = [enabledUsBankRail]) => ({
    accounts,
    capabilities: { rails, nextActions: [], restrictions: [] },
    identityVerification: { status: rails.length > 0 ? 'verified' : 'pending' },
})
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
// useTosGuard is real: its own unscoped deposit read is what the ToS regressions below exercise
let mockCooldown: { retryAt?: string } | null = null
const mockDismissCooldown = jest.fn()
beforeEach(() => {
    mockCooldown = null
    mockDismissCooldown.mockClear()
})
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: jest.fn(),
        handleSelfHealResubmit: jest.fn(),
        isLoading: false,
        error: null,
        errorCooldown: mockCooldown,
        dismissErrorCooldown: mockDismissCooldown,
        showWrapper: false,
    }),
}))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/hooks/useGetDeviceType', () => ({
    DeviceType: { IOS: 'IOS', ANDROID: 'ANDROID', WEB: 'WEB' },
    useDeviceType: () => ({ deviceType: 'WEB' }),
}))
// the bank intent hook reads residence restrictions; default to unrestricted
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/app/actions/users', () => ({ addBankAccount: jest.fn() }))
jest.mock('@/utils/native-routes', () => ({
    rewriteMethodPath: jest.requireActual('@/utils/native-routes').rewriteMethodPath,
    withdrawBankUrl: (p: string, qs: string = '') => `/withdraw/${p}/bank${qs}`,
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false, isAndroidNative: () => false }))
jest.mock('@/utils/color.utils', () => ({ getColorForUsername: () => ({ lightShade: '#fff' }) }))
jest.mock('@/utils/withdraw.utils', () => ({ getCountryCodeForWithdraw: (id: string) => id }))
// bridge.utils + regions.utils are direct util collaborators that transitively
// pull the heavy @/components/AddMoney/consts barrel (regions.utils computes a
// top-level `Object.values(BRIDGE_ALPHA3_TO_ALPHA2)` at import time, which throws
// under jest when consts is stubbed). The gate is mocked, so neither return value
// affects these assertions — stub both so the real consts is never evaluated.
// The country's live withdraw rails decide whether the rail list was skipped
// on the way in. `null` keeps the real table, so only the test that needs a
// multi-rail country pays for the mock.
let mockLiveRails: unknown[] | null = null
jest.mock('@/features/destinations/country-rails', () => {
    const actual = jest.requireActual('@/features/destinations/country-rails')
    return {
        ...actual,
        liveRailsForCountry: (...args: unknown[]) =>
            mockLiveRails ?? (actual.liveRailsForCountry as (...a: unknown[]) => unknown)(...args),
    }
})

jest.mock('@/utils/bridge.utils', () => ({ railJurisdictionForBank: () => 'US' }))
jest.mock('@/utils/regions.utils', () => ({ getBankRegionIntent: () => 'STANDARD' }))

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
    default: ({ onPrev }: { onPrev: () => void }) => (
        <button data-testid="nav-header" onClick={onPrev}>
            Back
        </button>
    ),
}))
jest.mock('@/components/Global/Badges/Badge', () => ({
    __esModule: true,
    default: (props: any) => <span data-testid="status-badge">{props.customText ?? props.status}</span>,
}))
// the row spinner a held tap shows, and the "please wait" modal a wait-only gate opens
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="row-loading" /> }))
jest.mock('@/components/Kyc/KycReverificationPendingModal', () => ({
    KycReverificationPendingModal: (props: { isOpen: boolean }) =>
        props.isOpen ? <div data-testid="wait-modal" /> : null,
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
jest.mock('@/components/Global/TokenAndNetworkConfirmationDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('@/components/Kyc/KycVerificationInProgressModal', () => ({ KycVerificationInProgressModal: () => null }))
jest.mock('@/components/Global/IframeWrapper', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: { visible: boolean; reasonCode?: string }) =>
        props.visible ? <div data-testid="bridge-tos-step" data-reason={props.reasonCode} /> : null,
}))
jest.mock('@/components/Kyc/ProvideEmailStep', () => ({
    __esModule: true,
    default: (props: any) => (props.visible ? <div data-testid="provide-email-sheet" /> : null),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: any) =>
        props.visible && !props.cooldownActive ? (
            <div data-testid="initiate-kyc-modal" data-variant={props.variant} data-reason={props.reasonCode}>
                {props.providerMessage}
            </div>
        ) : null,
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

        // rail chosen → the bank-account form, named in the URL. The amount
        // step comes after the destination now (TASK-22589).
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
    })

    it('withdraw flow: a non-ready gate blocks form submission and surfaces KYC', async () => {
        setCapabilities('needs-identity', [])
        // the submit gates on the profile it re-fetches: no rail, identity not verified
        mockFetchUser.mockResolvedValueOnce(fetchedProfile([], []))

        render(<AddWithdrawCountriesList flow="withdraw" />)

        await act(async () => {
            await mockBankFormProps.mock.calls.at(-1)?.[0].onSuccess({}, {})
        })
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

/*
 * Crypto is offered before the country is picked — the Add drawer on home, the
 * crypto row above the withdraw country list — and it does the same thing in
 * every country. Repeating it inside a country's list made the user answer a
 * question they had already answered.
 */
describe('AddWithdrawCountriesList — crypto is offered once per flow', () => {
    beforeEach(() => {
        mockPush.mockClear()
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    it('leaves crypto out of a country\u2019s add list while keeping the country\u2019s own rails', () => {
        render(<AddWithdrawCountriesList flow="add" />)

        expect(screen.queryByTestId('method-crypto')).toBeNull()
        expect(screen.getByTestId('method-bank')).toBeInTheDocument()
        expect(screen.getByTestId('method-pix')).toBeInTheDocument()
    })

    it('leaves the withdraw entry untouched — its sole rail still skips the list', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(screen.getByTestId('bank-form')).toBeInTheDocument()
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
        mockNuqsParams = { step: 'form', amount: '50' }
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    afterEach(() => {
        mockUrlAmount = ''
        mockNuqsParams = {}
    })

    it('withdraw flow: a typed account that already exists selects it and carries on to the amount step', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)

        // ?step=form names the screen — the amount no longer implies it
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()
        const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
            onExistingAccount?: (account: unknown) => void
        }
        expect(typeof props.onExistingAccount).toBe('function')

        const existing = { id: 'acct-1', identifier: 'de89370400440532013000', type: 'iban' }
        props.onExistingAccount!(existing)

        // the account becomes the withdraw flow's destination…
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(existing)
        // …and the amount step is what comes next (TASK-22589: amount last)
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount&amount=50')
    })

    it('an old ?amount= link with no named step still opens the bank form', async () => {
        mockNuqsParams = { amount: '50' }
        render(<AddWithdrawCountriesList flow="withdraw" />)

        await waitFor(() => expect(screen.getByTestId('bank-form')).toBeInTheDocument())
    })

    // The screen was called `?view=form` for one release before the flow
    // adopted `?step=`, the name every other flow uses. Those links still land.
    it('an old ?view=form link still opens the bank form', async () => {
        mockNuqsParams = { view: 'form' }
        render(<AddWithdrawCountriesList flow="withdraw" />)

        await waitFor(() => expect(screen.getByTestId('bank-form')).toBeInTheDocument())
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
        mockNuqsParams = { step: 'form', amount: '50' }
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
        ;(addBankAccount as jest.Mock).mockResolvedValue({ data: { id: newAccount.id } })
        // the refetched user carries the freshly added account
        mockFetchUser.mockResolvedValue(fetchedProfile([newAccount]))
    })

    afterEach(() => {
        mockUrlAmount = ''
        mockNuqsParams = {}
        mockSearchParams = new URLSearchParams()
        ;(addBankAccount as jest.Mock).mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(undefined)
    })

    it('withdraw flow: the added account becomes the destination and the push goes to the amount step', async () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()

        const result = await submitForm()

        expect(result).toEqual({})
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(newAccount)
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount&amount=50')
    })

    it('entered from the send flow, the method marker rides along with the amount', async () => {
        mockSearchParams = new URLSearchParams('method=bank')
        render(<AddWithdrawCountriesList flow="withdraw" />)

        const result = await submitForm()

        expect(result).toEqual({})
        expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(newAccount)
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount&method=bank&amount=50')
    })
})

describe('restart cooldown in add and withdraw flows', () => {
    it.each(['add', 'withdraw'] as const)('shows the shared dated cooldown for %s', (flow) => {
        mockCooldown = { retryAt: '2026-09-08T18:57:00Z' }
        render(<AddWithdrawCountriesList flow={flow} />)
        expect(screen.getByText('Give it a little time')).toBeInTheDocument()
        expect(screen.getByText(/You can try again after/)).toHaveTextContent(/Sep 8/)
        expect(screen.queryByText('Too many requests')).not.toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText("I'll try later"))
        expect(mockDismissCooldown).toHaveBeenCalledTimes(1)
    })
})

it('closing a cooldown also closes the underlying bank initiation prompt', async () => {
    setCapabilities('needs-identity', [])
    const { rerender } = render(<AddWithdrawCountriesList flow="add" />)
    fireEvent.click(screen.getByTestId('method-bank'))
    expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
    mockCooldown = { retryAt: '2026-09-08T18:57:00Z' }
    rerender(withProviders(<AddWithdrawCountriesList flow="add" />))
    expect(screen.queryByTestId('initiate-kyc-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText("I'll try later"))
    mockCooldown = null
    rerender(withProviders(<AddWithdrawCountriesList flow="add" />))
    expect(screen.queryByTestId('initiate-kyc-modal')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText("I'll try later")).not.toBeInTheDocument())
})

describe('bank country back navigation', () => {
    afterEach(() => {
        mockSearchParams = new URLSearchParams()
    })
    it.each(['', 'method=bank'])('returns to the country list while preserving the bank origin (%s)', (query) => {
        mockSearchParams = new URLSearchParams(query)
        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('nav-header'))
        // the plain withdraw path names the rail it came back from, so the
        // chooser does not offer crypto again (QA round 2, Q1)
        expect(mockPush).toHaveBeenCalledWith(
            query ? '/withdraw?showAll=true&method=bank' : '/withdraw?showAll=true&rail=bank'
        )
        expect(mockSetSelectedMethod).toHaveBeenCalledWith(null)
    })
})

/**
 * The bank form can be reached without passing the rail list: a country with
 * one live rail skips it, and a refresh or a shared `?step=form` link starts
 * there. Flow memory does not survive either, so the screen has to stand on
 * its own — both on the way out and on the way back.
 */
describe('AddWithdrawCountriesList — the bank form entered cold', () => {
    beforeEach(() => {
        mockPush.mockClear()
        mockSetSelectedMethod.mockClear()
        mockSetSelectedBankAccount.mockClear()
        mockBankFormProps.mockClear()
        mockNuqsParams = { step: 'form' }
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
        ;(addBankAccount as jest.Mock).mockResolvedValue({ data: { id: 'acct-new' } })
        mockFetchUser.mockResolvedValue(fetchedProfile([{ id: 'acct-new', bridgeAccountId: 'ext-new' }]))
    })

    afterEach(() => {
        mockNuqsParams = {}
        mockLiveRails = null
        ;(addBankAccount as jest.Mock).mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(undefined)
    })

    it('names the bank method before the amount step, so the step guard does not bounce the user back', async () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
            onSuccess: (payload: unknown, rawData: unknown) => Promise<{ error?: string }>
        }
        await act(async () => {
            await props.onSuccess(
                { countryCode: 'US', countryName: 'Testland', accountOwnerName: { firstName: 'Ada', lastName: 'L' } },
                {}
            )
        })

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', countryPath: 'testland', title: 'To Bank' })
        )
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount')
    })

    it('the same applies to an account that already exists', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
            onExistingAccount: (account: unknown) => void
        }
        props.onExistingAccount({ id: 'acct-1' })

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(expect.objectContaining({ type: 'bridge' }))
        expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount')
    })

    it('back returns to the country pick, not the one-row rail list the user never chose', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('nav-header'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw?showAll=true&rail=bank')
    })

    it.each(['', 'bank'])(
        'back does not queue a country-page URL update after leaving the bank form (origin: %s)',
        async (origin) => {
            mockNuqsParams = { step: 'form', amount: '50' }
            mockSearchParams = new URLSearchParams(origin ? 'method=bank' : '')
            mockUrlUpdate.mockClear()
            render(<AddWithdrawCountriesList flow="withdraw" />)

            await act(async () => {
                fireEvent.click(screen.getByTestId('nav-header'))
            })

            expect(mockPush).toHaveBeenCalledWith(
                origin ? '/withdraw?showAll=true&method=bank' : '/withdraw?showAll=true&rail=bank'
            )
            expect(mockUrlUpdate).not.toHaveBeenCalled()
            expect(mockSetSelectedBankAccount).toHaveBeenCalledWith(null)
            mockSearchParams = new URLSearchParams()
        }
    )

    /**
     * A country with more than one rail HAS a rail list to go back to, and the
     * screen is named by `step` now. Clearing `view` alone left the user on
     * the same form, pressing back with nothing happening.
     */
    it('back leaves the form for the rail list when the country has more than one rail', async () => {
        mockLiveRails = [
            { id: 'testland-default-bank-withdraw', title: 'To Bank' },
            { id: 'testland-cash-withdraw', title: 'Cash' },
        ]
        render(<AddWithdrawCountriesList flow="withdraw" />)
        expect(screen.getByTestId('bank-form')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('nav-header'))

        await waitFor(() => expect(screen.queryByTestId('bank-form')).not.toBeInTheDocument())
        expect(mockPush).not.toHaveBeenCalled()
    })
})

it('a direct Manteca country link preserves the send marker and incoming amount', () => {
    const { COUNTRY_SPECIFIC_METHODS } = jest.requireMock('@/components/AddMoney/consts')
    const rail = COUNTRY_SPECIFIC_METHODS.US.withdraw[0]
    const previousPath = rail.path
    mockSearchParams = new URLSearchParams('method=bank')
    mockUrlAmount = '50'
    rail.path = '/withdraw/manteca?method=bank-transfer&country=argentina'
    try {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        expect(mockPush).toHaveBeenCalledWith(
            '/withdraw/manteca?method=bank-transfer&country=argentina&sendMethod=bank&amount=50'
        )
    } finally {
        rail.path = previousPath
        mockSearchParams = new URLSearchParams()
        mockUrlAmount = ''
    }
})

// The screen serves both flows off one component. Gating a withdrawal against
// the deposit capability wrongly blocks a withdraw-enabled/deposit-blocked user.
describe('AddWithdrawCountriesList — gates on the flow it is running', () => {
    beforeEach(() => {
        mockGateForOp.mockClear()
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    // the country-scoped read is the screen's own; the ToS guard's unscoped
    // deposit read (no country) is not the screen asking
    const countryScoped = expect.objectContaining({ country: 'US' })

    it('the withdraw flow asks the gate for the withdraw capability, never deposit', () => {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        expect(mockGateForOp).toHaveBeenCalledWith('withdraw', countryScoped)
        expect(mockGateForOp).not.toHaveBeenCalledWith('deposit', countryScoped)
    })

    it('the add flow asks the gate for the deposit capability', () => {
        render(<AddWithdrawCountriesList flow="add" />)
        expect(mockGateForOp).toHaveBeenCalledWith('deposit', countryScoped)
        expect(mockGateForOp).not.toHaveBeenCalledWith('withdraw', expect.anything())
    })
})

// A multi-rail country shows the rail list; clicking its Manteca rail must carry
// the send origin in the dedicated `sendMethod` param. The rail path already
// holds a `method=<rail>`, so a second `method=bank` would lose to the first and
// exit Back to Withdraw instead of Send.
it('a Manteca rail clicked from a multi-rail list forwards the send origin as sendMethod', () => {
    const { COUNTRY_SPECIFIC_METHODS } = jest.requireMock('@/components/AddMoney/consts')
    const previousWithdraw = COUNTRY_SPECIFIC_METHODS.US.withdraw
    mockSearchParams = new URLSearchParams('method=bank')
    // two live rails so the list renders and the single-rail auto-redirect does not fire
    mockLiveRails = [
        { id: 'us-default-bank-withdraw', title: 'To Bank' },
        { id: 'ar-manteca-withdraw', title: 'Cash' },
    ]
    COUNTRY_SPECIFIC_METHODS.US.withdraw = [
        {
            id: 'ar-manteca-withdraw',
            title: 'Cash',
            description: 'Manteca cash-out',
            icon: 'bank',
            isSoon: false,
            path: '/withdraw/ar/manteca?method=bank-transfer',
        },
    ]
    setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    try {
        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('method-cash'))
        expect(mockPush).toHaveBeenCalledWith('/withdraw/ar/manteca?method=bank-transfer&sendMethod=bank')
    } finally {
        COUNTRY_SPECIFIC_METHODS.US.withdraw = previousWithdraw
        mockLiveRails = null
        mockSearchParams = new URLSearchParams()
    }
})

/**
 * The euro area as a destination (QA round 2, Q2).
 *
 * `/withdraw/euro-area` is not a country: it is the euro bank form, reached
 * with no country picked because the IBAN says which country it is. It has no
 * rail list of its own, so the two things that could break are the screen it
 * renders and the button that leaves it.
 */
describe('AddWithdrawCountriesList — the euro area', () => {
    beforeEach(() => {
        mockPush.mockClear()
        mockParams.country = 'euro-area'
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    afterEach(() => {
        mockParams.country = 'testland'
        mockNuqsParams = {}
    })

    it('renders the bank form, never an empty rail list', () => {
        // no ?step=form: a deep link to the destination is still the form
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(mockBankFormProps).toHaveBeenCalled()
        expect(mockBankFormProps.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ country: 'SEPA' }))
    })

    it('back returns to the chooser: there is no rail list to go back to', () => {
        mockNuqsParams = { step: 'form' }
        render(<AddWithdrawCountriesList flow="withdraw" />)

        fireEvent.click(screen.getByTestId('nav-header'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw?showAll=true&rail=bank')
    })
})

/**
 * A URL is not a permission (QA round 3, F9).
 *
 * The bank form rendered for `?step=form` on ANY country, so a hand-edited URL
 * reached a form whose submit can only fail with "unsupported country". The
 * review page one step later already refuses the same URL
 * (`useBridgeOfframpFlow.ts:188-195`); this mirrors that guard at the form.
 */
describe('AddWithdrawCountriesList — the form refuses a country with no bank corridor', () => {
    beforeEach(() => {
        mockPush.mockClear()
        mockBankFormProps.mockClear()
        mockNuqsParams = { step: 'form' }
        setCapabilities('ready', [{ status: 'enabled', channel: 'bank', country: 'US' }])
    })

    afterEach(() => {
        mockParams.country = 'testland'
        mockNuqsParams = {}
        mockSearchParams = new URLSearchParams()
    })

    it('sends a hand-edited URL back to the chooser instead of an uncompletable form', () => {
        mockParams.country = 'nocorridor'
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(mockPush).toHaveBeenCalledWith('/withdraw')
        expect(mockBankFormProps).not.toHaveBeenCalled()
    })

    it('keeps the Send origin when it turns one away', () => {
        mockParams.country = 'nocorridor'
        mockSearchParams = new URLSearchParams('method=bank')
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(mockPush).toHaveBeenCalledWith('/withdraw?method=bank')
    })

    it('the euro area is a corridor, not a country, and still opens', () => {
        mockParams.country = 'euro-area'
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(mockBankFormProps).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('Åland still opens: it is paid over SEPA like Finland', () => {
        mockParams.country = 'aland'
        render(<AddWithdrawCountriesList flow="withdraw" />)

        expect(mockBankFormProps).toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

/**
 * A tap made before capabilities have answered (TASK-22153).
 *
 * The bank gate reads `loading` until the user query settles. The rail click
 * and the form submit both used to return early on it with nothing on screen:
 * the tap looked ignored, and a second one was needed once the answer was in.
 * Now the tap is held where it was made — the row shows the wait, the submit
 * button keeps its spinner — and runs once, when the gate has answered: on to
 * the destination when ready, into the existing block otherwise.
 */
describe('AddWithdrawCountriesList — a tap made while capabilities are still loading', () => {
    const enabledUs = [{ status: 'enabled', channel: 'bank', country: 'US' }]
    // two live rails, so the withdraw flow shows its rail list instead of
    // skipping straight to the form
    const twoWithdrawRails = [
        { id: 'us-default-bank-withdraw', title: 'To Bank' },
        { id: 'crypto-withdraw', title: 'Crypto' },
    ]
    const cryptoRail = {
        id: 'crypto-withdraw',
        title: 'Crypto',
        description: 'To a wallet or exchange',
        icon: 'wallet-outline',
        isSoon: false,
        path: '/withdraw/crypto',
    }
    const { COUNTRY_SPECIFIC_METHODS } = jest.requireMock('@/components/AddMoney/consts')
    let previousWithdraw: Array<Record<string, unknown>>

    beforeEach(() => {
        mockPush.mockClear()
        mockSetSelectedMethod.mockClear()
        mockSetSelectedBankAccount.mockClear()
        mockBankFormProps.mockClear()
        mockUrlUpdate.mockClear()
        previousWithdraw = COUNTRY_SPECIFIC_METHODS.US.withdraw
        setCapabilities('loading', [])
    })

    afterEach(() => {
        COUNTRY_SPECIFIC_METHODS.US.withdraw = previousWithdraw
        mockLiveRails = null
        mockNuqsParams = {}
        ;(addBankAccount as jest.Mock).mockReset()
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(undefined)
    })

    const settle = (rerender: (ui: React.ReactElement) => void, flow: 'add' | 'withdraw', kind: string) => {
        setCapabilities(kind, kind === 'ready' ? enabledUs : [])
        rerender(withProviders(<AddWithdrawCountriesList flow={flow} />))
    }

    it('add flow, cold: the tapped row shows the wait, then continues on its own once the gate is ready', () => {
        const { rerender } = render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        // registered, not dropped: the row is waiting, nothing navigated, no modal
        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
        expect(within(screen.getByTestId('method-bank')).getByTestId('row-loading')).toBeInTheDocument()
        expect(screen.getByTestId('method-bank')).toBeDisabled()

        settle(rerender, 'add', 'ready')

        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('/add-money/testland/bank')
        expect(screen.queryByTestId('row-loading')).toBeNull()
    })

    it('add flow: a gate that settles blocked opens the existing block instead of dropping the tap', () => {
        const { rerender } = render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        settle(rerender, 'add', 'needs-identity')

        expect(mockPush).not.toHaveBeenCalled()
        expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
        expect(screen.queryByTestId('row-loading')).toBeNull()
    })

    it('repeated taps on the waiting row produce one transition', () => {
        const { rerender } = render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))
        fireEvent.click(screen.getByTestId('method-bank'))
        fireEvent.click(screen.getByTestId('method-bank'))

        settle(rerender, 'add', 'ready')

        expect(mockPush).toHaveBeenCalledTimes(1)
    })

    it('a tap on another row replaces the held one, so the old selection never runs', () => {
        const { rerender } = render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))
        fireEvent.click(screen.getByTestId('method-pix'))

        expect(within(screen.getByTestId('method-pix')).getByTestId('row-loading')).toBeInTheDocument()
        expect(within(screen.getByTestId('method-bank')).queryByTestId('row-loading')).toBeNull()

        settle(rerender, 'add', 'ready')

        expect(mockPush).toHaveBeenCalledTimes(1)
        expect(mockPush).toHaveBeenCalledWith('/add-money/brazil/manteca')
    })

    it('withdraw flow: the bank rail is held, then opens the bank form once the gate is ready', async () => {
        mockLiveRails = twoWithdrawRails
        COUNTRY_SPECIFIC_METHODS.US.withdraw = [...previousWithdraw, cryptoRail]
        const { rerender } = render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('method-to bank'))

        expect(screen.queryByTestId('bank-form')).toBeNull()
        expect(within(screen.getByTestId('method-to bank')).getByTestId('row-loading')).toBeInTheDocument()

        settle(rerender, 'withdraw', 'ready')

        expect(mockSetSelectedMethod).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'bridge', title: 'To Bank' })
        )
        await waitFor(() => expect(screen.getByTestId('bank-form')).toBeInTheDocument())
    })

    it('withdraw flow: a rail that needs no bank capability is not held back by the gate', () => {
        mockLiveRails = twoWithdrawRails
        COUNTRY_SPECIFIC_METHODS.US.withdraw = [...previousWithdraw, cryptoRail]
        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('method-crypto'))

        expect(mockPush).toHaveBeenCalledWith('/withdraw/crypto')
        expect(screen.queryByTestId('row-loading')).toBeNull()
    })

    /**
     * The selected country's withdraw rail needs terms while another deposit
     * rail is ready. The ToS guard's unscoped deposit read says ready; the step
     * opens on the country-scoped verdict this screen resolved.
     */
    it('withdraw flow: the selected country needs terms although a deposit rail is ready — the terms step opens', () => {
        mockLiveRails = twoWithdrawRails
        COUNTRY_SPECIFIC_METHODS.US.withdraw = [...previousWithdraw, cryptoRail]
        setCapabilities('ready', enabledUs, (op, scope) =>
            op === 'withdraw' && scope?.country === 'US' ? 'accept-tos' : 'ready'
        )
        render(<AddWithdrawCountriesList flow="withdraw" />)
        fireEvent.click(screen.getByTestId('method-to bank'))

        expect(screen.getByTestId('bridge-tos-step')).toBeInTheDocument()
        expect(screen.queryByTestId('bank-form')).toBeNull()
        expect(mockSetSelectedMethod).not.toHaveBeenCalled()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('a wait-only gate says so instead of dropping the tap', () => {
        setCapabilities('waiting-on-provider', [])
        render(<AddWithdrawCountriesList flow="add" />)
        fireEvent.click(screen.getByTestId('method-bank'))

        expect(screen.getByTestId('wait-modal')).toBeInTheDocument()
        expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
        expect(mockPush).not.toHaveBeenCalled()
    })

    /**
     * The submit answers from the profile it fetches, and belongs to the
     * screen it was made on. A fetch that brings no profile waits for a render
     * whose gate has settled. Leaving the screen — back, another country in
     * the same mount (the native `?country=` path), unmount — stops the submit
     * at its next await and settles it silently, so the form's spinner resets.
     */
    describe('the bank form submitted while the gate is loading', () => {
        const payload = {
            countryCode: 'US',
            countryName: 'Testland',
            accountOwnerName: { firstName: 'Ada', lastName: 'Lovelace' },
        }
        const cancelled = { error: 'cancelled', silent: true }
        const newAccount = { id: 'acct-new', bridgeAccountId: 'ext-new' }

        beforeEach(() => {
            mockNuqsParams = { step: 'form' }
            ;(addBankAccount as jest.Mock).mockResolvedValue({ data: newAccount })
            mockFetchUser.mockResolvedValue(fetchedProfile([newAccount]))
        })

        afterEach(() => {
            mockParams.country = 'testland'
            mockAuthUser = { accounts: [] }
        })

        const submit = () => {
            const props = mockBankFormProps.mock.calls.at(-1)?.[0] as {
                onSuccess: (payload: unknown, rawData: unknown) => Promise<{ error?: string; silent?: boolean }>
            }
            return props.onSuccess(payload, {})
        }
        // a fetch the test finishes by hand
        const deferFetch = () => {
            let finish: (profile: unknown) => void = () => {}
            mockFetchUser.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
            return (profile: unknown) => finish(profile)
        }

        it('loading at render, the fetch answers ready: adds the account once, with no re-render needed', async () => {
            render(<AddWithdrawCountriesList flow="withdraw" />)
            const result = submit()
            await act(async () => {
                await expect(result).resolves.toEqual({})
            })

            // the gating refresh is strict: a failed refresh must reject, not hand back the cache
            expect(mockFetchUser).toHaveBeenNthCalledWith(1, { throwOnError: true })
            expect(addBankAccount).toHaveBeenCalledTimes(1)
            expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount')
        })

        it('the refresh fails while the render says ready: a visible error, nothing sent from the cache', async () => {
            setCapabilities('ready', enabledUs)
            mockFetchUser.mockRejectedValueOnce(new Error('Failed to fetch'))
            render(<AddWithdrawCountriesList flow="withdraw" />)

            const result = submit()
            await act(async () => {
                await expect(result).resolves.toEqual({
                    error: 'Something went wrong. Please try again or contact support.',
                })
            })

            expect(addBankAccount).not.toHaveBeenCalled()
            expect(mockSetSelectedBankAccount).not.toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
            expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
            expect(screen.queryByTestId('wait-modal')).toBeNull()
        })

        it('back while the refresh is failing: the submit settles cancelled, with no error on a screen that is gone', async () => {
            mockLiveRails = twoWithdrawRails
            let fail: (error: Error) => void = () => {}
            mockFetchUser.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
            render(<AddWithdrawCountriesList flow="withdraw" />)
            const result = submit()

            await act(async () => {
                fireEvent.click(screen.getByTestId('nav-header'))
            })
            await waitFor(() => expect(screen.queryByTestId('bank-form')).not.toBeInTheDocument())

            await act(async () => {
                fail(new Error('Failed to fetch'))
                await expect(result).resolves.toEqual(cancelled)
            })
            expect(addBankAccount).not.toHaveBeenCalled()
        })

        it('ready at render, the fetch answers blocked: the fetched answer wins over the stale render', async () => {
            setCapabilities('ready', enabledUs)
            mockFetchUser.mockResolvedValue(fetchedProfile([], []))
            render(<AddWithdrawCountriesList flow="withdraw" />)

            const result = submit()
            await act(async () => {
                await expect(result).resolves.toEqual({ error: 'gate_blocked', silent: true })
            })

            expect(addBankAccount).not.toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
            expect(screen.getByTestId('initiate-kyc-modal')).toBeInTheDocument()
        })

        // The refresh answers null for an expired session or a failed request.
        // There is no profile to gate on, so nothing is sent — and the form
        // says so, rather than resting on whatever the render last said.
        it.each([
            ['ready', enabledUs],
            ['loading', []],
        ])(
            'the refresh brings no profile while the render says %s: a visible error, nothing sent',
            async (kind, rails) => {
                setCapabilities(kind, rails)
                mockFetchUser.mockResolvedValue(null)
                render(<AddWithdrawCountriesList flow="withdraw" />)

                const result = submit()
                await act(async () => {
                    await expect(result).resolves.toEqual({
                        error: 'Something went wrong. Please try again or contact support.',
                    })
                })

                expect(addBankAccount).not.toHaveBeenCalled()
                expect(mockSetSelectedBankAccount).not.toHaveBeenCalled()
                expect(mockPush).not.toHaveBeenCalled()
                expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
                expect(screen.queryByTestId('wait-modal')).toBeNull()
            }
        )

        /**
         * The fetched verdict is what blocked the submit, so it is what the
         * blocker shows — even while the context still renders the older
         * `ready` user. The override lasts until the context renders a newer
         * user, then the context gate carries on.
         */
        describe('a blocker from the fetched verdict, before the context has caught up', () => {
            const waitRail = {
                ...enabledUsBankRail,
                status: 'requires-info',
                blockingActions: ['wait:review'],
                reason: { code: 'under_review', userMessage: 'We are reviewing your details.' },
            }
            const pendingRail = { ...enabledUsBankRail, status: 'pending' }
            const blockedRail = {
                ...enabledUsBankRail,
                status: 'blocked',
                reason: { code: 'account_closed', userMessage: 'This account was closed by the provider.' },
            }
            const profileWith = (rail: unknown, nextActions: unknown[] = []) => ({
                ...fetchedProfile([], [rail]),
                capabilities: { rails: [rail], nextActions, restrictions: [] },
            })

            beforeEach(() => {
                setCapabilities('ready', enabledUs)
            })

            it('ready → pending: the wait modal shows from the fetched verdict', async () => {
                mockFetchUser.mockResolvedValue(profileWith(pendingRail))
                render(<AddWithdrawCountriesList flow="withdraw" />)

                await act(async () => {
                    await expect(submit()).resolves.toEqual({ error: 'gate_blocked', silent: true })
                })

                expect(screen.getByTestId('wait-modal')).toBeInTheDocument()
                expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
                expect(addBankAccount).not.toHaveBeenCalled()
            })

            it('ready → waiting-on-provider: the wait modal shows from the fetched verdict', async () => {
                mockFetchUser.mockResolvedValue(profileWith(waitRail, [{ key: 'wait:review', kind: 'wait' }]))
                render(<AddWithdrawCountriesList flow="withdraw" />)

                await act(async () => {
                    await expect(submit()).resolves.toEqual({ error: 'gate_blocked', silent: true })
                })

                expect(screen.getByTestId('wait-modal')).toBeInTheDocument()
                expect(addBankAccount).not.toHaveBeenCalled()
            })

            /**
             * The ToS guard's own read is the unscoped deposit gate, which still
             * says ready here. The step opens on the verdict this screen resolved.
             */
            it('ready → accept-tos from the fetched profile: the terms step opens, account unsent', async () => {
                const tosRail = {
                    ...enabledUsBankRail,
                    status: 'requires-info',
                    blockingActions: ['tos:bridge'],
                    reason: { code: 'tos_required', userMessage: 'Accept the terms to continue.' },
                }
                mockFetchUser.mockResolvedValue(
                    profileWith(tosRail, [{ key: 'tos:bridge', kind: 'accept-tos', tosUrl: 'https://tos.example' }])
                )
                render(<AddWithdrawCountriesList flow="withdraw" />)

                await act(async () => {
                    await expect(submit()).resolves.toEqual({ error: 'gate_blocked', silent: true })
                })

                expect(screen.getByTestId('bridge-tos-step')).toHaveAttribute('data-reason', 'tos_required')
                expect(screen.queryByTestId('initiate-kyc-modal')).toBeNull()
                expect(addBankAccount).not.toHaveBeenCalled()
                expect(mockSetSelectedBankAccount).not.toHaveBeenCalled()
                expect(mockPush).not.toHaveBeenCalled()
            })

            it('ready → blocked-rejection: the KYC modal presents the reason of the gate that blocked', async () => {
                mockFetchUser.mockResolvedValue(profileWith(blockedRail))
                render(<AddWithdrawCountriesList flow="withdraw" />)

                await act(async () => {
                    await expect(submit()).resolves.toEqual({ error: 'gate_blocked', silent: true })
                })

                const modal = screen.getByTestId('initiate-kyc-modal')
                expect(modal).toHaveAttribute('data-variant', 'blocked')
                expect(modal).toHaveAttribute('data-reason', 'account_closed')
                expect(modal).toHaveTextContent('This account was closed by the provider.')
            })

            it('the override ends when the context renders a newer user, and the context gate carries on', async () => {
                const pendingProfile = profileWith(pendingRail)
                mockFetchUser.mockResolvedValue(pendingProfile)
                const { rerender } = render(<AddWithdrawCountriesList flow="withdraw" />)
                await act(async () => {
                    await submit()
                })
                expect(screen.getByTestId('wait-modal')).toBeInTheDocument()

                // the context catches up with the same verdict: still waiting
                mockAuthUser = pendingProfile
                settle(rerender, 'withdraw', 'pending')
                expect(screen.getByTestId('wait-modal')).toBeInTheDocument()

                // remediation lands: the context says ready, and nothing stale keeps the wait on screen
                mockAuthUser = fetchedProfile()
                settle(rerender, 'withdraw', 'ready')
                expect(screen.queryByTestId('wait-modal')).toBeNull()
            })
        })

        it('back during the fetch: the submit settles cancelled and the answer that arrives later sends nothing', async () => {
            mockLiveRails = twoWithdrawRails
            const finishFetch = deferFetch()
            render(<AddWithdrawCountriesList flow="withdraw" />)
            const result = submit()

            // back to the rail list while the fetch is still out
            await act(async () => {
                fireEvent.click(screen.getByTestId('nav-header'))
            })
            await waitFor(() => expect(screen.queryByTestId('bank-form')).not.toBeInTheDocument())

            await act(async () => {
                finishFetch(fetchedProfile([newAccount]))
                await expect(result).resolves.toEqual(cancelled)
            })

            expect(addBankAccount).not.toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
        })

        it('another country in the same mount cancels the old submit, and a fresh one on the new country goes through', async () => {
            const finishFetch = deferFetch()
            const { rerender } = render(<AddWithdrawCountriesList flow="withdraw" />)
            const stale = submit()

            // the native path: the country arrives as a query change, the form stays mounted
            mockParams.country = 'aland'
            rerender(withProviders(<AddWithdrawCountriesList flow="withdraw" />))
            expect(mockBankFormProps.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ country: 'ALA' }))

            await act(async () => {
                finishFetch(fetchedProfile([newAccount]))
                await expect(stale).resolves.toEqual(cancelled)
            })
            expect(addBankAccount).not.toHaveBeenCalled()

            // a new submit on the new country is not held back by the cancelled one
            const fresh = submit()
            await act(async () => {
                await expect(fresh).resolves.toEqual({})
            })
            expect(addBankAccount).toHaveBeenCalledTimes(1)
            expect(mockPush).toHaveBeenCalledWith('/withdraw?step=amount')
        })

        it('unmount during the fetch: the submit settles cancelled and nothing runs afterwards', async () => {
            const finishFetch = deferFetch()
            const { unmount } = render(<AddWithdrawCountriesList flow="withdraw" />)
            const result = submit()

            unmount()
            await act(async () => {
                finishFetch(fetchedProfile([newAccount]))
                await expect(result).resolves.toEqual(cancelled)
            })
            expect(addBankAccount).not.toHaveBeenCalled()
            expect(mockPush).not.toHaveBeenCalled()
            expect(mockSetSelectedBankAccount).not.toHaveBeenCalled()
        })
    })
})
