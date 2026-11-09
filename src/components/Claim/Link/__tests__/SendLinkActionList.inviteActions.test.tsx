import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'

let mockWeb = false
let mockClaimType = 'guest-bank-claim'
let mockNavigate: (value: string) => void
let mockFlow: (value: string) => void
let mockExternal: (value: boolean) => void
let mockVerification: (value: boolean) => void
let mockStep: (value: string) => void
let mockHandoff: (value: unknown) => void

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: (value: string) => mockNavigate(value),
        replace: (value: string) => mockNavigate(value),
        prefetch: jest.fn(),
    }),
}))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => !mockWeb,
    getPlatform: () => (mockWeb ? 'web' : 'ios'),
    isAndroidNative: () => false,
    isIOSNative: () => !mockWeb,
    isNativeBridge: () => !mockWeb,
}))
jest.mock('@/hooks/useGuestStoreHandoff', () => ({
    useGuestStoreHandoff: () => ({
        interceptGuestCta: (value: unknown) => {
            if (mockWeb) mockHandoff(value)
            return mockWeb
        },
        storeHandoffModal: null,
        handoffActive: false,
    }),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ priority, fill, ...props }: any) => <img {...props} />,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('../../../Global/SupportCTA', () => ({ __esModule: true, default: () => null }))
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
        senderCanReceiveBankOfframp: null,
    }),
}))
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankCountryList: 'bank-country-list',
        BankDetailsForm: 'bank-details-form',
        BankConfirmClaim: 'bank-confirm-claim',
    },
    useClaimBankFlow: () => ({
        setClaimToExternalWallet: (v: boolean) => mockExternal(v),
        setFlowStep: (v: string) => mockFlow(v),
        setShowVerificationModal: (v: boolean) => mockVerification(v),
        setVerificationPromptReason: jest.fn(),
        setHideTokenSelector: jest.fn(),
    }),
}))
jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))
jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({
        addParamStep: (step: string, extra?: { method: string }) => {
            const url = new URL(window.location.href)
            url.searchParams.set('step', step)
            if (extra) url.searchParams.set('method', extra.method)
            window.history.replaceState({}, '', url)
            mockStep(step)
        },
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ canDo: () => true }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/hooks/useKnownPeanutDevice', () => ({ useKnownPeanutDevice: () => false }))
jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({
        setSelectedTokenAddress: jest.fn(),
        setSelectedChainID: jest.fn(),
        devconnectChainId: '',
        devconnectRecipientAddress: '',
        devconnectTokenAddress: '',
    }),
}))
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => {
    const defaultMethods = [
        { id: 'bank', title: 'Bank transfer', description: 'EUR', icons: [], soon: false },
        { id: 'exchange-or-wallet', title: 'Crypto', description: 'Wallet', icons: [], soon: false },
        { id: 'mercadopago', title: 'Mercado Pago', description: 'ARS', icons: [], soon: false },
        { id: 'pix', title: 'Pix', description: 'BRL', icons: [], soon: false },
    ]
    // Honour the list the component passes (the Devconnect variant passes its own methods).
    return {
        useGeoFilteredPaymentOptions: ({ methods }: { methods?: { id: string }[] } = {}) => ({
            filteredMethods: methods
                ? defaultMethods.filter((method) => methods.some(({ id }) => id === method.id))
                : defaultMethods,
            isLoading: false,
        }),
    }
})

import { readInviteCode, readInviteType, stashInvite } from '@/utils/invite-stash'
import { EInviteType } from '@/services/services.types'
import SendLinkActionList from '../SendLinkActionList'
const claimLinkData = {
    amount: BigInt(10000000),
    tokenDecimals: 6,
    sender: { userId: 'sender-123', username: 'alice' },
} as any
function Harness({
    data = claimLinkData,
    isInviteLink = true,
    isLoggedIn = false,
    showDevconnectMethod = false,
}: {
    data?: typeof claimLinkData
    isInviteLink?: boolean
    isLoggedIn?: boolean
    showDevconnectMethod?: boolean
}) {
    const [route, setRoute] = useState('')
    const [flow, setFlow] = useState('')
    const [external, setExternal] = useState(false)
    const [verification, setVerification] = useState(false)
    const [step, setStep] = useState('')
    const [handoff, setHandoff] = useState<unknown>(null)
    mockNavigate = setRoute
    mockFlow = setFlow
    mockExternal = setExternal
    mockVerification = setVerification
    mockStep = setStep
    mockHandoff = setHandoff
    return (
        <IntlWrapper>
            <SendLinkActionList
                claimLinkData={data}
                isLoggedIn={isLoggedIn}
                isInviteLink={isInviteLink}
                showDevconnectMethod={showDevconnectMethod}
            />
            <output data-testid="destination">{route}</output>
            <output data-testid="flow">{flow ? `bank:${flow}` : external ? 'external-wallet' : ''}</output>
            <output data-testid="step">{step}</output>
            {verification && <div>Account verification required</div>}
            {handoff !== null && <output data-testid="handoff">{JSON.stringify(handoff)}</output>}
        </IntlWrapper>
    )
}
const choose = (name: string) => fireEvent.click(screen.getByText(name))
const secondary = () => fireEvent.click(screen.getByRole('button', { name: 'Continue without signing up' }))
const prompt = () => screen.queryByRole('button', { name: 'Sign up and claim' })
async function expectNoPrompt() {
    await waitFor(() => expect(prompt()).not.toBeInTheDocument())
}
function expectNoSignup() {
    expect(screen.getByTestId('destination')).toBeEmptyDOMElement()
    expect(readInviteCode()).toBeFalsy()
}
beforeEach(() => {
    localStorage.clear()
    mockWeb = false
    mockClaimType = 'guest-bank-claim'
    window.history.replaceState({}, '', '/claim?c=42161&v=v4.3&i=123#p=test-claim-secret')
})

