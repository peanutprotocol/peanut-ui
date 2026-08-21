/** @jest-environment jsdom */
/**
 * Unlock payments — the Unlocked Regions rework.
 *
 * Pins the contracts that motivated the rework: a bank-method tap can never
 * route to /card (the old Europe→card hijack), Everywhere leads the list,
 * the residence anchor renders, and restricted residences read Not available.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import UnlockPayments from '@/components/Profile/views/UnlockPayments.view'

const render = () => rtlRender(<UnlockPayments />, { wrapper: IntlWrapper })

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }))
jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))

let mockRails: unknown[] = []
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({
        rails: mockRails,
        isKycApproved: false,
        railsForProvider: () => [],
        nextActionsForRail: () => [],
    }),
}))

let mockRestrictions = { banking: false, card: false }
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => mockRestrictions,
}))
let mockIdentity: { status: string; submittedAt?: string } = { status: 'not_started' }
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: mockIdentity,
        isProcessing: mockIdentity.status === 'processing',
    }),
}))
let mockKycDegraded = false
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => mockKycDegraded }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn(), setPersonProperties: jest.fn() } }))

let mockUser: { residence?: { declared: string | null; verified: string | null }; user?: { userId: string } } | null =
    null
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))

jest.mock('@/hooks/useCardInfo', () => ({
    useCardInfo: () => ({ isEligible: true, hasCardAccess: true }),
}))
jest.mock('@/hooks/useRainCardOverview', () => ({ useRainCardOverview: () => ({ overview: null }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

const mockInitiateKyc = jest.fn()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: mockInitiateKyc,
        handleSelfHealResubmit: jest.fn(),
        handleRestartIdentity: jest.fn(),
        isLoading: false,
        error: null,
    }),
}))

// Heavy children are irrelevant to the list contract under test.
jest.mock('@/components/Home/PendingVerificationTasks', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Kyc/modals/KycProcessingModal', () => ({ KycProcessingModal: () => null }))
jest.mock('@/components/Kyc/modals/KycActionRequiredModal', () => ({ KycActionRequiredModal: () => null }))
jest.mock('@/components/Kyc/modals/KycFailedModal', () => ({ KycFailedModal: () => null }))
jest.mock('@/components/IdentityVerification/UnlockMethodModal', () => ({
    __esModule: true,
    default: ({ visible, methodLabel }: { visible: boolean; methodLabel: string | null }) =>
        visible ? <div>unlock-modal-open:{methodLabel}</div> : null,
}))
jest.mock('@/components/Profile/views/ResidenceChangeModal', () => ({
    __esModule: true,
    default: ({ visible }: { visible: boolean }) => (visible ? <div>change-modal-open</div> : null),
}))

describe('UnlockPayments', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockRails = []
        mockRestrictions = { banking: false, card: false }
        mockUser = null
        mockIdentity = { status: 'not_started' }
        mockKycDegraded = false
    })

    it('shows the in-review line with the submitted date while identity is processing', () => {
        mockIdentity = { status: 'processing', submittedAt: new Date(Date.now() - 2 * 86400000).toISOString() }
        render()
        expect(screen.getByText(/ID check in review since/)).toBeInTheDocument()
        expect(screen.queryByText("Message us and we'll chase it")).not.toBeInTheDocument()
    })

    it('escalates the in-review line after 7 days', () => {
        mockIdentity = { status: 'processing', submittedAt: new Date(Date.now() - 8 * 86400000).toISOString() }
        render()
        expect(screen.getByText('This is taking longer than usual.')).toBeInTheDocument()
        expect(screen.getByText("Message us and we'll chase it")).toBeInTheDocument()
    })

    it('degraded mode shows the outage banner and blocks bank-method taps', () => {
        mockKycDegraded = true
        render()
        expect(screen.getByText('Verification is temporarily down')).toBeInTheDocument()
        fireEvent.click(screen.getByText('SEPA transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it('leads with the Everywhere group and its always-on row', () => {
        render()
        const headers = screen.getAllByText(/Everywhere|Brazil|Argentina|United States|Mexico|Europe/)
        expect(headers[0]).toHaveTextContent('Everywhere')
        expect(screen.getByText('Peanut-to-Peanut payments')).toBeInTheDocument()
        expect(screen.getByText('Always on')).toBeInTheDocument()
    })

    it('a bank-method tap opens the method-worded unlock modal and NEVER routes to /card', () => {
        render()
        fireEvent.click(screen.getByText('SEPA transfers'))
        expect(screen.getByText('unlock-modal-open:SEPA transfers')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('the card row routes to /card and only the card row does', () => {
        render()
        fireEvent.click(screen.getByText('Peanut card'))
        expect(mockPush).toHaveBeenCalledWith('/card')
    })

    it('shows the verified residence anchor and floats that region up', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR' } }
        render()
        expect(screen.getByText('Residence: Brazil')).toBeInTheDocument()
        expect(screen.getByText('Verified')).toBeInTheDocument()
        expect(screen.getByText('Your region')).toBeInTheDocument()
        const headers = screen.getAllByText(/^(Everywhere|Brazil|Argentina|United States|Mexico|Europe)$/)
        expect(headers[1]).toHaveTextContent('Brazil')
    })

    it('a fully restricted residence reads Not available on bank rows but keeps the always-on row', () => {
        mockRestrictions = { banking: true, card: true }
        render()
        expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(6)
        expect(screen.getByText('Always on')).toBeInTheDocument()
        fireEvent.click(screen.getByText('SEPA transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
    })

    it('the residence Change link opens the change modal', () => {
        mockUser = { residence: { declared: 'BR', verified: 'BR' }, user: { userId: 'u1' } }
        render()
        fireEvent.click(screen.getByText('Change'))
        expect(screen.getByText('change-modal-open')).toBeInTheDocument()
    })

    it('a declared change pending re-verification is surfaced on the row', () => {
        mockUser = { residence: { declared: 'ES', verified: 'BR' }, user: { userId: 'u1' } }
        render()
        expect(screen.getByText('Update to Spain pending re-verification')).toBeInTheDocument()
    })
})
