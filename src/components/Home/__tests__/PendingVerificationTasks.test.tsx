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
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'user-1' } }, fetchUser: mockFetchUser }),
}))
jest.mock('@/utils/general.utils', () => ({
    getUserPreferences: () => ({ pendingVerificationTasksDismissed: mockStoredDismissal }),
    updateUserPreferences: (userId: string, prefs: Record<string, unknown>) => mockUpdatePreferences(userId, prefs),
}))
jest.mock('@/app/actions/sumsub', () => ({
    startBridgeHostedVerification: () => mockStartHosted(),
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
        mockStoredDismissal = undefined
        mockUpdatePreferences.mockReset()
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

    it('advisory task renders its deadline and keep-access copy; blocking renders enable copy', () => {
        mockNextActions = [{ ...hostedAction, effectiveDate: '2099-09-01' }]
        const { rerender } = render(<PendingVerificationTasks />)
        expect(screen.getByText(/complete before sep 1, 2099/i)).toBeInTheDocument()
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
        it("a slide's X dismisses ONLY that task — the other slide stays and the key persists", () => {
            mockNextActions = [tosAction, hostedAction]
            render(<PendingVerificationTasks dismissible />)

            fireEvent.click(screen.getByRole('button', { name: /dismiss accept terms of service/i }))
            expect(screen.queryByText('Accept Terms of Service')).not.toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
            expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
                pendingVerificationTasksDismissed: ['accept-tos'],
            })
        })

        it('dismissing the last remaining task hides the card entirely', () => {
            mockStoredDismissal = ['accept-tos']
            mockNextActions = [tosAction, hostedAction]
            const { container } = render(<PendingVerificationTasks dismissible />)

            fireEvent.click(screen.getByRole('button', { name: /dismiss additional verification needed/i }))
            expect(container).toBeEmptyDOMElement()
            expect(mockUpdatePreferences).toHaveBeenCalledWith('user-1', {
                pendingVerificationTasksDismissed: ['accept-tos', 'bridge-hosted'],
            })
        })

        it('stored dismissed keys hide only their tasks; undismissed tasks still show', () => {
            mockStoredDismissal = ['accept-tos']
            mockNextActions = [tosAction, hostedAction]
            render(<PendingVerificationTasks dismissible />)
            expect(screen.queryByText('Accept Terms of Service')).not.toBeInTheDocument()
            expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
        })

        it('all pending tasks stored as dismissed → card hidden', () => {
            mockStoredDismissal = ['accept-tos', 'bridge-hosted']
            mockNextActions = [tosAction, hostedAction]
            const { container } = render(<PendingVerificationTasks dismissible />)
            expect(container).toBeEmptyDOMElement()
        })

        it('the non-dismissible (profile) mount ignores stored dismissals and has no X', () => {
            mockStoredDismissal = ['accept-tos', 'bridge-hosted']
            mockNextActions = [tosAction, hostedAction]
            render(<PendingVerificationTasks />)
            expect(screen.getByText('Accept Terms of Service')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: /dismiss/i })).not.toBeInTheDocument()
        })
    })
})
