/**
 * PendingVerificationTasks — the Home card mirroring Bridge's "additional
 * verification needed" dashboard state.
 *
 * Reads top-level capability nextActions (not rail gates) so it catches both
 * blocking tasks and advisory orphans (future-dated tasks on fully-enabled
 * users, which no rail references). accept-tos routes into the existing
 * BridgeTosStep (its compliance.bridge.xyz link frames fine); bridge-hosted
 * routes to the additional-verification screen, which owns the prep copy and
 * the handoff to Persona (see AdditionalVerificationView). The ToS modal is
 * snapshotted at tap time so it survives the task list flapping under the ~4s
 * user auto-refresh.
 */
import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import PendingVerificationTasks from '../PendingVerificationTasks'

let mockNextActions: NextAction[] = []
const mockFetchUser = jest.fn(() => Promise.resolve(null))
let mockStoredDismissal: string[] | undefined
const mockUpdatePreferences = jest.fn()

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ nextActions: mockNextActions }),
}))
let mockUserId = 'user-1'
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: mockUserId } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => ({ pendingVerificationTasksDismissed: mockStoredDismissal }),
    updateUserPreferences: (userId: string, prefs: Record<string, unknown>) => mockUpdatePreferences(userId, prefs),
}))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: { visible: boolean; reasonCode?: string }) =>
        props.visible ? <div data-testid="tos-step">{props.reasonCode}</div> : null,
}))
jest.mock('@/utils/capacitor', () => ({
    isNativeBridge: () => false,
    // mobile-release's mascot picker + useAppHaptic call these
    isAndroidNative: () => false,
    isCapacitor: () => false,
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush }),
}))

const tosAction: NextAction = { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }
const sepaTosAction: NextAction = {
    key: 'accept-tos:sepa',
    kind: 'accept-tos',
    purpose: 'accept-bridge-tos-sepa',
}
const hostedAction: NextAction = {
    key: 'bridge-hosted',
    kind: 'bridge-hosted',
    purpose: 'bridge-additional-verification',
    requirementKey: 'kyc_approval',
}

