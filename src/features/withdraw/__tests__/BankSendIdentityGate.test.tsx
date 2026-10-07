import React, { useEffect } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import WithdrawLayout from '@/app/(mobile-ui)/withdraw/layout'
import type { UseIdentityVerificationResult } from '@/hooks/useIdentityVerification'

let mockParams = new URLSearchParams()
jest.mock('next/navigation', () => ({
    useSearchParams: () => mockParams,
    useRouter: () => ({ push: jest.fn() }),
}))
let mockUser: object | null = {}
const mockLogout = jest.fn()
const mockFetchUser = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: mockUser, logoutUser: mockLogout, fetchUser: mockFetchUser }),
}))
let mockIdentity: Partial<UseIdentityVerificationResult>
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => mockIdentity }))
const mockStart = jest.fn()
const mockRestart = jest.fn()
const mockUseKycFlow = jest.fn()
let mockFlowError: string | null = null
let mockLiveKycStatus: string | undefined
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => {
        mockUseKycFlow()
        return {
            handleInitiateKyc: mockStart,
            handleRestartIdentity: mockRestart,
            error: mockFlowError,
            liveKycStatus: mockLiveKycStatus,
        }
    },
}))
const mockBack = jest.fn()
const mockSafeBack = jest.fn()
jest.mock('@/hooks/useSafeBack', () => ({
    useSafeBack: (...args: unknown[]) => {
        mockSafeBack(...args)
        return mockBack
    },
}))
const mockSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSupport }),
}))
jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/features/withdraw/WithdrawFlowContext', () => ({
    WithdrawFlowProvider: ({ children }: { children: React.ReactNode }) => children,
}))
jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="loading" />,
}))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ onPrev }: { onPrev: () => void }) => <button onClick={onPrev}>Back</button>,
}))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({
    InitiateKycModal: (props: { onVerify: () => void; onBack: () => void; presentation: string; error?: string }) => (
        <div data-testid="kyc-prep" data-presentation={props.presentation}>
            <button onClick={props.onVerify}>Verify</button>
            <button onClick={props.onBack}>Back</button>
            {props.error}
        </div>
    ),
}))
const mockSdkUnmount = jest.fn()
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => {
        useEffect(() => () => mockSdkUnmount(), [])
        return <div data-testid="sdk-host" />
    },
}))
jest.mock('@/components/Kyc/KYCStatusDrawerItem', () => ({
    KYCStatusDrawerItem: ({ status }: { status: string }) => <div data-testid={`status-${status}`} />,
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({ isLongPressed: false, pressProgress: 0, handlers: {} }),
}))

const mockFlowMounted = jest.fn()
function BankFlow() {
    useEffect(() => {
        mockFlowMounted()
    }, [])
    return <input aria-label="Bank details" />
}
const tree = () => (
    <IntlWrapper>
        <WithdrawLayout>
            <BankFlow />
        </WithdrawLayout>
    </IntlWrapper>
)
function setIdentity(status: NonNullable<UseIdentityVerificationResult['status']>) {
    mockIdentity = { status, identity: { status }, isVerified: status === 'verified' }
}

beforeEach(() => {
    jest.clearAllMocks()
    mockParams = new URLSearchParams('method=bank')
    mockUser = {}
    mockFlowError = null
    mockLiveKycStatus = undefined
    setIdentity('not_started')
})

