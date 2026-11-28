import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { CardPage } from '../CardPage'
import type { CardTopLevelState } from '@/components/Card/cardState.utils'

let mockFlowState: Record<string, unknown>

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}))
jest.mock('../useCardFlow', () => ({
    useCardFlow: () => mockFlowState,
}))
jest.mock('../useCardVerificationContinuation', () => ({
    useCardVerificationContinuation: () => ({ available: false, busy: false, error: null, start: jest.fn() }),
}))
jest.mock('@/components/Card/CardStopBanner', () => ({
    __esModule: true,
    default: () => null,
}))
jest.mock('@/components/Card/YourCardScreen', () => ({
    __esModule: true,
    default: () => <div data-testid="your-card-screen" />,
}))
jest.mock('@/components/Card/ApplicationStatusScreen', () => ({
    __esModule: true,
    default: ({ variant }: { variant: string }) => (
        <div data-testid="application-status-screen" data-variant={variant} />
    ),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({
    SumsubKycModals: () => null,
}))
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: () => null,
}))
jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="card-loading-spinner" />,
}))

function baseFlow(overrides: Record<string, unknown> = {}) {
    return {
        user: { user: { userId: 'u-1' }, identityVerification: { status: 'approved' } },
        fetchUser: jest.fn(),
        state: 'loading' as CardTopLevelState,
        overview: undefined,
        cardInfo: undefined,
        overviewError: null,
        cardInfoError: null,
        issuanceReadError: false,
        issuanceStillCreating: false,
        issuanceExpired: false,
        retryIssuance: jest.fn(),
        refetchOverview: jest.fn(),
        refetchCardInfo: jest.fn(),
        invalidateOverview: jest.fn(),
        supportRequiredReason: null,
        residenceAddressStep: false,
        planRefusal: null,
        geoBlocked: false,
        pendingResidenceBlocked: false,
        fundingRequired: false,
        pendingTerms: null,
        pendingCountryConfirmation: null,
        pendingQuestions: null,
        pendingApplication: null,
        applyError: null,
        poaToken: null,
        setPoaToken: jest.fn(),
        poaError: null,
        poaSubmitted: false,
        setPoaSubmitted: jest.fn(),
        poaAction: null,
        onUploadProofOfAddress: jest.fn(),
        identityAction: null,
        onUploadIdentity: jest.fn(),
        identityUploadError: null,
        informationActions: [],
        informationSession: null,
        setInformationSession: jest.fn(),
        informationError: null,
        startInformationAction: jest.fn(),
        refreshInformationToken: jest.fn(),
        sumsubToken: null,
        handleSumsubComplete: jest.fn(),
        handleSumsubClose: jest.fn(),
        handleSumsubRefreshToken: jest.fn(),
        setIsSupportModalOpen: jest.fn(),
        onBack: jest.fn(),
        kycFlow: { isTerminalError: false, error: null, isLoading: false, showWrapper: false },
        ...overrides,
    }
}

describe('CardPage state simulation (no infinite spinner, crash, or blank screen)', () => {
    it('shows the retry error card (never infinite spinner) when initial overview or cardInfo fails', () => {
        mockFlowState = baseFlow({
            state: 'loading',
            overviewError: new Error('503 Service Unavailable'),
        })
        renderWithIntl(<CardPage />)
        expect(screen.queryByTestId('card-loading-spinner')).toBeNull()
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('falls back to requires-support instead of crashing when state is active but no active card exists', () => {
        mockFlowState = baseFlow({
            state: 'active',
            overview: {
                status: { hasApplication: true, railStatus: 'ENABLED' },
                cards: [{ id: 'c1', status: 'CANCELED' }],
            },
        })
        renderWithIntl(<CardPage />)
        expect(screen.queryByTestId('your-card-screen')).toBeNull()
        expect(screen.getByTestId('application-status-screen')).toHaveAttribute('data-variant', 'requires-support')
    })

    it('falls back to requires-support instead of blank null on an unknown future cardState', () => {
        mockFlowState = baseFlow({
            state: 'some_new_backend_state' as CardTopLevelState,
            overview: { status: { hasApplication: true }, cards: [] },
        })
        renderWithIntl(<CardPage />)
        expect(screen.getByTestId('application-status-screen')).toHaveAttribute('data-variant', 'requires-support')
    })
})
