import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import ActivationCTAs from '../ActivationCTAs'
import PendingVerificationTasks from '../PendingVerificationTasks'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { RailCapability } from '@/types/capabilities'
import type { OnboardingState } from '@/utils/activation-step.utils'

let mockRails: RailCapability[] = []
const mockCapabilities = () => {
    const nextActions = mockRails.flatMap((rail) => (rail.resolved?.nextAction ? [rail.resolved.nextAction] : []))
    return withFeatureReport({ rails: mockRails, nextActions }, { identity: { status: 'verified' } })
}
const mockHeal = jest.fn()
const mockRestart = jest.fn()
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => {
        const capabilities = mockCapabilities()
        return {
            rails: mockRails,
            nextActions: capabilities.nextActions,
            capabilities,
            channelOf: (rail: RailCapability) => rail.channel,
        }
    },
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'fixture-actor' },
            identityVerification: { status: 'verified' },
            capabilities: mockCapabilities(),
        },
    }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ openSupportWithMessage: jest.fn() }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ identity: { status: 'verified' }, isRegionRestricted: false }),
}))
jest.mock('@/hooks/useCardSurfaceAccess', () => ({ useCardSurfaceAccess: () => ({ canSpendPathViaCard: false }) }))
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({ handleFixableRejection: mockHeal, handleRestartIdentity: mockRestart }),
}))
jest.mock('@/hooks/useEeaUpliftFunnel', () => ({
    useEeaUpliftFunnel: () => ({ trackStarted: jest.fn(), trackCompleted: jest.fn(), reset: jest.fn() }),
}))
jest.mock('@/utils/general.utils', () => ({ getUserPreferences: () => ({}), updateUserPreferences: jest.fn() }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/InitiateKycModal', () => ({ InitiateKycModal: () => null }))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({ BridgeTosStep: () => null }))
jest.mock('@/components/Home/GettingStartedChecklist', () => ({
    __esModule: true,
    default: () => <div>Checklist</div>,
}))
jest.mock('@/features/payments/flows/qr-pay/useQrIdentityCheck', () => ({
    useQrIdentityCheck: () => ({ start: jest.fn(), modals: null }),
}))
jest.mock('@/features/paperwork-verification/usePaperworkVerificationStart', () => ({
    usePaperworkVerificationStart: () => () => Promise.resolve(false),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const onboarding: OnboardingState = {
    verify: 'done',
    addMoneyDone: false,
    firstPaymentDone: false,
    firstPaymentRoute: 'none',
    step: 'add_money',
}
const documentRail: RailCapability = {
    id: 'bridge.ach_us',
    provider: 'bridge',
    method: 'ACH_US',
    channel: 'bank',
    country: 'US',
    currency: 'USD',
    status: 'requires-info',
    reason: { code: 'bridge_answers_rejected', userMessage: 'Answer again' },
    resolved: {
        status: 'fixable',
        blocking: {
            code: 'bridge_answers_rejected',
            userMessage: 'Answer again',
            selfHealable: true,
            selfHealKind: 'document-resubmit',
        },
        nextAction: { key: 'sumsub:eea_uplift', kind: 'sumsub', levelKey: 'eea_uplift', purpose: 'unlock-bridge' },
    },
}
const restartRail: RailCapability = {
    ...documentRail,
    id: 'manteca.pix_br',
    provider: 'manteca',
    status: 'blocked',
    reason: { code: 'identity_document_insufficient', userMessage: 'Verify again' },
    resolved: {
        status: 'blocked',
        nextAction: { key: 'restart-identity', kind: 'restart-identity', purpose: 'identity_document_insufficient' },
        blocking: {
            code: 'identity_document_insufficient',
            userMessage: 'Verify again',
            selfHealable: true,
            selfHealKind: 'restart-identity',
        },
    },
}
beforeEach(() => {
    jest.clearAllMocks()
    mockRails = [documentRail]
})

describe('Home follow-up', () => {
    it('shows one task surface and opens the region-row flow', () => {
        render(<PendingVerificationTasks placement="home" whenEmpty={<ActivationCTAs onboarding={onboarding} />} />)
        expect(screen.queryByText('Complete your setup')).not.toBeInTheDocument()
        expect(screen.getAllByRole('button', { name: 'Answer questions' })).toHaveLength(1)
        fireEvent.click(screen.getByRole('button', { name: 'Answer questions' }))
        expect(mockHeal).toHaveBeenCalledWith({
            provider: 'BRIDGE',
            actionKey: 'sumsub:eea_uplift',
            reasonCode: 'bridge_answers_rejected',
        })
    })
    it('a Manteca document request reads as the same request, in its own words', () => {
        mockRails = [
            {
                ...documentRail,
                id: 'manteca.bank_transfer_ar',
                provider: 'manteca',
                method: 'BANK_TRANSFER_AR',
                country: 'AR',
                currency: 'ARS',
                reason: { code: 'pep_documentation', userMessage: 'Upload a declaration' },
                resolved: {
                    status: 'fixable',
                    blocking: {
                        code: 'pep_documentation',
                        userMessage: 'Upload a declaration',
                        selfHealable: true,
                        selfHealKind: 'document-resubmit',
                    },
                    nextAction: { key: 'sumsub:pep_documentation', kind: 'sumsub', purpose: 'manteca-documents' },
                },
            },
        ]
        render(<PendingVerificationTasks placement="home" />)
        expect(screen.getByText('One more document needed')).toBeInTheDocument()
        expect(screen.getByText(/holds public office/)).toBeInTheDocument()
    })
    it('the activation surface labels questionnaires by their action', () => {
        render(<ActivationCTAs onboarding={onboarding} />)
        expect(screen.getByRole('button', { name: 'Answer questions' })).toBeInTheDocument()
    })
    it('an advisory sibling cannot replace the blocking request reason', () => {
        mockRails = [
            {
                ...documentRail,
                id: 'bridge.sepa_eu',
                method: 'SEPA_EU',
                country: 'EU',
                currency: 'EUR',
                status: 'enabled',
                resolved: {
                    status: 'enabled',
                    nextAction: {
                        key: 'sumsub:proof_of_address',
                        kind: 'sumsub',
                        purpose: 'unlock-bridge-sepa',
                        effectiveDate: '2099-01-01',
                    },
                },
                reason: { code: 'proof_of_address', userMessage: 'Advisory' },
            },
            documentRail,
        ]
        render(<PendingVerificationTasks placement="home" />)
        fireEvent.click(screen.getByRole('button', { name: 'Answer questions' }))
        expect(mockHeal).toHaveBeenCalledWith({
            provider: 'BRIDGE',
            actionKey: 'sumsub:eea_uplift',
            reasonCode: 'bridge_answers_rejected',
        })
    })
    it('the activation surface restarts identity before a sibling document ask', () => {
        mockRails = [documentRail, restartRail]
        render(<ActivationCTAs onboarding={onboarding} />)
        fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))
        expect(mockRestart).toHaveBeenCalledTimes(1)
        expect(mockHeal).not.toHaveBeenCalled()
        expect(screen.getByText(/document you verified with can't be used/)).toBeInTheDocument()
    })
    it('the Home task leaves an identity restart first', () => {
        mockRails = [documentRail, restartRail]
        render(
            <PendingVerificationTasks
                placement="home"
                prioritizeIdentityRestart
                whenEmpty={<ActivationCTAs onboarding={onboarding} />}
            />
        )
        expect(screen.queryByRole('button', { name: 'Answer questions' })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))
        expect(mockRestart).toHaveBeenCalledTimes(1)
        expect(mockHeal).not.toHaveBeenCalled()
    })
})
