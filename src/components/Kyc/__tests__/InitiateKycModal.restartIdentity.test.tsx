/**
 * The restart variant serves two causes. A document from a country the payment
 * method does not take asks for a different document. An approval with no
 * identity document on file (api#1776) asks for a first one. The reason code
 * picks the copy.
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
    usePathname: () => '/add-money/argentina/manteca',
}))

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={jest.fn()} onVerify={jest.fn()} {...props} />
        </IntlWrapper>
    )

describe('InitiateKycModal — restart_identity', () => {
    it('asks for a first document when the approval has none', () => {
        const onVerify = jest.fn()
        renderModal({ variant: 'restart_identity', reasonCode: 'identity_document_missing', onVerify })

        expect(screen.getByText('Complete your verification')).toBeInTheDocument()
        expect(
            screen.getByText('We need an identity document and a selfie to complete your verification.')
        ).toBeInTheDocument()
        expect(screen.queryByText('Verify with a different document')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }))
        expect(onVerify).toHaveBeenCalled()
    })

    it('keeps the different-document copy for a document from an unsupported country', () => {
        renderModal({ variant: 'restart_identity', reasonCode: 'country_not_supported' })

        expect(screen.getByRole('button', { name: 'Verify with a different document' })).toBeInTheDocument()
        expect(
            screen.getByText(
                'This payment method needs a document from a supported country. You can verify with a different ID.'
            )
        ).toBeInTheDocument()
        expect(screen.queryByText('Complete your verification')).not.toBeInTheDocument()
    })
})
