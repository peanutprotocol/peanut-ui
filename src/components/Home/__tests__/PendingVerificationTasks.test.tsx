/**
 * PendingVerificationTasks — the Home card mirroring Bridge's "additional
 * verification needed" dashboard state.
 *
 * Reads top-level capability nextActions (not rail gates) so it catches both
 * blocking tasks and advisory orphans (future-dated tasks on fully-enabled
 * users, which no rail references). accept-tos routes into the existing
 * BridgeTosStep; bridge-hosted exchanges the key for a hosted URL and opens
 * it in the IframeWrapper. Open flows are snapshotted at tap time so they
 * survive the task list flapping under the ~4s user auto-refresh.
 */
import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithIntl as render } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import PendingVerificationTasks from '../PendingVerificationTasks'

let mockNextActions: NextAction[] = []
const mockFetchUser = jest.fn()
const mockStartHosted = jest.fn<Promise<{ url?: string; error?: string }>, []>()
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
jest.mock('@/app/actions/sumsub', () => ({
    startBridgeHostedVerification: () => mockStartHosted(),
}))
const mockConfirmTos = jest.fn<Promise<void>, [unknown]>()
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    confirmBridgeTosAndAwaitRails: (fetchUser: () => Promise<unknown>) => mockConfirmTos(fetchUser),
}))
jest.mock('@/components/Kyc/BridgeTosStep', () => ({
    BridgeTosStep: (props: { visible: boolean; reasonCode?: string }) =>
        props.visible ? <div data-testid="tos-step">{props.reasonCode}</div> : null,
}))
jest.mock('@/components/Global/IframeWrapper', () => ({
    __esModule: true,
    default: (props: { src: string; visible: boolean; onClose: (source?: string) => void }) =>
        props.visible ? (
            <div data-testid="hosted-iframe" data-src={props.src}>
                <button onClick={() => props.onClose('completed')}>finish</button>
                <button onClick={() => props.onClose('manual')}>close</button>
                <button onClick={() => props.onClose('tos_accepted')}>accept-embedded-tos</button>
            </div>
        ) : null,
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
        mockStartHosted.mockReset()
        mockConfirmTos.mockReset()
        mockConfirmTos.mockResolvedValue(undefined)
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

    it('bridge-hosted task fetches the hosted URL, opens the iframe, and refreshes the user on completion', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<PendingVerificationTasks />)

        expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))

        const iframe = await screen.findByTestId('hosted-iframe')
        expect(iframe).toHaveAttribute('data-src', 'https://bridge.withpersona.com/verify?x=1')

        fireEvent.click(screen.getByText('finish'))
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
    })

    it('an open hosted iframe SURVIVES its task disappearing from nextActions (auto-refresh flap)', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        const { rerender } = render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        await screen.findByTestId('hosted-iframe')

        // Bridge reclassifies mid-flow → the task vanishes on the next refetch.
        mockNextActions = []
        rerender(<PendingVerificationTasks />)

        expect(screen.queryByText('Additional verification needed')).not.toBeInTheDocument()
        expect(screen.getByTestId('hosted-iframe')).toBeInTheDocument()

        fireEvent.click(screen.getByText('close'))
        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
    })

    it('manual iframe close does not refetch the user', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        await screen.findByTestId('hosted-iframe')
        fireEvent.click(screen.getByText('close'))

        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
        expect(mockFetchUser).not.toHaveBeenCalled()
    })

    it('start-action failure surfaces FRIENDLY copy (never the raw server error) and resyncs the user', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ error: 'Action not allowed for this user' })
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        expect(await screen.findByText(/couldn't start the verification/i)).toBeInTheDocument()
        expect(screen.queryByText('Action not allowed for this user')).not.toBeInTheDocument()
        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
        expect(mockFetchUser).toHaveBeenCalledTimes(1)
    })

    it('an EMBEDDED ToS step inside the hosted flow CONFIRMS to the backend and does NOT close the iframe', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        await screen.findByTestId('hosted-iframe')

        // Bridge's hosted kyc_link flow can open with a ToS-acceptance page;
        // its signedAgreementId postMessage maps to onClose('tos_accepted').
        // A bare fetchUser would NOT record the acceptance (the resolver is
        // pure) — the canonical confirm path must run, and it refetches.
        fireEvent.click(screen.getByText('accept-embedded-tos'))
        expect(screen.getByTestId('hosted-iframe')).toBeInTheDocument()
        await waitFor(() => expect(mockConfirmTos).toHaveBeenCalledTimes(1))
        expect(mockConfirmTos).toHaveBeenCalledWith(mockFetchUser)

        // The user then finishes the identity steps — completion still closes.
        fireEvent.click(screen.getByText('finish'))
        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
    })

    it('a failed embedded-ToS confirm still resyncs the user and keeps the flow alive', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ url: 'https://bridge.withpersona.com/verify?x=1' })
        mockConfirmTos.mockRejectedValue(new Error('confirm blew up'))
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        await screen.findByTestId('hosted-iframe')

        fireEvent.click(screen.getByText('accept-embedded-tos'))
        await waitFor(() => expect(mockFetchUser).toHaveBeenCalledTimes(1))
        expect(screen.getByTestId('hosted-iframe')).toBeInTheDocument()
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
