import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render, renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useWaitingOnProviderModal } from '@/hooks/useWaitingOnProviderModal'
import { KycReverificationPendingModal } from '../KycReverificationPendingModal'
import { InitiateKycModal } from '../InitiateKycModal'
import { KycSetupStatusDrawer } from '../KycSetupStatusDrawer'
import type { SetupRow } from '@/utils/kyc-setup-status.utils'

const mockSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ openSupportWithMessage: mockSupport, setIsSupportModalOpen: jest.fn() }),
    useModalsContextOptional: () => undefined,
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({ useResidenceRestrictions: () => ({ banking: false }) }))
jest.mock('@/hooks/useIdentityVerification', () => ({ useIdentityVerification: () => ({ isRegionRestricted: false }) }))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const slowMessage =
    "This is taking longer than usual. Our payment partner is still reviewing your details. Contact support and we'll check on it."
const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>>) =>
    render(
        <InitiateKycModal visible onClose={jest.fn()} onVerify={jest.fn()} variant="provider_rejection" {...props} />
    )
const renderDrawer = (rows: SetupRow[]) => {
    const onVerifyAgain = jest.fn()
    const onUploadDocument = jest.fn()
    const onReviewTerms = jest.fn()
    render(
        <KycSetupStatusDrawer
            open
            residence="BR"
            rows={rows}
            onClose={jest.fn()}
            onContinue={jest.fn()}
            onVerifyAgain={onVerifyAgain}
            onUploadDocument={onUploadDocument}
            onReviewTerms={onReviewTerms}
        />
    )
    return { onVerifyAgain, onUploadDocument, onReviewTerms }
}

beforeEach(() => jest.clearAllMocks())

describe('KYC follow-up actions', () => {
    it.each([
        'eea_uplift',
        'eea_uplift_with_tin',
        'source_of_funds',
        'tax_identification_number',
        'birth_details',
        'bridge_answers_rejected',
    ])('%s asks for answers', (reasonCode) => {
        renderModal({ reasonCode })
        expect(screen.getByRole('button', { name: 'Answer questions' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument()
    })
    it('a government ID requirement asks for a clear retake', () => {
        renderModal({
            nextAction: {
                key: 'sumsub:id',
                kind: 'sumsub',
                purpose: 'unlock-bridge',
                requirementKey: 'government_id_front',
            },
        })
        expect(screen.getByRole('button', { name: 'Retake ID photo' })).toBeInTheDocument()
        expect(
            screen.getByText(
                'Our payment partner needs a new, clear photo of your ID. Use a valid document and show all of it.'
            )
        ).toBeInTheDocument()
    })
    it('keeps the tax ID re-upload wording and upload action', () => {
        renderModal({ reasonCode: 'eea_tin_reupload' })
        expect(screen.getByRole('button', { name: 'Upload document' })).toBeInTheDocument()
        expect(screen.getByText('Please re-upload your tax identification number.')).toBeInTheDocument()
    })
    it('an overdue Bridge review offers support', () => {
        const onContactSupport = jest.fn()
        renderModal({
            reasonCode: 'bridge_processing',
            pendingSince: new Date(Date.now() - 25 * 3600000).toISOString(),
            onContactSupport,
        })
        expect(screen.getByText(slowMessage)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
    it.each([undefined, 'invalid', new Date(Date.now() + 3600000).toISOString()])(
        'a missing or invalid wait timestamp preserves the normal wait: %s',
        (pendingSince) => {
            renderModal({ reasonCode: 'bridge_processing', pendingSince })
            expect(screen.queryByText(slowMessage)).not.toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
        }
    )
    it('an identity restart precedes a document and card agreements', () => {
        const handlers = renderDrawer([
            { key: 'bank', state: 'document-needed', step: { provider: 'bridge' } },
            { key: 'local', state: 'verify-again' },
            { key: 'card', state: 'agreements-needed' },
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))
        expect(handlers.onVerifyAgain).toHaveBeenCalledTimes(1)
        expect(handlers.onUploadDocument).not.toHaveBeenCalled()
    })
    it('terms precede an identity restart', () => {
        const handlers = renderDrawer([
            { key: 'bank', state: 'terms-needed' },
            { key: 'local', state: 'verify-again' },
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Review terms' }))
        expect(handlers.onReviewTerms).toHaveBeenCalledTimes(1)
        expect(handlers.onVerifyAgain).not.toHaveBeenCalled()
    })
    it('document and terms rows explain the request', () => {
        renderDrawer([
            { key: 'bank', state: 'document-needed', step: { provider: 'bridge' } },
            { key: 'local', state: 'terms-needed' },
        ])
        expect(
            screen.getByText('Our payment partner needs one more document to finish opening this account.')
        ).toBeInTheDocument()
        expect(screen.getByText('Accept the updated terms to keep using bank transfers.')).toBeInTheDocument()
    })
    it('an overdue setting-up row offers support with the reason', () => {
        renderDrawer([
            {
                key: 'bank',
                state: 'setting-up',
                reason: 'bridge_processing',
                pendingSince: new Date(Date.now() - 25 * 3600000).toISOString(),
            },
        ])
        expect(screen.getByText(slowMessage)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(mockSupport).toHaveBeenCalledWith(expect.stringContaining('reason: bridge_processing'))
    })
    it('the waiting hook opens support with the rail reason and closes', () => {
        const { result } = renderHook(() =>
            useWaitingOnProviderModal({
                kind: 'waiting-on-provider',
                userMessage: 'Reviewing',
                reason: { code: 'bridge_processing', userMessage: 'Reviewing' },
                pendingSince: new Date(Date.now() - 25 * 3600000).toISOString(),
                railId: 'bridge.ach_us',
            })
        )
        act(() => result.current.open())
        expect(result.current.message).toBe(slowMessage)
        expect(result.current.onContactSupport).toEqual(expect.any(Function))
        act(() => result.current.onContactSupport?.())
        expect(result.current.isOpen).toBe(false)
        expect(mockSupport).toHaveBeenCalledWith(expect.stringContaining('reason: bridge_processing'))
        expect(mockSupport).toHaveBeenCalledWith(expect.stringContaining('rail: bridge.ach_us'))
    })
    it('the waiting modal uses its support action', () => {
        const onContactSupport = jest.fn()
        render(
            <KycReverificationPendingModal
                isOpen
                onClose={jest.fn()}
                message={slowMessage}
                onContactSupport={onContactSupport}
            />
        )
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
})