test('native signup preserves inviter attribution and the complete claim return URL', async () => {
    render(<Harness />)
    choose('Bank transfer')
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and claim' }))
    await waitFor(() => expect(screen.getByTestId('destination')).not.toBeEmptyDOMElement())
    const destination = new URL(screen.getByTestId('destination').textContent!, window.location.origin)
    expect(destination.pathname).toBe('/setup')
    expect(destination.searchParams.get('step')).toBe('signup')
    const claim = new URL(destination.searchParams.get('redirect_uri')!, window.location.origin)
    expect(claim.pathname).toBe('/claim')
    expect(claim.searchParams.get('c')).toBe('42161')
    expect(claim.searchParams.get('i')).toBe('123')
    expect(claim.searchParams.get('step')).toBe('claim')
    expect(claim.hash).toBe('#p=test-claim-secret')
    expect(readInviteCode()).toBe('alice')
    expect(readInviteType()).toBe(EInviteType.PAYMENT_LINK)
})
test.each([
    ['Bank transfer', 'bank:bank-country-list'],
    ['Crypto', 'external-wallet'],
])('secondary resumes the chosen %s flow without signup', async (name, expected) => {
    render(<Harness />)
    choose(name)
    secondary()
    await expectNoPrompt()
    expect(screen.getByTestId('flow')).toHaveTextContent(expected)
    expectNoSignup()
})
test('cancelling bank then choosing crypto does not retain the bank selection', async () => {
    render(<Harness />)
    choose('Bank transfer')
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
    await expectNoPrompt()
    expect(screen.getByTestId('flow')).toBeEmptyDOMElement()
    choose('Crypto')
    secondary()
    await expectNoPrompt()
    expect(screen.getByTestId('flow')).toHaveTextContent('external-wallet')
    expectNoSignup()
})
test('a bank amount below minimum remains blocked after continuing', async () => {
    render(<Harness data={{ ...claimLinkData, amount: BigInt(1000000) }} />)
    choose('Bank transfer')
    if (prompt()) secondary()
    await expectNoPrompt()
    expect(screen.getByRole('heading', { name: 'Minimum Amount' })).toBeInTheDocument()
    expect(screen.getByTestId('flow')).toBeEmptyDOMElement()
    expectNoSignup()
})
test.each(['Mercado Pago', 'Pix'])('%s bypasses the optional invite prompt', async (name) => {
    render(<Harness />)
    choose(name)
    await expectNoPrompt()
    expectNoSignup()
    expect(screen.getByTestId('step')).toHaveTextContent('regional-claim')
    expect(screen.getByText('Account verification required')).toBeInTheDocument()
})
test('the Claim on Devconnect app button bypasses the optional invite prompt', async () => {
    render(<Harness showDevconnectMethod />)
    fireEvent.click(screen.getByRole('button', { name: /Claim on.*Devconnect app/ }))
    await expectNoPrompt()
    expectNoSignup()
    expect(screen.getByTestId('flow')).toHaveTextContent('external-wallet')
})
test('account-required bank bypasses the optional invite prompt', async () => {
    mockClaimType = 'guest-kyc-needed'
    render(<Harness />)
    choose('Bank transfer')
    await expectNoPrompt()
    expect(screen.getByText('Account verification required')).toBeInTheDocument()
    expectNoSignup()
})
test.each([{ isInviteLink: false }, { data: { ...claimLinkData, sender: { userId: 'sender-123', username: null } } }])(
    'ineligible invite attribution bypasses the prompt: case %#',
    async (props) => {
        render(<Harness {...props} />)
        choose('Bank transfer')
        await expectNoPrompt()
        expect(screen.getByTestId('flow')).toHaveTextContent('bank:bank-country-list')
        expectNoSignup()
    }
)
test('signed-in users are not offered the guest prompt or alternate rails', () => {
    render(<Harness isLoggedIn />)
    expect(prompt()).not.toBeInTheDocument()
    expect(screen.queryByText('Bank transfer')).not.toBeInTheDocument()
    expect(screen.queryByText('Crypto')).not.toBeInTheDocument()
})
test('web signup hands off inviter without exposing the claim secret', async () => {
    mockWeb = true
    render(<Harness />)
    choose('Crypto')
    fireEvent.click(screen.getByRole('button', { name: 'Sign up and claim' }))
    const receipt = await screen.findByTestId('handoff')
    expect(JSON.parse(receipt.textContent!)).toEqual(expect.objectContaining({ invite: 'alice' }))
    expect(receipt).not.toHaveTextContent('test-claim-secret')
    expect(screen.getByTestId('destination')).toBeEmptyDOMElement()
    expect(screen.getByTestId('flow')).toBeEmptyDOMElement()
})

test.each(['cancel', 'secondary'])(
    '%s preserves an existing unrelated invite without referral writes',
    async (action) => {
        stashInvite('previous-inviter', EInviteType.PAYMENT_LINK)
        const before = localStorage.getItem('peanut:invite-stash')
        render(<Harness />)
        choose('Bank transfer')
        if (action === 'cancel') fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape', code: 'Escape' })
        else secondary()
        await expectNoPrompt()
        expect(localStorage.getItem('peanut:invite-stash')).toBe(before)
        expect(readInviteCode()).toBe('previous-inviter')
        expect(screen.getByTestId('destination')).toBeEmptyDOMElement()
    }
)
