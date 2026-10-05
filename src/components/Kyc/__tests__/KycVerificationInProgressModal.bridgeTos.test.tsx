/**
 * The last KYC step prompts for Bridge's terms. It must name and link the
 * documents, and its button must not read as acceptance (TASK-23262).
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
    it('names Bridge and links the documents for the verified residence', () => {
        renderTosPhase()

        expect(screen.getByText(/Bridge provides bank transfers/)).toBeInTheDocument()
        expect(screen.getByText(/Bank transfers by Bridge\./)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'About Bridge' })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/row-user-terms/bridge-building-limited'
        )
        expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute(
            'href',
            'https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited'
        )
    })

    it('continues to the acceptance page from a button that does not say accept', () => {
        const onAcceptTerms = jest.fn()
        renderTosPhase({ onAcceptTerms })

        expect(screen.queryByRole('button', { name: /accept/i })).not.toBeInTheDocument()
        screen.getByRole('button', { name: 'Continue' }).click()
        expect(onAcceptTerms).toHaveBeenCalledTimes(1)
    })

    it('shows the load error in place of the terms sentence', () => {
        renderTosPhase({ tosError: 'Could not load terms.' })

        expect(screen.getByText('Could not load terms.')).toBeInTheDocument()
        expect(screen.queryByText(/Bank transfers by Bridge/)).not.toBeInTheDocument()
        expect(screen.queryByRole('link', { name: 'Terms of Service' })).not.toBeInTheDocument()
    })
})
