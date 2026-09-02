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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import UnlockPayments from '@/components/Profile/views/UnlockPayments.view'

// The view reaches for the query client (residence-change invalidation), so
// the render needs a provider even though every data hook is mocked.
const render = () =>
    rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <UnlockPayments />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )

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
let mockRegionRestricted = false
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: mockIdentity,
        isProcessing: mockIdentity.status === 'processing',
        isRegionRestricted: mockRegionRestricted,
    }),
}))
jest.mock('@/components/Kyc/modals/KycRegionRestrictedModal', () => ({
    KycRegionRestrictedModal: ({ visible }: { visible: boolean }) =>
        visible ? <div>region-restricted-modal</div> : null,
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
let mockMantecaLimits: unknown = null
let mockBridgeLimits: unknown = null
jest.mock('@/hooks/useLimits', () => ({
    useLimits: () => ({ mantecaLimits: mockMantecaLimits, bridgeLimits: mockBridgeLimits }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))

const mockInitiateKyc = jest.fn()
const mockRestartIdentity = jest.fn()
let mockFlowError: string | null = null
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleInitiateKyc: mockInitiateKyc,
        handleSelfHealResubmit: jest.fn(),
        handleRestartIdentity: mockRestartIdentity,
        isLoading: false,
        error: mockFlowError,
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
    default: ({ visible, onReverify }: { visible: boolean; onReverify: () => void }) =>
        visible ? (
            <div>
                change-modal-open
                <button onClick={onReverify}>reverify</button>
            </div>
        ) : null,
}))

describe('UnlockPayments', () => {
    beforeEach(() => {
        mockMantecaLimits = null
        mockBridgeLimits = null
        jest.clearAllMocks()
        mockRails = []
        mockRestrictions = { banking: false, card: false }
        mockUser = null
        mockIdentity = { status: 'not_started' }
        mockRegionRestricted = false
        mockKycDegraded = false
        mockFlowError = null
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

    it('a region-restricted user gets the region screen instead of an unlock offer', () => {
        mockRegionRestricted = true
        render()
        fireEvent.click(screen.getByText('SEPA transfers'))
        expect(screen.queryByText(/unlock-modal-open/)).not.toBeInTheDocument()
        expect(screen.getByText('region-restricted-modal')).toBeInTheDocument()
        expect(mockInitiateKyc).not.toHaveBeenCalled()
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
        const headers = screen.getAllByText(/^(Everywhere|South America|North America|Europe)$/)
        expect(headers[1]).toHaveTextContent('South America')
    })

    it('a fully restricted residence reads Not available on bank rows but keeps the always-on row', () => {
        mockRestrictions = { banking: true, card: true }
        render()
        expect(screen.getAllByText('Not available').length).toBeGreaterThanOrEqual(4)
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

    it('a failed residence re-verification reads as retriable, not "Not available yet"', () => {
        mockUser = { residence: { declared: 'ES', verified: 'BR' }, user: { userId: 'u1' } }
        mockFlowError = 'Not Found'
        render()
        expect(screen.getByText('Not available yet')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Change'))
        fireEvent.click(screen.getByText('reverify'))
        expect(mockRestartIdentity).toHaveBeenCalledTimes(1)

        expect(screen.getByText("Verification couldn't start")).toBeInTheDocument()
        expect(screen.queryByText('Not available yet')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Try again'))
        expect(mockRestartIdentity).toHaveBeenCalledTimes(2)
        expect(mockInitiateKyc).not.toHaveBeenCalled()
    })

    it('an active LATAM rail shows the inline monthly limit bar on Brazil', () => {
        mockRails = [{ id: 'manteca.bank', provider: 'manteca', channel: 'bank', status: 'enabled' }]
        mockMantecaLimits = [
            {
                exchangeCountry: 'BRA',
                type: 'EXCHANGE',
                asset: 'BRL',
                yearlyLimit: '120000',
                availableYearlyLimit: '100000',
                monthlyLimit: '10000',
                availableMonthlyLimit: '2500',
            },
        ]
        render()
        expect(screen.getByText(/left this month/)).toBeInTheDocument()
    })

    it('an active Bridge rail shows the per-transfer cap line', () => {
        mockRails = [{ id: 'bridge.ach', provider: 'bridge', channel: 'bank', status: 'enabled' }]
        mockBridgeLimits = { onRampPerTransaction: '25000', offRampPerTransaction: '25000', asset: 'USD' }
        render()
        expect(screen.getAllByText(/per transfer/).length).toBeGreaterThan(0)
    })

    it('the all-limits link points at /limits', () => {
        render()
        expect(screen.getByText('Payment limits').closest('a')).toHaveAttribute('href', '/limits')
    })

    it('states the P2P no-limit fact even before anything is unlocked', () => {
        render()
        expect(screen.getByText('No limits on Peanut-to-Peanut payments')).toBeInTheDocument()
    })

    it('a declared change pending re-verification is surfaced on the row', () => {
        mockUser = { residence: { declared: 'ES', verified: 'BR' }, user: { userId: 'u1' } }
        render()
        expect(screen.getByText('Update to Spain pending re-verification')).toBeInTheDocument()
    })
})
