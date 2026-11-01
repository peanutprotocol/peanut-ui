/**
 * Right after the identity is approved, a user who ticked bank accounts is
 * asked for the proof of address Bridge needs. It is collected on its own
 * supplement action, never beside the identity document.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycVerificationInProgressModal } from '../KycVerificationInProgressModal'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: null }),
    useOptionalAuth: () => ({ user: null }),
}))

const renderSupplementPhase = (props: { onStartSupplement?: () => void; onSkipSupplement?: () => void } = {}) =>
    render(
        <IntlWrapper>
            <KycVerificationInProgressModal isOpen onClose={jest.fn()} phase="supplement" {...props} />
        </IntlWrapper>
    )

describe('KycVerificationInProgressModal — supplement phase', () => {
    it('says plainly that the bank accounts need a proof of address, and starts it', () => {
        const onStartSupplement = jest.fn()
        renderSupplementPhase({ onStartSupplement })

        expect(screen.getByText('Add a proof of address')).toBeInTheDocument()
        expect(
            screen.getByText(
                'Your ID is verified. To open your bank accounts, our payment partner also needs a proof of address, such as a recent bank statement or utility bill.'
            )
        ).toBeInTheDocument()
        screen.getByTestId('kyc-supplement-cta').click()
        expect(onStartSupplement).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('kyc-supplement-cta')).toHaveTextContent('Add proof of address')
    })

    it('lets the user do it later', () => {
        const onSkipSupplement = jest.fn()
        renderSupplementPhase({ onSkipSupplement })

        screen.getByTestId('kyc-supplement-later').click()
        expect(onSkipSupplement).toHaveBeenCalledTimes(1)
        expect(screen.getByTestId('kyc-supplement-later')).toHaveTextContent('Do this later')
    })
})
