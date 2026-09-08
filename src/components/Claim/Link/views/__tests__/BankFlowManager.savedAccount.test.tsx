/**
 * BankFlowManager — saved-account claim path (TASK-22333).
 *
 * Only the country list used to set `selectedCountry`; a saved account skipped
 * it, so the unlock CTA derived a rest-of-world intent. The account is the
 * destination: clicking it must set the country, and the unlock CTA must send
 * the bank intent for it (Mexico → NA, not LATAM). An account whose country
 * cannot be resolved (empty countryCode/countryName — a known prod state) must
 * not clobber a country the user already picked.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { BankFlowManager } from '../BankFlowManager.view'
import { getCountryFromPath } from '@/utils/bridge.utils'

// --- stateful ClaimBankFlow context: re-renders triggered by the component's
// own useState calls read the latest values back
const mockSetSelectedCountry = jest.fn()
const ctx: Record<string, any> = {}
function resetCtx(overrides: Record<string, any> = {}) {
    Object.keys(ctx).forEach((k) => delete ctx[k])
    Object.assign(ctx, {
        flowStep: 'saved-accounts-list',
        setFlowStep: jest.fn((step: string | null) => {
            ctx.flowStep = step
        }),
        selectedCountry: null,
        setSelectedCountry: mockSetSelectedCountry,
        setClaimType: jest.fn(),
        setBankDetails: jest.fn(),
        justCompletedKyc: false,
        setJustCompletedKyc: jest.fn(),
        setShowVerificationModal: jest.fn(),
        ...overrides,
    })
}
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankDetailsForm: 'bank-details-form',
        BankConfirmClaim: 'bank-confirm-claim',
        BankCountryList: 'bank-country-list',
    },
    useClaimBankFlow: () => ctx,
}))

// --- the account under test is injected through the saved-accounts hook
let mockSavedAccounts: any[] = []
jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => mockSavedAccounts }))
jest.mock('@/components/Common/SavedAccountsView', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="saved-accounts">
            {props.savedAccounts.map((account: any) => (
                <button
                    key={account.id}
                    data-testid={`account-${account.id}`}
                    onClick={() => props.onAccountClick(account, '')}
                >
                    {account.id}
                </button>
            ))}
        </div>
    ),
}))

// --- KYC plumbing
const mockHandleInitiateKyc = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: mockHandleInitiateKyc,
        handleRestartIdentity: jest.fn(),
        handleSelfHealResubmit: jest.fn(),
        showWrapper: false,
        isLoading: false,
        error: null,
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => ({ kind: 'needs-enrollment' }) }),
}))
jest.mock('@/utils/capability-gate', () => ({
    getKycModalVariant: () => 'needs_kyc',
    getGateUserMessage: () => undefined,
    getGateReasonCode: () => undefined,
}))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: any) =>
        props.visible ? (
            <button data-testid="kyc-verify-button" onClick={props.onVerify}>
                Verify
            </button>
        ) : null,
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Claim/Link/views/Confirm.bank-claim.view', () => ({
    ConfirmBankClaimView: (props: any) => (
        <button data-testid="confirm-claim" onClick={props.onConfirm}>
            Confirm
        </button>
    ),
}))

// --- everything else the view imports but this path never exercises
jest.mock('@/hooks/useDetermineBankClaimType', () => ({
    BankClaimType: {
        GuestBankClaim: 'guest-bank-claim',
        UserBankClaim: 'user-bank-claim',
        ReceiverKycNeeded: 'receiver-kyc-needed',
        GuestKycNeeded: 'guest-kyc-needed',
    },
    useDetermineBankClaimType: () => ({ claimType: 'user-bank-claim' }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { fullName: 'Ana Perez', email: 'ana@example.com' } }, fetchUser: jest.fn() }),
}))
jest.mock('@/context/loadingStates.context', () => {
    const { createContext } = jest.requireActual('react')
    return { loadingStateContext: createContext({ isLoading: false, setLoadingState: jest.fn() }) }
})
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/Claim/useClaimLink', () => ({ __esModule: true, default: () => ({ claimLink: jest.fn() }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@/app/actions/external-accounts', () => ({ createBridgeExternalAccountForGuest: jest.fn() }))
jest.mock('@/app/actions/offramp', () => ({
    confirmOfframp: jest.fn(),
    createOfframp: jest.fn(),
    createOfframpForGuest: jest.fn(),
}))
jest.mock('@/app/actions/users', () => ({ addBankAccount: jest.fn(), getUserById: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({ formatTokenAmount: (n: number) => String(n) }))
jest.mock('@/utils/bridge-accounts.utils', () => ({
    getBridgeChainName: () => 'arbitrum',
    getBridgeTokenName: () => 'usdc',
}))
jest.mock('@/utils/peanut-link.utils', () => ({ generateKeysFromString: jest.fn(), getParamsFromLink: jest.fn() }))
jest.mock('@/utils/peanut-claim.utils', () => ({ getContractAddress: () => '0x0' }))
jest.mock('@/utils/withdraw.utils', () => ({ getCountryCodeForWithdraw: (id: string) => id }))
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({ DynamicBankAccountForm: () => null }))
jest.mock('@/components/Common/CountryListRouter', () => ({ CountryListRouter: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ badgeCampaignForLegacyWire: () => undefined }))
jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('@/redux/slices/bank-form-slice', () => ({ bankFormActions: {} }))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: {} }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const claimLinkData: any = {
    sender: { userId: 'sender-1' },
    senderAddress: '0xsender',
    amount: 1000000n,
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    chainId: '42161',
    contractVersion: 'v4.3',
}
const clabeAccount = (details: Record<string, string>) => ({
    id: 'acc-mx',
    type: 'clabe',
    identifier: '002010077777777771',
    bridgeAccountId: 'bridge-acc-1',
    details,
})

// the view reads only claimLinkData / onCustom / setTransactionHash off IClaimScreenProps
const props: any = { claimLinkData, onCustom: jest.fn(), setTransactionHash: jest.fn() }

function renderView() {
    return render(<BankFlowManager {...props} />)
}

beforeEach(() => {
    jest.clearAllMocks()
    resetCtx()
})

test('clicking a saved Mexico CLABE account sets selectedCountry to Mexico', async () => {
    mockSavedAccounts = [clabeAccount({ countryCode: 'MEX', countryName: 'mexico', accountOwnerName: 'Ana Perez' })]
    renderView()

    await act(async () => {
        fireEvent.click(screen.getByTestId('account-acc-mx'))
    })

    expect(mockSetSelectedCountry).toHaveBeenCalledWith(expect.objectContaining({ id: 'MX', region: 'latam' }))
})

test('a saved account with no resolvable country does not clobber the country already picked', async () => {
    resetCtx({ selectedCountry: getCountryFromPath('germany') })
    mockSavedAccounts = [clabeAccount({ countryCode: '', countryName: '', accountOwnerName: 'Ana Perez' })]
    renderView()

    await act(async () => {
        fireEvent.click(screen.getByTestId('account-acc-mx'))
    })

    expect(mockSetSelectedCountry).not.toHaveBeenCalled()
})

test('unlock CTA after a saved Mexico account sends the NA intent, not LATAM', async () => {
    // the real context would now hold Mexico (previous test); mirror that here
    resetCtx({ selectedCountry: getCountryFromPath('mexico') })
    mockSavedAccounts = [clabeAccount({ countryCode: 'MEX', countryName: 'mexico', accountOwnerName: 'Ana Perez' })]
    renderView()

    // saved account → confirm step (localBankDetails set) → confirm → gate is
    // needs-enrollment → KYC modal → verify
    await act(async () => {
        fireEvent.click(screen.getByTestId('account-acc-mx'))
    })
    await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-claim'))
    })
    await act(async () => {
        fireEvent.click(screen.getByTestId('kyc-verify-button'))
    })

    expect(mockHandleInitiateKyc.mock.calls[0].slice(0, 3)).toEqual(['NA', undefined, true])
})
