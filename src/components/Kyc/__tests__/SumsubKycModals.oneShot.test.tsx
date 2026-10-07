/**
 * The one-shot wiring of the shared modals (TASK-23329, item 9b): each
 * drawer button reaches the flow's own handler, the card step's screens are
 * mounted, and the drawer steps aside while an SDK session or the agreements
 * are on screen.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { useMultiPhaseKycFlow } from '@/hooks/useMultiPhaseKycFlow'
import type { SetupRow } from '@/utils/one-shot-setup.utils'
import { SumsubKycModals } from '../SumsubKycModals'

const push = jest.fn()
const setIsSupportModalOpen = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen }) }))
// the SDK needs a browser; here only its mount and its token matter
jest.mock('@/components/Kyc/SumsubKycWrapper', () => ({
    SumsubKycWrapper: ({ visible, accessToken }: { visible: boolean; accessToken: string | null }) =>
        visible ? <div data-testid="sdk" data-token={accessToken} /> : null,
}))

type Flow = ReturnType<typeof useMultiPhaseKycFlow>

function makeFlow(rows: SetupRow[], overrides: Partial<Flow> = {}): Flow {
    const card = {
        chain: null,
        token: null,
        showTerms: false,
        isBusy: false,
        isForeground: false,
        start: jest.fn(),
        resume: jest.fn(),
        acceptTerms: jest.fn(),
        dismissTerms: jest.fn(),
        handleSdkComplete: jest.fn(),
        handleSdkClose: jest.fn(),
        refreshToken: jest.fn(),
        reset: jest.fn(),
    }
    return {
        showCorrection: false,
        dismissCorrection: jest.fn(),
        verificationSession: null,
        correctVerificationData: jest.fn(),
        errorCooldown: null,
        dismissErrorCooldown: jest.fn(),
        showWrapper: false,
        accessToken: null,
        handleSdkClose: jest.fn(),
        handleSdkComplete: jest.fn(),
        handleSdkSubmitted: jest.fn(),
        refreshToken: jest.fn(),
        isMultiLevel: false,
        isModalOpen: true,
        modalPhase: 'verifying',
        handleModalClose: jest.fn(),
        handleAcceptTerms: jest.fn(),
        handleSkipTerms: jest.fn(),
        completeFlow: jest.fn(),
        tosError: null,
        isLoadingTos: false,
        preparingTimedOut: false,
        preparingStage: 'initial',
        tosLink: null,
        showTosIframe: false,
        handleTosIframeClose: jest.fn(),
        handleInitiateKyc: jest.fn(),
        handleRestartIdentity: jest.fn(),
        handleFixableGate: jest.fn(),
        oneShotSetup: { residence: 'BR', rows },
        oneShotCard: card,
        oneShotRetake: false,
        ...overrides,
    } as unknown as Flow
}

const renderModals = (flow: Flow) =>
    render(
        <IntlWrapper>
            <SumsubKycModals flow={flow} />
        </IntlWrapper>
    )

describe('SumsubKycModals — one-shot', () => {
    beforeEach(() => jest.clearAllMocks())

    it('Continue card setup resumes the card step; a failed request retries it', () => {
        const flow = makeFlow([{ key: 'card', state: 'agreements-needed' }], {})
        flow.oneShotCard.chain = { kind: 'error', message: 'Network down' }
        renderModals(flow)
        fireEvent.click(screen.getByRole('button', { name: 'Continue card setup' }))
        expect(flow.oneShotCard.resume).toHaveBeenCalledTimes(1)
        fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
        expect(flow.oneShotCard.start).toHaveBeenCalledTimes(1)
    })

    it('Verify again calls the identity restart', () => {
        const flow = makeFlow([{ key: 'bank', state: 'needs-local-id' }])
        renderModals(flow)
        fireEvent.click(screen.getByRole('button', { name: 'Verify again with a Brazil ID' }))
        expect(flow.handleRestartIdentity).toHaveBeenCalledTimes(1)
    })

    it('Upload now opens the provider step through the fixable gate; a card document goes to the card page', () => {
        const action = { key: 'sumsub:proof_of_address', kind: 'sumsub' as const, purpose: 'unlock-bridge' }
        const flow = makeFlow([
            {
                key: 'bank',
                state: 'document-needed',
                step: { provider: 'bridge', action, reasonCode: 'proof_of_address' },
            },
        ])
        renderModals(flow)
        fireEvent.click(screen.getByRole('button', { name: 'Upload now' }))
        expect(flow.handleFixableGate).toHaveBeenCalledWith('BRIDGE', {
            actionKey: action.key,
            reason: { code: 'proof_of_address' },
        })

        const rain = makeFlow([{ key: 'card', state: 'document-needed', step: { provider: 'rain' } }])
        render(
            <IntlWrapper>
                <SumsubKycModals flow={rain} />
            </IntlWrapper>
        )
        fireEvent.click(screen.getAllByRole('button', { name: 'Upload now' }).at(-1)!)
        expect(push).toHaveBeenCalledWith('/card')
        expect(rain.handleFixableGate).not.toHaveBeenCalled()
    })

    it('a missing identity step of the card resumes the card step; the residence confirmation goes to the card page', () => {
        const identity = makeFlow([
            { key: 'card', state: 'document-needed', step: { provider: 'rain', reasonCode: 'main-kyc-required' } },
        ])
        identity.oneShotCard.chain = { kind: 'identity-step', token: 'tok-main' }
        renderModals(identity)
        fireEvent.click(screen.getByRole('button', { name: 'Upload now' }))
        expect(identity.oneShotCard.resume).toHaveBeenCalledTimes(1)
        expect(push).not.toHaveBeenCalled()

        const confirmation = makeFlow([{ key: 'card', state: 'agreements-needed' }])
        confirmation.oneShotCard.chain = { kind: 'country-confirmation', candidates: ['BR', 'PT'] }
        render(
            <IntlWrapper>
                <SumsubKycModals flow={confirmation} />
            </IntlWrapper>
        )
        fireEvent.click(screen.getAllByRole('button', { name: 'Continue card setup' }).at(-1)!)
        expect(push).toHaveBeenCalledWith('/card')
        expect(confirmation.oneShotCard.resume).not.toHaveBeenCalled()
    })

    it('Retake photo reopens the check; Contact support opens the support modal', () => {
        const flow = makeFlow([{ key: 'qr', state: 'under-review' }], { oneShotRetake: true })
        renderModals(flow)
        fireEvent.click(screen.getByRole('button', { name: 'Retake photo' }))
        expect(flow.handleInitiateKyc).toHaveBeenCalledTimes(1)

        const refused = makeFlow([{ key: 'card', state: 'occupation-not-accepted' }])
        render(
            <IntlWrapper>
                <SumsubKycModals flow={refused} />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(setIsSupportModalOpen).toHaveBeenCalledWith(true)
    })

    it('steps aside while the card SDK or the identity SDK is on screen', () => {
        const flow = makeFlow([{ key: 'card', state: 'agreements-needed' }])
        flow.oneShotCard.token = 'tok-questions'
        flow.oneShotCard.isForeground = true
        renderModals(flow)
        expect(screen.getByTestId('sdk')).toHaveAttribute('data-token', 'tok-questions')
        expect(screen.queryByTestId('one-shot-setup')).not.toBeInTheDocument()

        const restarting = makeFlow([{ key: 'bank', state: 'needs-local-id' }], {
            showWrapper: true,
            accessToken: 'tok-r',
        })
        render(
            <IntlWrapper>
                <SumsubKycModals flow={restarting} />
            </IntlWrapper>
        )
        expect(screen.queryByTestId('one-shot-setup')).not.toBeInTheDocument()
    })
})
