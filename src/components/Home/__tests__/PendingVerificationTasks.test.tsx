/**
 * PendingVerificationTasks — the Home card mirroring Bridge's "additional
 * verification needed" dashboard state.
 *
 * Reads top-level capability nextActions (not rail gates) so it catches both
 * blocking tasks and advisory orphans (future-dated tasks on fully-enabled
 * users, which no rail references). accept-tos routes into the existing
 * BridgeTosStep; bridge-hosted exchanges the key for a hosted URL and opens
 * it in the IframeWrapper.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { NextAction } from '@/types/capabilities'
import PendingVerificationTasks from '../PendingVerificationTasks'

let mockNextActions: NextAction[] = []
const mockFetchUser = jest.fn()
const mockStartHosted = jest.fn<Promise<{ url?: string; error?: string }>, []>()

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ nextActions: mockNextActions }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ fetchUser: mockFetchUser }),
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
    })

    it('renders nothing when no bridge task is pending', () => {
        mockNextActions = [{ key: 'sumsub:proof_of_address', kind: 'sumsub', purpose: 'unlock-bridge' }]
        const { container } = render(<PendingVerificationTasks />)
        expect(container).toBeEmptyDOMElement()
    })

    it('accept-tos task opens BridgeTosStep with the variant-matched reason code', () => {
        mockNextActions = [{ ...tosAction, key: 'accept-tos:sepa', purpose: 'accept-bridge-tos-sepa' }]
        render(<PendingVerificationTasks />)

        expect(screen.getByText('Accept SEPA Terms of Service')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /review terms/i }))
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

    it('start-action failure surfaces an inline error instead of an iframe', async () => {
        mockNextActions = [hostedAction]
        mockStartHosted.mockResolvedValue({ error: 'Action not allowed for this user' })
        render(<PendingVerificationTasks />)

        fireEvent.click(screen.getByRole('button', { name: /complete verification/i }))
        expect(await screen.findByText('Action not allowed for this user')).toBeInTheDocument()
        expect(screen.queryByTestId('hosted-iframe')).not.toBeInTheDocument()
    })

    it('advisory task renders its deadline', () => {
        mockNextActions = [{ ...hostedAction, effectiveDate: '2099-09-01' }]
        render(<PendingVerificationTasks />)
        expect(screen.getByText(/complete before sep 1, 2099/i)).toBeInTheDocument()
    })

    it('renders both tasks when ToS and hosted verification are pending together', () => {
        mockNextActions = [tosAction, hostedAction]
        render(<PendingVerificationTasks />)
        expect(screen.getByText('Accept Terms of Service')).toBeInTheDocument()
        expect(screen.getByText('Additional verification needed')).toBeInTheDocument()
    })
})
