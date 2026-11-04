import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { SumsubKycModals } from '../SumsubKycModals'
import type { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('../SumsubKycWrapper', () => ({ SumsubKycWrapper: () => null }))
jest.mock('../KycRestartCooldownModal', () => ({ KycRestartCooldownModal: () => null }))
jest.mock('../KycVerificationInProgressModal', () => ({ KycVerificationInProgressModal: () => null }))
jest.mock('../modals/KycFailedModal', () => ({
    KycFailedModal: ({
        visible,
        isTerminal,
        onClose,
    }: {
        visible: boolean
        isTerminal?: boolean
        onClose: () => void
    }) => (visible ? <button onClick={onClose}>{isTerminal ? 'Account review' : 'Retry'}</button> : null),
}))
jest.mock('@/components/Global/IframeWrapper', () => ({
    __esModule: true,
    default: ({ visible, onClose }: { visible: boolean; onClose: (source?: string) => void }) =>
        visible ? (
            <>
                <button onClick={() => onClose()}>Close terms page</button>
                <button onClick={() => onClose('tos_accepted')}>Accept on terms page</button>
            </>
        ) : null,
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({
        visible,
        onClose,
        ctas,
    }: {
        visible: boolean
        onClose: () => void
        ctas: Array<{ text: string; onClick: () => void }>
    }) =>
        visible ? (
            <>
                <button onClick={onClose}>Dismiss</button>
                {ctas.map((cta) => (
                    <button key={cta.text} onClick={cta.onClick}>
                        {cta.text}
                    </button>
                ))}
            </>
        ) : null,
}))

beforeEach(() => jest.clearAllMocks())

it.each(['kyc_legacy', 'kyc_provider_request'] as const)(
    'records correction and dismissal for %s without session or correction details',
    (controlFlow) => {
        const flow = {
            showCorrection: true,
            verificationSession: { id: 'private-session', generation: 1, reasonCode: 'INVALID_TAX_ID' },
            correctVerificationData: jest.fn(),
            dismissCorrection: jest.fn(),
            isProviderRequest: controlFlow === 'kyc_provider_request',
        } as unknown as ReturnType<typeof useMultiPhaseKycFlow>
        renderWithIntl(<SumsubKycModals flow={flow} />)
        fireEvent.click(screen.getByRole('button', { name: /correct/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
        const capture = posthog.capture as jest.Mock
        expect(capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            [
                ANALYTICS_EVENTS.CONTROL_USED,
                { flow: controlFlow, screen_id: 'correction', control: 'correct_data', action: 'tap' },
            ],
            [
                ANALYTICS_EVENTS.CONTROL_USED,
                { flow: controlFlow, screen_id: 'correction', control: 'correction', action: 'dismiss' },
            ],
        ])
        expect(flow.correctVerificationData).toHaveBeenCalledTimes(1)
        expect(flow.dismissCorrection).toHaveBeenCalledTimes(1)
        expect(JSON.stringify(capture.mock.calls)).not.toContain('private-session')
        expect(JSON.stringify(capture.mock.calls)).not.toContain('INVALID_TAX_ID')
    }
)

it.each(['kyc_legacy', 'kyc_provider_request'] as const)(
    'records a manual exit from the terms page for %s, and nothing when the page reports the signature',
    (controlFlow) => {
        const flow = {
            isProviderRequest: controlFlow === 'kyc_provider_request',
            tosLink: 'https://private-provider.example/tos?token=private-token',
            showTosIframe: true,
            handleTosIframeClose: jest.fn(),
        } as unknown as ReturnType<typeof useMultiPhaseKycFlow>
        renderWithIntl(<SumsubKycModals flow={flow} />)
        fireEvent.click(screen.getByRole('button', { name: 'Close terms page' }))
        fireEvent.click(screen.getByRole('button', { name: 'Accept on terms page' }))
        const capture = posthog.capture as jest.Mock
        expect(capture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.CONTROL_USED)).toEqual([
            [
                ANALYTICS_EVENTS.CONTROL_USED,
                { flow: controlFlow, screen_id: 'tos', control: 'tos_page', action: 'dismiss' },
            ],
        ])
        expect(flow.handleTosIframeClose).toHaveBeenNthCalledWith(1, 'manual')
        expect(flow.handleTosIframeClose).toHaveBeenNthCalledWith(2, 'tos_accepted')
        expect(JSON.stringify(capture.mock.calls)).not.toContain('private-token')
    }
)

it('shows the account review when a final rejection stops a new verification (H9)', () => {
    const flow = {
        showVerificationReview: true,
        dismissVerificationReview: jest.fn(),
    } as unknown as ReturnType<typeof useMultiPhaseKycFlow>
    renderWithIntl(<SumsubKycModals flow={flow} />)
    fireEvent.click(screen.getByRole('button', { name: 'Account review' }))
    expect(flow.dismissVerificationReview).toHaveBeenCalledTimes(1)
})
