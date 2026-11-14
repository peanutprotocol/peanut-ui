/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react'
import type { KycFeatureActivationResult } from '@/app/actions/kyc-feature-activation'

jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div>loading</div> }))
jest.mock('@/features/paperwork-verification/components/LoadScreens', () => ({ VerificationOutage: () => null }))
jest.mock('@/features/pix/components/PixReviewScreen', () => ({ PixReviewScreen: () => <div>review</div> }))
type Activation = {
    allowed: boolean
    userReady: boolean
    result: KycFeatureActivationResult | null
    isLoading: boolean
    activate: jest.Mock
}
let mockActivation: Activation
const mockActivationOptions = jest.fn()
jest.mock('@/features/paperwork-verification/useKycFeatureActivation', () => ({
    useKycFeatureActivation: (feature: string, options: unknown) => {
        mockActivationOptions(feature, options)
        return mockActivation
    },
}))
const mockResolveGate = jest.fn()
jest.mock('@/features/deposit-accounts/useDepositGateRemediation', () => ({
    useDepositGateRemediation: () => ({ resolveGate: mockResolveGate, modals: <div>remediation</div> }),
}))
jest.mock('@/features/paperwork-verification/KycFeatureActivationStatus', () => ({
    KycFeatureActivationStatus: (props: { result: KycFeatureActivationResult | null; onRetry: () => void }) => (
        <button onClick={props.onRetry}>{props.result ? `status ${props.result.kind}` : 'consent'}</button>
    ),
}))

import { PixFirstUse } from '../components/PixFirstUse'

const report = (report: Record<string, unknown>) =>
    ({ kind: 'report', report }) as unknown as KycFeatureActivationResult
const CORRIDOR_STEP = {
    key: 'verify-corridor:pix_br',
    kind: 'sumsub',
    purpose: 'unlock-corridor-pix_br',
    levelKey: 'bridge',
    currency: 'BRL',
}
const renderFirstUse = () => render(<PixFirstUse title="Add money" onBack={jest.fn()} />)

describe('PixFirstUse', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockActivation = { allowed: false, userReady: true, result: null, isLoading: false, activate: jest.fn() }
    })

    // TASK-24910, API-CONTRACT.md 4a: one call for every user; the API answers each with their step
    it("asks the API for the first use whatever verified the user, and asks for the user's consent first", () => {
        renderFirstUse()
        expect(mockActivationOptions).toHaveBeenCalledWith(
            'local',
            expect.objectContaining({ everyUser: true, scope: { channel: 'bank', country: 'BR' } })
        )
        fireEvent.click(screen.getByRole('button', { name: 'consent' }))
        expect(mockActivation.activate).toHaveBeenCalled()
    })

    it("starts a legacy approval's corridor verification the way the bank deposit flow does, once", () => {
        mockActivation.result = report({ state: 'action_required', nextAction: CORRIDOR_STEP })
        const { rerender } = renderFirstUse()
        expect(mockResolveGate).toHaveBeenCalledTimes(1)
        expect(mockResolveGate).toHaveBeenCalledWith({ kind: 'needs-enrollment' }, 'PIX_BR')
        rerender(<PixFirstUse title="Add money" onBack={jest.fn()} />)
        expect(mockResolveGate).toHaveBeenCalledTimes(1)
        expect(screen.getByText('remediation')).toBeInTheDocument()
        // dismissed, the page's button opens it again, and asks the API nothing new
        fireEvent.click(screen.getByRole('button', { name: 'consent' }))
        expect(mockResolveGate).toHaveBeenCalledTimes(2)
        expect(mockActivation.activate).not.toHaveBeenCalled()
    })

    it.each(['pending', 'setting_up'])('shows the review screen while the answer is %s, never a loader', (state) => {
        mockActivation.result = report({ state })
        renderFirstUse()
        expect(screen.getByText('review')).toBeInTheDocument()
        expect(screen.queryByText('loading')).toBeNull()
    })

    it('shows the review screen once the first use went through and the route has not moved yet', () => {
        mockActivation.allowed = true
        renderFirstUse()
        expect(screen.getByText('review')).toBeInTheDocument()
    })

    it("shows any other answer on the activation's own screen", () => {
        mockActivation.result = report({ state: 'refused', reason: 'under_minimum_age' })
        renderFirstUse()
        expect(screen.getByText('status report')).toBeInTheDocument()
        expect(mockResolveGate).not.toHaveBeenCalled()
    })
})
