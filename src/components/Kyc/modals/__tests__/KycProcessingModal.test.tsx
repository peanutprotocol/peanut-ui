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
        // support is the escape, so a LinkButton under the primary, not a stroke Button
        expect(screen.getByRole('button', { name: 'Contact support' })).toHaveClass('underline')
        expect(screen.getByRole('button', { name: 'Continue verification' })).not.toHaveClass('underline')
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

    it.each([0, 2])('a proof of address in review for %i days stays a wait with no resume or support CTA', (days) => {
        const message = "We're checking your proof of address. Bank accounts open once it's approved."
        renderWithIntl(
            <KycProcessingModal
                visible
                onClose={onClose}
                pendingSince={daysAgo(days)}
                reason={{ code: 'requirements_in_review', userMessage: message }}
                onResume={onResume}
                onContactSupport={onContactSupport}
            />
        )
        expect(screen.getByText(message)).toBeInTheDocument()
        expect(screen.queryByText(/left the verification unfinished/)).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Continue verification' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Got it' })).toBeInTheDocument()
        expect(onResume).not.toHaveBeenCalled()
        expect(onContactSupport).not.toHaveBeenCalled()
    })
})
