/** @jest-environment jsdom */
/**
 * "Usually takes less than a minute" is a promise, and past a day it is a lie.
 * The drawer reads the rail's `pendingSince` and changes what it says: an
 * unfinished verification is something the user can continue; a provider
 * review is not, so that branch only offers support.
 */
import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycProcessingModal } from '@/components/Kyc/modals/KycProcessingModal'

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

describe('KycProcessingModal', () => {
    const onClose = jest.fn()
    const onResume = jest.fn()
    const onContactSupport = jest.fn()
    beforeEach(() => jest.clearAllMocks())

    it('a fresh rail keeps the quick-setup promise and one button', () => {
        renderWithIntl(
            <KycProcessingModal
                visible
                onClose={onClose}
                pendingSince={new Date().toISOString()}
                onResume={onResume}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByText('Setting up account…')).toBeInTheDocument()
        expect(screen.getByText(/less than a minute/)).toBeInTheDocument()
        expect(screen.queryByText('Continue verification')).not.toBeInTheDocument()
        expect(screen.queryByText('Contact support')).not.toBeInTheDocument()
        fireEvent.click(screen.getByText('Got it'))
        expect(onClose).toHaveBeenCalled()
    })

    it('an API without the field reads as fresh', () => {
        renderWithIntl(<KycProcessingModal visible onClose={onClose} onResume={onResume} />)
        expect(screen.getByText(/less than a minute/)).toBeInTheDocument()
    })

    it('a rail pending for over a day can be continued, or taken to support', () => {
        renderWithIntl(
            <KycProcessingModal
                visible
                onClose={onClose}
                pendingSince={daysAgo(2)}
                onResume={onResume}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByText('Still setting up the account')).toBeInTheDocument()
        expect(screen.queryByText(/less than a minute/)).not.toBeInTheDocument()
        expect(screen.getByText(/left the verification unfinished/)).toBeInTheDocument()
        fireEvent.click(screen.getByText('Continue verification'))
        expect(onResume).toHaveBeenCalled()
        fireEvent.click(screen.getByText('Contact support'))
        expect(onContactSupport).toHaveBeenCalled()
    })

    it('a stale provider review has nothing to continue, so it offers support only', () => {
        renderWithIntl(
            <KycProcessingModal
                visible
                onClose={onClose}
                pendingSince={daysAgo(2)}
                waitingOnProvider
                onResume={onResume}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByText('Still setting up the account')).toBeInTheDocument()
        expect(screen.getByText(/still reviewing your details/)).toBeInTheDocument()
        expect(screen.queryByText('Continue verification')).not.toBeInTheDocument()
        expect(screen.getByText('Got it')).toBeInTheDocument()
        expect(screen.getByText('Contact support')).toBeInTheDocument()
    })
})
