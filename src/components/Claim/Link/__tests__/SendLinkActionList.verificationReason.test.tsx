/**
 * SendLinkActionList — which reason the guest-verification modal is given.
 *
 * The modal used to render one hardcoded line for every trigger: "The sender
 * isn't verified for this method." That is unactionable for the claimer even
 * when true, and it is simply wrong on two of the three paths that raise it —
 * a logged-out user tapping MercadoPago/Pix is blocked by their own missing
 * account, and GuestKycNeeded is also reached when the sender lookup 404s or
 * throws, where nothing at all was established about the sender.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

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

jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))

jest.mock('@/components/Global/ActionModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../../../Global/ConfirmInviteModal', () => ({ __esModule: true, default: () => null }))
jest.mock('../../../Global/SupportCTA', () => ({ __esModule: true, default: () => null }))

let mockClaimType = 'guest-kyc-needed'
let mockSenderCanReceiveBankOfframp: boolean | null = null
jest.mock('@/hooks/useDetermineBankClaimType', () => ({
    BankClaimType: {
        GuestBankClaim: 'guest-bank-claim',
        UserBankClaim: 'user-bank-claim',
        ReceiverKycNeeded: 'receiver-kyc-needed',
        GuestKycNeeded: 'guest-kyc-needed',
    },
    useDetermineBankClaimType: () => ({
        claimType: mockClaimType,
        setClaimType: jest.fn(),
        senderCanReceiveBankOfframp: mockSenderCanReceiveBankOfframp,
    }),
}))

const mockSetVerificationPromptReason = jest.fn()
const mockSetShowVerificationModal = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankCountryList: 'bank-country-list',
        BankDetailsForm: 'bank-details-form',
        BankConfirmClaim: 'bank-confirm-claim',
    },
    useClaimBankFlow: () => ({
        setClaimToExternalWallet: jest.fn(),
        setFlowStep: jest.fn(),
        setShowVerificationModal: mockSetShowVerificationModal,
        setVerificationPromptReason: mockSetVerificationPromptReason,
        setClaimToMercadoPago: jest.fn(),
        setRegionalMethodType: jest.fn(),
        setHideTokenSelector: jest.fn(),
    }),
}))

jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))
jest.mock('../../useClaimLink', () => ({ __esModule: true, default: () => ({ addParamStep: jest.fn() }) }))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ canDo: () => true }) }))

// logged OUT — the state that makes the regional path raise the modal
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))

jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => jest.fn() }))

jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({
        setSelectedTokenAddress: jest.fn(),
        setSelectedChainID: jest.fn(),
        devconnectChainId: '',
        devconnectRecipientAddress: '',
        devconnectTokenAddress: '',
    }),
}))

const bankMethod = { id: 'bank', title: 'Bank', description: 'EUR, USD & more', icons: [], soon: false }
const mercadoPagoMethod = { id: 'mercadopago', title: 'Mercado Pago', description: 'ARS', icons: [], soon: false }
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [bankMethod, mercadoPagoMethod], isLoading: false }),
}))

import SendLinkActionList from '../SendLinkActionList'

const claimLinkData = {
    amount: BigInt(10000000), // 10 USDC — clears every method minimum
    tokenDecimals: 6,
    sender: { userId: 'sender-123', username: 'alice' },
} as any

function renderList() {
    return render(
        <IntlWrapper>
            <SendLinkActionList claimLinkData={claimLinkData} isLoggedIn={false} isInviteLink={false} />
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimType = 'guest-kyc-needed'
    mockSenderCanReceiveBankOfframp = null
})

// Skipped while the receive screen is Peanut-only: the alternate claim rails are
// hidden behind SHOW_ALT_RAILS in SendLinkActionList, so the method cards these
// cases tap no longer render. The gating code is kept — flip the flag and remove
// .skip to bring these back.
describe.skip('guest-verification prompt reason', () => {
    test('bank + a definite "sender cannot receive" blames the sender', () => {
        mockSenderCanReceiveBankOfframp = false
        renderList()

        fireEvent.click(screen.getByText('Bank'))

        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('sender-unverified')
        expect(mockSetShowVerificationModal).toHaveBeenCalledWith(true)
    })

    test('bank + an unresolved sender lookup does NOT blame the sender', () => {
        // null is the lookup-miss case: no senderUserId, a 404, or a throw.
        // Claiming the sender is unverified here is a guess presented as fact.
        mockSenderCanReceiveBankOfframp = null
        renderList()

        fireEvent.click(screen.getByText('Bank'))

        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('account-required')
    })

    test('a logged-out regional claim blames the missing account, not the sender', () => {
        // mercadopago/pix never consult the sender's rails at all
        mockSenderCanReceiveBankOfframp = false
        renderList()

        fireEvent.click(screen.getByText('Mercado Pago'))

        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('account-required')
        expect(mockSetVerificationPromptReason).not.toHaveBeenCalledWith('sender-unverified')
    })
})
