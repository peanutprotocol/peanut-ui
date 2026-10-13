/**
 * The setup drawer after a document-first identity check: the document list's
 * feature names, one badge per state, one button for the first step the user
 * can take, and a button that leaves until every feature is available, then
 * continues. Ported from #3581 and #3599.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { NextAction } from '@/types/capabilities'
import type { SetupRow } from '@/utils/kyc-setup-status.utils'
import { KycSetupStatusDrawer } from '../KycSetupStatusDrawer'

const push = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
const openSupport = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: openSupport }),
    useModalsContextOptional: () => undefined,
}))

const renderDrawer = (
    rows: SetupRow[],
    residence: string | null = 'BR',
    extra: Partial<React.ComponentProps<typeof KycSetupStatusDrawer>> = {}
) => {
    const handlers = {
        onClose: jest.fn(),
        onContinue: jest.fn(),
        onUploadDocument: jest.fn(),
        onReviewTerms: jest.fn(),
        onVerifyAgain: jest.fn(),
    }
    render(
        <IntlWrapper>
            <KycSetupStatusDrawer open residence={residence} rows={rows} {...handlers} {...extra} />
        </IntlWrapper>
    )
    return handlers
}
const supplement: NextAction = { key: 'supplement:bridge', kind: 'sumsub', purpose: 'requirements_missing' }
const row = (key: string) => within(screen.getByTestId(`setup-row-${key}`))

describe('KycSetupStatusDrawer', () => {
    beforeEach(() => {
        push.mockClear()
        openSupport.mockClear()
    })

    it('names every saved feature as the document list does, with the badge of its state', () => {
        renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'local', state: 'under-review' },
            { key: 'bank', state: 'setting-up' },
            { key: 'card', state: 'setting-up' },
        ])
        expect(row('qr').getByText('QR payments')).toBeInTheDocument()
        expect(row('qr').getByText('Available')).toBeInTheDocument()
        expect(row('local').getByText('Local bank transfers')).toBeInTheDocument()
        expect(row('local').getByText('Under review')).toBeInTheDocument()
        expect(row('bank').getByText('USD, EUR, MXN and GBP accounts')).toBeInTheDocument()
        expect(row('bank').getByText('Setting up')).toBeInTheDocument()
        expect(row('card').getByText('Peanut card')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Setting up' })).toBeInTheDocument()
    })

    it('while a feature is not available yet, the button leaves for Home', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'setting-up' },
        ])
        fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }))
        expect(onClose).toHaveBeenCalledTimes(1)
        expect(push).toHaveBeenCalledWith('/home')
        expect(onContinue).not.toHaveBeenCalled()
    })

    it('once every feature is available it reads all set and continues', () => {
        const { onClose, onContinue } = renderDrawer([
            { key: 'qr', state: 'available' },
            { key: 'card', state: 'available' },
        ])
        expect(screen.getByRole('heading', { name: 'All set' })).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
        expect(onContinue).toHaveBeenCalledTimes(1)
        expect(onClose).not.toHaveBeenCalled()
        expect(push).not.toHaveBeenCalled()
    })

    describe('the steps', () => {
        it('a proof of address: Document needed, "Add proof of address" starts it and "Later" leaves', () => {
            const step = { provider: 'bridge' as const, action: supplement, reasonCode: 'requirements_missing' }
            const { onUploadDocument, onClose } = renderDrawer([
                { key: 'qr', state: 'available' },
                { key: 'bank', state: 'document-needed', reason: 'requirements_missing', step },
            ])
            expect(row('bank').getByText('Document needed')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Add proof of address' }))
            expect(onUploadDocument).toHaveBeenCalledWith(step)
            fireEvent.click(screen.getByRole('button', { name: 'Later' }))
            expect(onClose).toHaveBeenCalledTimes(1)
            expect(push).toHaveBeenCalledWith('/home')
        })

        it('another document a provider asks for reads "Upload now"', () => {
            const action: NextAction = { key: 'sumsub:address_of_residence', kind: 'sumsub', purpose: 'unlock-bridge' }
            const step = { provider: 'bridge' as const, action, reasonCode: 'residence_unresolved' }
            const { onUploadDocument } = renderDrawer([{ key: 'bank', state: 'document-needed', step }])
            fireEvent.click(screen.getByRole('button', { name: 'Upload now' }))
            expect(onUploadDocument).toHaveBeenCalledWith(step)
        })

        it('a proof of address in review: Under review with its line and no button for it', () => {
            renderDrawer([{ key: 'bank', state: 'under-review', reason: 'requirements_in_review' }])
            expect(row('bank').getByText('Under review')).toBeInTheDocument()
            expect(row('bank').getByText(/^We're checking your proof of address\./)).toBeInTheDocument()
            expect(screen.queryByTestId('kyc-setup-step')).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument()
        })

        it('the bank terms: Agreements needed, "Review terms" opens the terms step', () => {
            const tos: NextAction = { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }
            const { onReviewTerms } = renderDrawer([
                { key: 'bank', state: 'agreements-needed', step: { provider: 'bridge', action: tos } },
            ])
            expect(row('bank').getByText('Agreements needed')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Review terms' }))
            expect(onReviewTerms).toHaveBeenCalledTimes(1)
        })

        it('the card agreements: "Continue card setup" goes to the card page', () => {
            const { onClose } = renderDrawer([{ key: 'card', state: 'agreements-needed', step: { provider: 'rain' } }])
            expect(row('card').getByText('Agreements needed')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Continue card setup' }))
            expect(onClose).toHaveBeenCalledTimes(1)
            expect(push).toHaveBeenCalledWith('/card')
        })

        it('a document the card portal asks for continues on the card page too', () => {
            const { onUploadDocument } = renderDrawer([
                { key: 'card', state: 'document-needed', step: { provider: 'rain', reasonCode: 'document_rejected' } },
            ])
            fireEvent.click(screen.getByRole('button', { name: 'Continue card setup' }))
            expect(push).toHaveBeenCalledWith('/card')
            expect(onUploadDocument).not.toHaveBeenCalled()
        })

        it('a document refused for its country: Verify ID with the reason line and the restart', () => {
            const { onVerifyAgain } = renderDrawer([
                { key: 'local', state: 'needs-local-id', reason: 'document_country_unsupported' },
            ])
            expect(row('local').getByText('Verify ID')).toBeInTheDocument()
            expect(row('local').getByText('Needs an ID issued by Brazil')).toBeInTheDocument()
            expect(screen.getByText('Starts a new identity check.')).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Verify again with a Brazil ID' }))
            expect(onVerifyAgain).toHaveBeenCalledTimes(1)
        })

        it('a document that cannot open the feature: Verify ID with another document', () => {
            const { onVerifyAgain } = renderDrawer([
                { key: 'bank', state: 'verify-again', reason: 'identity_document_insufficient' },
            ])
            expect(row('bank').getByText(/can't be used for this account/)).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Verify with a different document' }))
            expect(onVerifyAgain).toHaveBeenCalledTimes(1)
        })

        it('a requirement only support can collect: Not available with its line and Contact support', () => {
            const { onClose } = renderDrawer([
                { key: 'bank', state: 'not-available', reason: 'requirements_uncollectable', support: true },
            ])
            expect(row('bank').getByText('Not available')).toBeInTheDocument()
            expect(row('bank').getByText(/Message support/)).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
            expect(onClose).toHaveBeenCalledTimes(1)
            expect(openSupport).toHaveBeenCalledWith(true)
        })

        it('a plan refusal: Not available with the plan reason, and no support (support cannot change a plan)', () => {
            renderDrawer([{ key: 'card', state: 'not-available', reason: 'under_minimum_age' }])
            expect(row('card').getByText('Only from age 18')).toBeInTheDocument()
            expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
            expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument()
        })

        it('offers the lightest step first and one button at a time', () => {
            renderDrawer([
                { key: 'local', state: 'needs-local-id', reason: 'document_country_unsupported' },
                { key: 'bank', state: 'document-needed', step: { provider: 'bridge', action: supplement } },
                { key: 'card', state: 'agreements-needed', step: { provider: 'rain' } },
            ])
            expect(screen.getByTestId('kyc-setup-step')).toHaveTextContent('Add proof of address')
            expect(screen.queryAllByRole('button', { name: /Verify again|Continue card setup/ })).toHaveLength(0)
        })

        it('shows a step that could not start, and holds the buttons while one starts', () => {
            renderDrawer(
                [{ key: 'bank', state: 'document-needed', step: { provider: 'bridge', action: supplement } }],
                'BR',
                { error: 'Could not start this step.', busy: true }
            )
            expect(screen.getByText('Could not start this step.')).toBeInTheDocument()
            expect(screen.getByTestId('kyc-setup-step')).toBeDisabled()
        })
    })
})