describe('PendingVerificationTasks', () => {
    beforeEach(() => {
        mockNextActions = []
        mockFetchUser.mockReset()
        mockFetchUser.mockResolvedValue(null)
        mockRouterPush.mockReset()
        mockStoredDismissal = undefined
        mockUpdatePreferences.mockReset()
        mockUserId = 'user-1'
    })

    it('renders nothing when no bridge task is pending', () => {
        mockNextActions = [{ key: 'sumsub:proof_of_address', kind: 'sumsub', purpose: 'unlock-bridge' }]
        const { container } = render(<PendingVerificationTasks />)
        expect(container).toBeEmptyDOMElement()
    })

    it('accept-tos task opens BridgeTosStep with the variant-matched reason code', () => {
        mockNextActions = [sepaTosAction]
        render(<PendingVerificationTasks />)

        expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /review terms/i }))
        expect(screen.getByTestId('tos-step')).toHaveTextContent('bridge_tos_v2_required')
    })

    it('with BOTH ToS variants pending, each row opens the modal for ITS variant', () => {
        mockNextActions = [tosAction, sepaTosAction]
        render(<PendingVerificationTasks />)

        expect(screen.getByText('Accept Terms of Service')).toBeInTheDocument()
        expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()

        const buttons = screen.getAllByRole('button', { name: /review terms/i })
        fireEvent.click(buttons[1]) // sepa row (render order follows nextActions)
        expect(screen.getByTestId('tos-step')).toHaveTextContent('bridge_tos_v2_required')
    })

    it('bridge-hosted routes to the prep screen rather than handing straight to the vendor', () => {
        // Persona runs in a browser we don't control and saves nothing: a user
        // who leaves mid-check to find a document restarts from step one. The
        // screen that says so owns the handoff, so the card only navigates.
        mockNextActions = [hostedAction]
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        expect(mockRouterPush).toHaveBeenCalledWith('/profile/identity-verification/additional')
    })

    it('advisory task renders its deadline and keep-access copy; blocking renders enable copy', () => {
        mockNextActions = [{ ...hostedAction, effectiveDate: '2099-09-01' }]
        const { rerender } = render(<PendingVerificationTasks />)
        // Long month — the SAME formatter AdvisoryPreemptModal uses
        // (formatEffectiveDate), so one deadline never renders two ways.
        expect(screen.getByText(/complete before september 1, 2099/i)).toBeInTheDocument()
        expect(screen.getByText(/keep bank transfers available/i)).toBeInTheDocument()

        mockNextActions = [hostedAction]
        rerender(<PendingVerificationTasks />)
        expect(screen.getByText(/enable bank transfers/i)).toBeInTheDocument()
        expect(screen.queryByText(/complete before/i)).not.toBeInTheDocument()
    })

    it('malformed effectiveDate renders no deadline line instead of "Invalid Date"', () => {
        mockNextActions = [{ ...hostedAction, effectiveDate: 'not-a-date' }]
        render(<PendingVerificationTasks />)
        expect(screen.queryByText(/complete before/i)).not.toBeInTheDocument()
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
    })

    it('renders both tasks when ToS and hosted verification are pending together', () => {
        mockNextActions = [tosAction, hostedAction]
        render(<PendingVerificationTasks />)
        expect(screen.getByText('Accept Terms of Service')).toBeInTheDocument()
        expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
    })

    describe('dismissal (home mount)', () => {
        // Only ADVISORY (future-dated) tasks are dismissible — a blocking
        // fingerprint is constant over time, so honoring one would hide a NEW
        // same-variant requirement while the user's rails are gated.
        const advisoryTos: NextAction = {
            ...sepaTosAction,
            requirementKey: 'tos_v2_acceptance',
            effectiveDate: '2099-09-01',
        }
        const advisoryHosted: NextAction = { ...hostedAction, effectiveDate: '2099-12-01' }
        const advisoryTosFingerprint = 'accept-tos:sepa|tos_v2_acceptance|2099-09-01'
        const advisoryHostedFingerprint = 'bridge-hosted|kyc_approval|2099-12-01'
        // Pre-fix localStorage can still carry blocking fingerprints.
        const legacyBlockingFingerprints = ['accept-tos||due-now', 'bridge-hosted|kyc_approval|due-now']

        it("an advisory slide's X dismisses ONLY that task — the other slide stays and the fingerprint persists", () => {
            mockNextActions = [advisoryTos, advisoryHosted]
            render(<PendingVerificationTasks dismissible />)

            fireEvent.click(screen.getByRole('button', { name: /dismiss accept sepa terms of service/i }))
            expect(screen.queryByText('Accept SEPA Terms of Service')).not.toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
            expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
                pendingVerificationTasksDismissed: [advisoryTosFingerprint],
            })
        })

        it('BLOCKING slides carry no X; advisory siblings on the same mount do', () => {
            mockNextActions = [tosAction, advisoryHosted]
            render(<PendingVerificationTasks dismissible />)

            expect(screen.queryByRole('button', { name: /dismiss accept terms of service/i })).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: /dismiss additional verification needed/i })).toBeInTheDocument()
        })

        it('a stored (pre-fix) blocking fingerprint never hides a blocking task', () => {
            mockStoredDismissal = legacyBlockingFingerprints
            mockNextActions = [tosAction, hostedAction]
            render(<PendingVerificationTasks dismissible />)
            expect(screen.getByText('Accept Terms of Service')).toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        })

        it('dismissing the last remaining advisory hides the card entirely', () => {
            mockStoredDismissal = [advisoryTosFingerprint]
            mockNextActions = [advisoryTos, advisoryHosted]
            const { container } = render(<PendingVerificationTasks dismissible />)

            fireEvent.click(screen.getByRole('button', { name: /dismiss additional verification needed/i }))
            expect(container).toBeEmptyDOMElement()
            expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
                pendingVerificationTasksDismissed: [advisoryTosFingerprint, advisoryHostedFingerprint],
            })
        })

        it('stored dismissed fingerprints hide only their advisories; undismissed tasks still show', () => {
            mockStoredDismissal = [advisoryTosFingerprint]
            mockNextActions = [advisoryTos, advisoryHosted]
            render(<PendingVerificationTasks dismissible />)
            expect(screen.queryByText('Accept SEPA Terms of Service')).not.toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        })

        it('a dismissed ADVISORY task re-surfaces when it turns blocking (same key, date gone)', () => {
            // User dismissed the "complete before Sep 1" reminder in July…
            mockStoredDismissal = [advisoryTosFingerprint]
            // …and on Sep 1 Bridge reclassifies the same requirement as due now.
            mockNextActions = [{ ...sepaTosAction, requirementKey: 'tos_v2_acceptance' }]
            render(<PendingVerificationTasks dismissible />)
            expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()
        })

        it('a NEW requirement under the shared bridge-hosted key re-surfaces despite a dismissal', () => {
            mockStoredDismissal = [advisoryHostedFingerprint]
            mockNextActions = [{ ...advisoryHosted, requirementKey: 'kyc_with_proof_of_address' }]
            render(<PendingVerificationTasks dismissible />)
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        })

        it('all pending advisories stored as dismissed → card hidden', () => {
            mockStoredDismissal = [advisoryTosFingerprint, advisoryHostedFingerprint]
            mockNextActions = [advisoryTos, advisoryHosted]
            const { container } = render(<PendingVerificationTasks dismissible />)
            expect(container).toBeEmptyDOMElement()
        })

        it("a user switch does not inherit the previous user's dismissals", () => {
            mockStoredDismissal = [advisoryTosFingerprint, advisoryHostedFingerprint]
            mockNextActions = [advisoryTos, advisoryHosted]
            const { container, rerender } = render(<PendingVerificationTasks dismissible />)
            expect(container).toBeEmptyDOMElement()

            // user-2 logs in on the same mount with no stored dismissals —
            // user-1's in-memory keys must not hide user-2's tasks.
            mockUserId = 'user-2'
            mockStoredDismissal = undefined
            rerender(<PendingVerificationTasks dismissible />)
            expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        })

        it('the non-dismissible (profile) mount ignores stored dismissals and has no X', () => {
            mockStoredDismissal = [advisoryTosFingerprint, advisoryHostedFingerprint]
            mockNextActions = [advisoryTos, advisoryHosted]
            render(<PendingVerificationTasks />)
            expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
        })
    })
})
