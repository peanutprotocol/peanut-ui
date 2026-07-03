/* eslint-disable @typescript-eslint/no-explicit-any -- jest.mock factories stub component props with `any`; matches the sibling add-money-states.test.tsx style. */
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
import { render, screen, fireEvent, within } from '@testing-library/react'
import AddWithdrawCountriesList from '../AddWithdrawCountriesList'
import underMaintenanceConfig from '@/config/underMaintenance.config'

// ---- routing ----
const mockPush = jest.fn()
const mockParams: Record<string, string> = { country: 'testland' }
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    useParams: () => mockParams,
    useSearchParams: () => new URLSearchParams(),
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
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { accounts: [] }, fetchUser: jest.fn() }),
}))
jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({
        setSelectedBankAccount: jest.fn(),
        amountToWithdraw: '',
        setSelectedMethod: jest.fn(),
        setAmountToWithdraw: jest.fn(),
    }),
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
    withdrawBankUrl: (p: string) => `/withdraw/${p}`,
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

jest.mock('@/components/ActionListCard', () => ({
    ActionListCard: (props: any) => (
        <button
            data-testid={`method-${props.title?.toLowerCase()}`}
            onClick={props.isDisabled ? undefined : props.onClick}
            disabled={props.isDisabled}
        >
            {props.title}
            {props.rightContent}
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
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({ DynamicBankAccountForm: () => <div /> }))
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

        expect(mockPush).toHaveBeenCalledWith('/withdraw')
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
