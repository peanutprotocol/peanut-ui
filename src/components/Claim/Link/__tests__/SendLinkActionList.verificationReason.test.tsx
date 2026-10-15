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
jest.mock('../../../Global/ConfirmInviteModal', () => ({
    __esModule: true,
    default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>invite prompt</div> : null),
}))
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
        setHideTokenSelector: jest.fn(),
    }),
}))

jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))
const mockAddParamStep = jest.fn()
jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ addParamStep: (...args: unknown[]) => mockAddParamStep(...args) }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ canDo: () => true }) }))

// logged OUT — the state that makes the regional path raise the modal
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))

jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({
        setSelectedTokenAddress: jest.fn(),
        setSelectedChainID: jest.fn(),
        devconnectChainId: '',
        devconnectRecipientAddress: '',
        devconnectTokenAddress: '',
    }),
}))

const bankMethod = { id: 'bank', title: 'Bank transfer', description: 'EUR, USD & more', icons: [], soon: false }
const mercadoPagoMethod = { id: 'mercadopago', title: 'Mercado Pago', description: 'ARS', icons: [], soon: false }
// An unrecognised recipient — the only case where the rails render at all.
jest.mock('@/hooks/useKnownPeanutDevice', () => ({ useKnownPeanutDevice: () => false }))

jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: () => ({ filteredMethods: [bankMethod, mercadoPagoMethod], isLoading: false }),
}))

import SendLinkActionList from '../SendLinkActionList'

const claimLinkData = {
    amount: BigInt(10000000), // 10 USDC — clears every method minimum
    tokenDecimals: 6,
    sender: { userId: 'sender-123', username: 'alice' },
} as any

function renderList({ isInviteLink = false }: { isInviteLink?: boolean } = {}) {
    return render(
        <IntlWrapper>
            <SendLinkActionList claimLinkData={claimLinkData} isLoggedIn={false} isInviteLink={isInviteLink} />
        </IntlWrapper>
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    mockClaimType = 'guest-kyc-needed'
    mockSenderCanReceiveBankOfframp = null
})

describe('guest-verification prompt reason', () => {
    test('bank + a definite "sender cannot receive" blames the sender', () => {
        mockSenderCanReceiveBankOfframp = false
        renderList()

        fireEvent.click(screen.getByText('Bank transfer'))

        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('sender-unverified')
        expect(mockSetShowVerificationModal).toHaveBeenCalledWith(true)
    })

    test('bank + an unresolved sender lookup does NOT blame the sender', () => {
        // null is the lookup-miss case: no senderUserId, a 404, or a throw.
        // Claiming the sender is unverified here is a guess presented as fact.
        mockSenderCanReceiveBankOfframp = null
        renderList()

        fireEvent.click(screen.getByText('Bank transfer'))

        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('account-required')
    })

    test('a regional claim asks for an account and carries the method across the sign-up', () => {
        // mercadopago/pix never consult the sender's rails at all, and the link
        // goes to the new account before any withdraw (TASK-23648)
        mockSenderCanReceiveBankOfframp = false
        renderList()

        fireEvent.click(screen.getByText('Mercado Pago'))

        expect(mockAddParamStep).toHaveBeenCalledWith('regional-claim', { method: 'mercadopago' })
        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('regional-account-required')
        expect(mockSetVerificationPromptReason).not.toHaveBeenCalledWith('sender-unverified')
        expect(mockSetShowVerificationModal).toHaveBeenCalledWith(true)
    })
})

describe('invite prompt on an invite link', () => {
    test('Mercado Pago skips it: the method needs an account, so "continue without signing up" would be false', () => {
        renderList({ isInviteLink: true })

        fireEvent.click(screen.getByText('Mercado Pago'))

        expect(screen.queryByText('invite prompt')).not.toBeInTheDocument()
        expect(mockAddParamStep).toHaveBeenCalledWith('regional-claim', { method: 'mercadopago' })
        expect(mockSetVerificationPromptReason).toHaveBeenCalledWith('regional-account-required')
    })

    test('bank still asks first, since a bank claim can go ahead without an account', () => {
        renderList({ isInviteLink: true })

        fireEvent.click(screen.getByText('Bank transfer'))

        expect(screen.getByText('invite prompt')).toBeInTheDocument()
        expect(mockSetShowVerificationModal).not.toHaveBeenCalled()
    })
})

describe('requires-verification badge', () => {
    // design.md badges: the user must act, so the badge is pending (attention yellow), not accent
    test('reads as pending on the bank row of a guest claim', () => {
        renderList()

        expect(screen.getAllByText('Requires verification')[0]).toHaveClass('bg-background-badge-attention')
    })
})
