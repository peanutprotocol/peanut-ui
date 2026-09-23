/**
 * BankFlowManager — guest claim straight to a bank (TASK-22936).
 *
 * A guest has no account and no session. The bank account is created on the
 * link sender's Bridge customer and the payout runs under it, so the only
 * authorization is the link itself: every guest call carries a signature from
 * the link's key, and no sender id ever leaves the device. Refusals come back
 * with stable codes that must show their own copy.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { verifyMessage } from 'viem'
import { BankFlowManager } from '../BankFlowManager.view'
import { getCountryFromPath } from '@/utils/bridge.utils'
import { generateKeysFromString } from '@/utils/peanut-link.utils'
import { guestBankAccountMessage, guestBankClaimMessage } from '@/utils/guest-claim.utils'
import { createGuestClaimExternalAccount } from '@/app/actions/external-accounts'
import { confirmOfframp, createOfframpForGuest } from '@/app/actions/offramp'
import { getUserById } from '@/app/actions/users'

const ctx: Record<string, any> = {}
function resetCtx() {
    Object.keys(ctx).forEach((k) => delete ctx[k])
    Object.assign(ctx, {
        flowStep: 'bank-details-form',
        setFlowStep: jest.fn((step: string | null) => {
            ctx.flowStep = step
        }),
        selectedCountry: getCountryFromPath('usa'),
        setSelectedCountry: jest.fn(),
        setClaimType: jest.fn(),
        setBankDetails: jest.fn(),
        justCompletedKyc: false,
        setJustCompletedKyc: jest.fn(),
        setShowVerificationModal: jest.fn(),
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

// The form hands the view what a guest typed for a US account.
const GUEST_PAYLOAD = {
    accountType: 'us',
    accountNumber: '123456789',
    routingNumber: '021000021',
    countryCode: 'USA',
    countryName: 'united states',
    accountOwnerType: 'individual',
    accountOwnerName: { firstName: 'Guest', lastName: 'Claimer' },
}
const GUEST_RAW = {
    name: '',
    firstName: 'Guest',
    lastName: 'Claimer',
    email: '',
    accountNumber: '123456789',
    routingNumber: '021000021',
    bic: '',
    sortCode: '',
    clabe: '',
    iban: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'USA',
}
let formResult: { error?: string } | undefined
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({
    DynamicBankAccountForm: (props: any) => (
        <button
            data-testid="submit-form"
            onClick={async () => {
                formResult = await props.onSuccess(GUEST_PAYLOAD, GUEST_RAW)
            }}
        >
            Submit
        </button>
    ),
}))
jest.mock('@/components/Claim/Link/views/Confirm.bank-claim.view', () => ({
    ConfirmBankClaimView: (props: any) => (
        <div>
            <button data-testid="confirm-claim" onClick={props.onConfirm}>
                Confirm
            </button>
            {props.error && <p data-testid="claim-error">{props.error}</p>}
        </div>
    ),
}))

jest.mock('@/app/actions/external-accounts', () => ({ createGuestClaimExternalAccount: jest.fn() }))
jest.mock('@/app/actions/offramp', () => ({
    confirmOfframp: jest.fn(),
    createOfframp: jest.fn(),
    createOfframpForGuest: jest.fn(),
}))
jest.mock('@/app/actions/users', () => ({ addBankAccount: jest.fn(), getUserById: jest.fn() }))
jest.mock('@/hooks/useDetermineBankClaimType', () => ({
    BankClaimType: {
        GuestBankClaim: 'guest-bank-claim',
        UserBankClaim: 'user-bank-claim',
        ReceiverKycNeeded: 'receiver-kyc-needed',
        GuestKycNeeded: 'guest-kyc-needed',
    },
    useDetermineBankClaimType: () => ({ claimType: 'guest-bank-claim' }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn() }) }))
jest.mock('@/context/loadingStates.context', () => {
    const { createContext } = jest.requireActual('react')
    return { loadingStateContext: createContext({ isLoading: false, setLoadingState: jest.fn() }) }
})
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleInitiateKyc: jest.fn(), showWrapper: false, isLoading: false, error: null }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ gateFor: () => ({ kind: 'loading' }) }) }))
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => ({ banking: false }) }))
jest.mock('@/utils/capability-gate', () => ({
    getKycModalVariant: () => 'needs_kyc',
    getGateUserMessage: () => undefined,
    getGateReasonCode: () => undefined,
}))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Common/SavedAccountsView', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Common/CountryListRouter', () => ({ CountryListRouter: () => null }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ badgeCampaignForLegacyWire: () => undefined }))
const mockClaimLink = jest.fn()
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLink: mockClaimLink }),
}))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@/utils/peanut-claim.utils', () => ({
    getContractAddress: () => '0x0',
    getLatestContractVersion: () => 'v4.3',
}))
jest.mock('@/utils/bridge-accounts.utils', () => ({
    getBridgeChainName: () => 'arbitrum',
    getBridgeTokenName: () => 'usdc',
}))
jest.mock('@/utils/withdraw.utils', () => ({ getCountryCodeForWithdraw: () => 'USA' }))
jest.mock('@/utils/general.utils', () => ({ formatTokenAmount: (n: number) => String(n) }))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: {} }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const LINK_SECRET = 'guest-bank-claim-secret'
const claimLinkData: any = {
    link: `https://peanut.me/claim?c=42161&v=v4.3&i=3#p=${LINK_SECRET}`,
    sender: { userId: 'sender-1' },
    senderAddress: '0xsender',
    amount: 25500000n,
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    chainId: '42161',
}
const props: any = { claimLinkData, onCustom: jest.fn(), setTransactionHash: jest.fn() }
const linkPubKey = generateKeysFromString(LINK_SECRET).address

const mockCreateAccount = createGuestClaimExternalAccount as jest.Mock
const mockCreateGuestOfframp = createOfframpForGuest as jest.Mock

async function submitForm() {
    await act(async () => {
        fireEvent.click(screen.getByTestId('submit-form'))
    })
}

async function reachConfirmAndClaim() {
    await submitForm()
    await act(async () => {
        fireEvent.click(screen.getByTestId('confirm-claim'))
    })
}

function signedBy(address: string, message: string, signature: string) {
    return verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
}

beforeEach(() => {
    jest.clearAllMocks()
    resetCtx()
    formResult = undefined
    mockCreateAccount.mockResolvedValue({ id: 'ext-1', account_type: 'us', last_4: '6789' })
})

test('adds the account with a link-key signature and never looks up the sender', async () => {
    render(<BankFlowManager {...props} />)
    await submitForm()

    expect(mockCreateAccount).toHaveBeenCalledTimes(1)
    const [pubKey, signature, payload] = mockCreateAccount.mock.calls[0]
    expect(pubKey).toBe(linkPubKey)
    expect(await signedBy(linkPubKey, guestBankAccountMessage(linkPubKey), signature)).toBe(true)
    expect(payload).toEqual(expect.objectContaining({ accountType: 'us', country: 'USA' }))
    expect(getUserById).not.toHaveBeenCalled()
    expect(ctx.flowStep).toBe('bank-confirm-claim')
})

test('claims the exact link amount, signed for that account, with no sender id in the body', async () => {
    mockCreateGuestOfframp.mockResolvedValue({ error: 'stop here', code: 'GUEST_CLAIM_ALREADY_CLAIMED' })
    render(<BankFlowManager {...props} />)
    await reachConfirmAndClaim()

    expect(mockCreateGuestOfframp).toHaveBeenCalledTimes(1)
    const body = mockCreateGuestOfframp.mock.calls[0][0]
    expect(body).toEqual(
        expect.objectContaining({
            amount: '25.5',
            sendLinkPubKey: linkPubKey,
            beneficiaryName: 'Guest Claimer',
            destination: expect.objectContaining({ externalAccountId: 'ext-1' }),
        })
    )
    expect(body).not.toHaveProperty('userId')
    expect(body).not.toHaveProperty('onBehalfOf')
    expect(await signedBy(linkPubKey, guestBankClaimMessage(linkPubKey, 'ext-1'), body.signature)).toBe(true)
})

test.each([
    ['over the limit', 'GUEST_CLAIM_OVER_LIMIT', 400, 'bank.guestErrors.overLimit'],
    ['a duplicate claim', 'GUEST_CLAIM_ALREADY_CLAIMED', 409, 'bank.guestErrors.alreadyClaimed'],
    ['an ineligible sender', 'GUEST_CLAIM_SENDER_NOT_ELIGIBLE', 409, 'bank.guestErrors.unsupported'],
    ['the residence block (403, no code)', undefined, 403, 'bank.guestErrors.unsupported'],
])('%s shows its own copy', async (_case, code, status, copy) => {
    mockCreateGuestOfframp.mockResolvedValue({ error: 'raw API message', code, status })
    render(<BankFlowManager {...props} />)
    await reachConfirmAndClaim()

    expect(screen.getByTestId('claim-error')).toHaveTextContent(copy)
})

test('an unsupported account refusal is returned to the form with its copy', async () => {
    mockCreateAccount.mockResolvedValue({ error: 'Bank transfers are not available', status: 403 })
    render(<BankFlowManager {...props} />)
    await submitForm()

    expect(formResult).toEqual({ error: 'bank.guestErrors.unsupported' })
    expect(ctx.flowStep).toBe('bank-details-form')
})

test('claims on-chain to the deposit address and skips the login-only confirm call', async () => {
    mockCreateGuestOfframp.mockResolvedValue({
        data: { transferId: 'transfer-1', depositInstructions: { toAddress: '0xdeposit' } },
    })
    mockClaimLink.mockResolvedValue('0xclaimtx')
    render(<BankFlowManager {...props} />)
    await reachConfirmAndClaim()

    expect(mockClaimLink).toHaveBeenCalledWith(expect.objectContaining({ address: '0xdeposit' }))
    expect(confirmOfframp).not.toHaveBeenCalled()
    expect(props.onCustom).toHaveBeenCalledWith('SUCCESS')
})
