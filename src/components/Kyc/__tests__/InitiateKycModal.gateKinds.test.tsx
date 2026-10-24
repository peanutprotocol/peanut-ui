/**
 * TASK-24046: the bank gate's screen names the step that resolves it. Bridge's
 * hosted check is not a document upload, and a duplicate account is not an ID
 * problem.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({ isRegionRestricted: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/germany/bank',
}))

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal
                visible
                onClose={jest.fn()}
                onVerify={jest.fn()}
                presentation="page"
                navTitle="Add money"
                {...props}
            />
        </IntlWrapper>
    )

describe('InitiateKycModal — gate kinds', () => {
    it("names Bridge's hosted check and continues to it, never asking for an ID upload", () => {
        const onVerify = jest.fn()
        renderModal({
            variant: 'provider_rejection',
            reasonCode: 'document_rejected',
            providerMessage: 'Please upload a clearer photo of your ID.',
            nextAction: { key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' },
            onVerify,
        })

        expect(screen.getByRole('heading', { name: 'Additional verification needed' })).toBeInTheDocument()
        expect(
            screen.getByText('Complete a quick verification with our payment partner to enable bank transfers.')
        ).toBeInTheDocument()
        expect(screen.queryByText('Please upload a clearer photo of your ID.')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Upload document' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Continue verification' }))
        expect(onVerify).toHaveBeenCalled()
    })

    it('names what the payment partner needs for a rejected imported identity, and offers only support', () => {
        const onContactSupport = jest.fn()
        const onVerify = jest.fn()
        renderModal({ variant: 'blocked', reasonCode: 'imported_identity_rejected', onContactSupport, onVerify })

        expect(screen.getByText(/needs? a current government ID/)).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalled()
        expect(onVerify).not.toHaveBeenCalled()
    })

    it('explains a duplicate account in its own words and offers support', () => {
        const onContactSupport = jest.fn()
        const onVerify = jest.fn()
        renderModal({ variant: 'blocked', reasonCode: 'duplicate_account', onContactSupport, onVerify })

        expect(screen.getByText(/already linked to another Peanut account/)).toBeInTheDocument()
        expect(screen.queryByText(/couldn't confirm your ID/)).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(onContactSupport).toHaveBeenCalled()
        expect(onVerify).not.toHaveBeenCalled()
    })
})
