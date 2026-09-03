/** @jest-environment jsdom */
/**
 * The bank-claim form submits straight into the Sumsub SDK — it never renders
 * InitiateKycModal on that path, so the residence choke point cannot see it.
 * A ROW intent still mints a general-level token, which is a verification a
 * bank-restricted residence can never turn into a rail, so the branch has to
 * refuse before it calls the SDK.
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { BankFlowManager } from '../views/BankFlowManager.view'

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))

const handleInitiateKyc = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc,
        handleRestartIdentity: jest.fn(),
        handleSelfHealResubmit: jest.fn(),
        isLoading: false,
        error: null,
        showWrapper: false,
    }),
}))

// the seam: expose the form's onSuccess as a button so the test can submit
jest.mock('@/components/AddWithdraw/DynamicBankAccountForm', () => ({
    DynamicBankAccountForm: ({ onSuccess }: { onSuccess: (p: unknown, r: unknown) => void }) => (
        <button data-testid="submit-bank-form" onClick={() => onSuccess({}, {})}>
            submit
        </button>
    ),
}))

jest.mock('@/context/ClaimBankFlowContext', () => {
    const actual = jest.requireActual('@/context/ClaimBankFlowContext')
    return {
        ...actual,
        useClaimBankFlow: () => ({
            flowStep: actual.ClaimBankFlowStep.BankDetailsForm,
            setFlowStep: jest.fn(),
            selectedCountry: { id: 'spain', path: 'spain', region: 'europe' },
            setClaimType: jest.fn(),
            setBankDetails: jest.fn(),
            justCompletedKyc: false,
            setJustCompletedKyc: jest.fn(),
            setShowVerificationModal: jest.fn(),
        }),
    }
})

jest.mock('@/hooks/useDetermineBankClaimType', () => {
    const actual = jest.requireActual('@/hooks/useDetermineBankClaimType')
    return { ...actual, useDetermineBankClaimType: () => ({ claimType: actual.BankClaimType.ReceiverKycNeeded }) }
})

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null, fetchUser: jest.fn() }) }))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: () => ({ kind: 'needs-identity' }) }),
}))
jest.mock('@/hooks/useSavedAccounts', () => ({ __esModule: true, default: () => [] }))
jest.mock('../../useClaimLink', () => ({ __esModule: true, default: () => ({ claimLink: jest.fn() }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@/hooks/useTosGuard', () => ({
    useTosGuard: () => ({ guardWithTos: jest.fn(), showBridgeTos: false, hideTos: jest.fn() }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
// the SDK host renders a headless-ui Transition that needs a `show` prop it
// only gets from real flow state; irrelevant to the branch under test
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/redux/hooks', () => ({ useAppDispatch: () => jest.fn() }))
jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
    useRouter: () => ({ push: jest.fn() }),
    // NavHeader mounts the maintenance Banner, which reads the pathname
    usePathname: () => '/claim',
}))

const claimLinkData = {
    amount: '1000000',
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    sender: { userId: 'sender-1' },
} as never

// the flow reads only these three; the rest of IClaimScreenProps is inert here
const props = { claimLinkData, onCustom: jest.fn(), setTransactionHash: jest.fn() } as unknown as React.ComponentProps<
    typeof BankFlowManager
>

const renderFlow = () =>
    render(
        <IntlWrapper>
            <BankFlowManager {...props} />
        </IntlWrapper>
    )

describe('BankFlowManager — bank-restricted residence', () => {
    beforeEach(() => {
        handleInitiateKyc.mockClear()
        mockRestrictions = { banking: false, card: false }
    })

    it('starts verification when the residence can hold a bank rail', async () => {
        renderFlow()
        await act(async () => {
            fireEvent.click(screen.getByTestId('submit-bank-form'))
        })
        expect(handleInitiateKyc).toHaveBeenCalled()
    })

    it('never opens the SDK for a residence no bank provider onboards', async () => {
        mockRestrictions = { banking: true, card: false }
        renderFlow()
        await act(async () => {
            fireEvent.click(screen.getByTestId('submit-bank-form'))
        })
        expect(handleInitiateKyc).not.toHaveBeenCalled()
        expect(screen.getByText('Not available in your country')).toBeInTheDocument()
    })
})
