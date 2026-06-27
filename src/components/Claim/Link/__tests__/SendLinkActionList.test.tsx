/**
 * SendLinkActionList — guest claim-to-bank maintenance gating
 *
 * The GUEST claim-to-bank off-ramp is under maintenance (BE 503s
 * POST /bridge/offramp/create-for-guest). The bank method must render greyed +
 * "Soon!" and be non-interactive when the claim resolves to GuestBankClaim,
 * while the authenticated self off-ramp (UserBankClaim) stays fully clickable.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ---------- module-level mocks (before importing the component) ----------

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn() }),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, fill, ...rest } = props
        return <img {...rest} />
    },
}))

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

// Heavy leaf modals / CTAs that are not under test
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: () => null,
}))
jest.mock('../../../Global/ConfirmInviteModal', () => ({
    __esModule: true,
    default: () => null,
}))
jest.mock('../../../Global/SupportCTA', () => ({
    __esModule: true,
    default: () => null,
}))

// Bank claim type — the value under test. `BankClaimType` mirrors the real enum.
let mockClaimType = 'user-bank-claim'
jest.mock('@/hooks/useDetermineBankClaimType', () => ({
    BankClaimType: {
        GuestBankClaim: 'guest-bank-claim',
        UserBankClaim: 'user-bank-claim',
        ReceiverKycNeeded: 'receiver-kyc-needed',
        GuestKycNeeded: 'guest-kyc-needed',
    },
    useDetermineBankClaimType: () => ({ claimType: mockClaimType, setClaimType: jest.fn() }),
}))

const mockSetFlowStep = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankCountryList: 'bank-country-list',
        BankDetailsForm: 'bank-details-form',
        BankConfirmClaim: 'bank-confirm-claim',
    },
    useClaimBankFlow: () => ({
        setClaimToExternalWallet: jest.fn(),
        setFlowStep: mockSetFlowStep,
        setShowVerificationModal: jest.fn(),
        setClaimToMercadoPago: jest.fn(),
        setRegionalMethodType: jest.fn(),
        setHideTokenSelector: jest.fn(),
    }),
}))

jest.mock('@/hooks/useSavedAccounts', () => ({
    __esModule: true,
    default: () => [],
}))

jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ addParamStep: jest.fn() }),
}))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ canDo: () => false }),
}))

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'me', hasAppAccess: true } } }),
}))

jest.mock('@/redux/hooks', () => ({
    useAppDispatch: () => jest.fn(),
}))

jest.mock('@/context', () => ({
    tokenSelectorContext: React.createContext({
        setSelectedTokenAddress: jest.fn(),
        setSelectedChainID: jest.fn(),
        devconnectChainId: '',
        devconnectRecipientAddress: '',
        devconnectTokenAddress: '',
    }),
}))

// Return a fixed method set so the test is independent of geolocation.
const bankMethod = { id: 'bank', title: 'Bank', description: 'EUR, USD, MXN, ARS & more', icons: [], soon: false }
const walletMethod = {
    id: 'exchange-or-wallet',
    title: 'Exchange or Wallet',
    description: 'Binance, Metamask and more',
    icons: [],
    soon: false,
}
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [bankMethod, walletMethod], isLoading: false }),
}))

// ---------- import component under test AFTER mocks ----------
import SendLinkActionList from '../SendLinkActionList'

const claimLinkData = {
    amount: BigInt(10000000), // 10 USDC — above the $5 bank minimum
    tokenDecimals: 6,
    sender: { userId: 'sender-123', username: 'alice' },
} as any

function renderList() {
    return render(<SendLinkActionList claimLinkData={claimLinkData} isLoggedIn isInviteLink={false} />)
}

beforeEach(() => {
    jest.clearAllMocks()
})

describe('SendLinkActionList — guest claim-to-bank maintenance', () => {
    test('GuestBankClaim: bank option is greyed + "Soon!" and non-interactive', () => {
        mockClaimType = 'guest-bank-claim'
        renderList()

        // SOON badge present on the bank option
        expect(screen.getByText('Soon!')).toBeInTheDocument()

        // clicking the disabled bank card does not start the bank flow
        fireEvent.click(screen.getByText('Bank'))
        expect(mockSetFlowStep).not.toHaveBeenCalled()
    })

    test('UserBankClaim: authenticated self off-ramp stays interactive (no "Soon!")', () => {
        mockClaimType = 'user-bank-claim'
        renderList()

        expect(screen.queryByText('Soon!')).not.toBeInTheDocument()

        // clicking the enabled bank card enters the bank flow
        fireEvent.click(screen.getByText('Bank'))
        expect(mockSetFlowStep).toHaveBeenCalledWith('bank-country-list')
    })
})
