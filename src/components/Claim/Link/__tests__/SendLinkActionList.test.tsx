/**
 * SendLinkActionList — who sees the alternate claim rails, and how the bank
 * option behaves once they do.
 *
 * The rails exist for a recipient with no Peanut account; a device we can
 * identify as a Peanut user's (live session or an earlier registration) gets
 * the Peanut option alone.
 *
 * On the rails themselves, the GUEST claim-to-bank off-ramp is under
 * maintenance (BE 503s POST /bridge/offramp/create-for-guest): the bank method
 * must render greyed + "Soon!" and be non-interactive when the claim resolves
 * to GuestBankClaim, while UserBankClaim stays fully clickable.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

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

jest.mock('@/context/tokenSelector.context', () => ({
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

// Device recognition — null while the storage reads are in flight.
let mockKnownDevice: boolean | null = false
jest.mock('@/hooks/useKnownPeanutDevice', () => ({
    useKnownPeanutDevice: () => mockKnownDevice,
}))

// ---------- import component under test AFTER mocks ----------
import SendLinkActionList from '../SendLinkActionList'

const claimLinkData = {
    amount: BigInt(10000000), // 10 USDC — above the $5 bank minimum
    tokenDecimals: 6,
    sender: { userId: 'sender-123', username: 'alice' },
} as any

function renderList({ isLoggedIn = false }: { isLoggedIn?: boolean } = {}) {
    return render(
        <IntlWrapper>
            <SendLinkActionList claimLinkData={claimLinkData} isLoggedIn={isLoggedIn} isInviteLink={false} />
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimType = 'user-bank-claim'
    mockKnownDevice = false
})

describe('SendLinkActionList — who gets the alternate rails', () => {
    test('an unrecognised recipient keeps every rail, so a bank claim needs no account', () => {
        renderList()

        expect(screen.getByText('Bank')).toBeInTheDocument()
        expect(screen.getByText('Exchange or Wallet')).toBeInTheDocument()
    })

    test('a logged-in recipient gets Peanut only', () => {
        renderList({ isLoggedIn: true })

        expect(screen.queryByText('Bank')).not.toBeInTheDocument()
        expect(screen.queryByText('Exchange or Wallet')).not.toBeInTheDocument()
    })

    test('a logged-out device holding credentials gets Peanut only', () => {
        mockKnownDevice = true
        renderList()

        expect(screen.queryByText('Bank')).not.toBeInTheDocument()
    })

    test('nothing is offered before recognition resolves, so no rail is shown then withdrawn', () => {
        mockKnownDevice = null
        renderList()

        expect(screen.queryByText('Bank')).not.toBeInTheDocument()
    })
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

    test('UserBankClaim: the non-guest off-ramp stays interactive (no "Soon!")', () => {
        mockClaimType = 'user-bank-claim'
        renderList()

        expect(screen.queryByText('Soon!')).not.toBeInTheDocument()

        // clicking the enabled bank card enters the bank flow
        fireEvent.click(screen.getByText('Bank'))
        expect(mockSetFlowStep).toHaveBeenCalledWith('bank-country-list')
    })
})
