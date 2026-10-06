/**
 * The last KYC step prompts for Bridge's terms. It must name the account
 * provider and link its terms, and its button must not read as acceptance
 * (TASK-23262, TASK-23295).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycVerificationInProgressModal } from '../KycVerificationInProgressModal'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { residence: { verified: 'MX' } } }),
    useOptionalAuth: () => ({ user: { residence: { verified: 'MX' } } }),
}))

const renderTosPhase = (props: { onAcceptTerms?: () => void; tosError?: string | null } = {}) =>
    render(
        <IntlWrapper>
            <KycVerificationInProgressModal isOpen onClose={jest.fn()} phase="bridge_tos" {...props} />
        </IntlWrapper>
    )

describe('KycVerificationInProgressModal — bridge_tos phase', () => {
    it('names the account provider and links the terms for the verified residence', () => {
        renderTosPhase()

        expect(screen.getByText('Accept terms')).toBeInTheDocument()
        expect(screen.getByText('Account provider')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'About Bridge' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Bridge user terms' })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/row-user-terms/bridge-building-limited'
        )
        const cta = screen.getByRole('button', { name: 'Continue' })
        // the card sits between the description and the button
        expect(
            screen.getByRole('button', { name: 'About Bridge' }).compareDocumentPosition(cta) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy()
    })

    it('continues to the acceptance page from a button that does not say accept', () => {
        const onAcceptTerms = jest.fn()
        renderTosPhase({ onAcceptTerms })

        expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
        screen.getByRole('button', { name: 'Continue' }).click()
        expect(onAcceptTerms).toHaveBeenCalledTimes(1)
    })

    it('shows the load error in place of the terms card', () => {
        renderTosPhase({ tosError: 'Could not load terms.' })

        expect(screen.getByText('Could not load terms.')).toBeInTheDocument()
        expect(screen.queryByText('Account provider')).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Bridge user terms' })).not.toBeInTheDocument()
    })
})