describe('Send → Bank identity entry', () => {
    it.each([
        'method=bank',
        'method=bank&step=form',
        'method=bank&country=united-states&step=form',
        'method=bank&country=united-states&view=bank&amount=50',
        'sendMethod=bank&method=bank-transfer&country=argentina',
        'sendMethod=bank&method=pix&country=brazil',
    ])('requests KYC before mounting downstream screens: %s', (params) => {
        mockParams = new URLSearchParams(params)
        render(tree())
        expect(screen.getByTestId('kyc-prep')).toHaveAttribute('data-presentation', 'page')
        expect(screen.queryByLabelText('Bank details')).not.toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
        expect(mockStart).not.toHaveBeenCalled()
        fireEvent.click(screen.getByRole('button', { name: 'Verify' }))
        expect(mockStart).toHaveBeenCalledWith()
    })

    it('waits for the authenticated profile without flashing a form or KYC', () => {
        mockUser = null
        render(tree())
        expect(screen.getByTestId('loading')).toBeInTheDocument()
        expect(screen.queryByTestId('kyc-prep')).not.toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('reveals the requested route after approval and keeps the SDK host mounted', () => {
        const { rerender } = render(tree())
        setIdentity('processing')
        rerender(tree())
        expect(screen.getByTestId('status-processing')).toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
        expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()

        setIdentity('verified')
        rerender(tree())
        expect(screen.getByLabelText('Bank details')).toBeInTheDocument()
        expect(mockFlowMounted).toHaveBeenCalledTimes(1)
        expect(mockSdkUnmount).not.toHaveBeenCalled()
    })

    it('verified users proceed immediately; a background refresh keeps the form mounted', () => {
        setIdentity('verified')
        const { rerender } = render(tree())
        mockIdentity.isLoading = true
        rerender(tree())
        expect(screen.getByLabelText('Bank details')).toBeInTheDocument()
        expect(mockFlowMounted).toHaveBeenCalledTimes(1)
    })

    it('refreshes a returning pending check when approval arrives without a local SDK attempt', () => {
        setIdentity('processing')
        const { rerender } = render(tree())
        expect(mockFetchUser).not.toHaveBeenCalled()
        mockLiveKycStatus = 'APPROVED'
        rerender(tree())
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
        expect(mockStart).not.toHaveBeenCalled()
        expect(mockFlowMounted).not.toHaveBeenCalled()
        setIdentity('verified')
        rerender(tree())
        expect(screen.getByLabelText('Bank details')).toBeInTheDocument()
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it.each(['', 'method=crypto', 'method=pix', 'rail=bank', 'method=bank&sendMethod=crypto'])(
        'leaves other send/withdraw paths alone: %s',
        (params) => {
            mockParams = new URLSearchParams(params)
            render(tree())
            expect(screen.getByLabelText('Bank details')).toBeInTheDocument()
            expect(mockUseKycFlow).not.toHaveBeenCalled()
        }
    )

    it('back exits the verification step through the Send fallback', () => {
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Back' }))
        expect(mockBack).toHaveBeenCalledTimes(1)
        expect(mockSafeBack).toHaveBeenCalledWith('/send', { replace: true })
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('keeps a failed start on the verification step with its error', () => {
        mockFlowError = 'Please try again'
        render(tree())
        expect(screen.getByText('Please try again')).toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('resumes action-required verification, restarting when the API requires a document', () => {
        setIdentity('action_required')
        mockIdentity.identity = { status: 'action_required', actionMessage: 'Continue verification' }
        mockIdentity.needsDocumentRestart = true
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(mockRestart).toHaveBeenCalledWith()
        expect(mockStart).not.toHaveBeenCalled()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it.each(['failed', 'action_required'] as const)('a terminal %s offers support without a retry', (status) => {
        setIdentity(status)
        mockIdentity.isTerminalFailure = true
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(mockSupport).toHaveBeenCalledWith(true)
        expect(screen.queryByRole('button', { name: /retry|re-submit|verify/i })).not.toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('an email collision offers support and logout rather than resubmission', () => {
        setIdentity('action_required')
        mockIdentity.isEmailCollision = true
        mockIdentity.identity = { status: 'action_required', rejectLabels: ['DUPLICATE_EMAIL'] }
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
        expect(mockLogout).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('button', { name: /re-submit/i })).not.toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('a retryable failure offers the existing retry without exposing bank details', () => {
        setIdentity('failed')
        mockIdentity.isTerminalFailure = false
        render(tree())
        fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }))
        expect(mockStart).toHaveBeenCalledWith()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })

    it('a region restriction keeps its existing explanation without retry or support', () => {
        setIdentity('failed')
        mockIdentity.isRegionRestricted = true
        render(tree())
        expect(screen.getByTestId('status-failed')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /retry|support/i })).not.toBeInTheDocument()
        expect(mockFlowMounted).not.toHaveBeenCalled()
    })
})
