/**
 * One-shot onboarding (TASK-23329) replaces the plain unlock offer with the
 * unlock checklist in both forms, and only for the fresh offer: the error
 * and action variants keep their screens, and the flag off is today's
 * screen.
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { InitiateKycModal } from '../InitiateKycModal'

let mockOneShotResidence: string | null = null
// the stored set as /users/me carries it (item 3b)
let mockKycIntents: Record<string, boolean> | null = null
jest.mock('@/hooks/useIdentityVerification', () => ({
    useIdentityVerification: () => ({
        identity: { status: 'not_started', kycIntents: mockKycIntents },
        isRegionRestricted: false,
        oneShotResidence: mockOneShotResidence,
    }),
}))
jest.mock('@/hooks/useResidenceRestrictions', () => ({
    useResidenceRestrictions: () => ({ banking: false, card: false }),
}))
jest.mock('@/hooks/useKycDegraded', () => ({ useKycDegraded: () => false }))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/add-money/argentina/bank',
}))
jest.mock('@/components/Kyc/UnlockChecklistStep', () => ({
    UnlockChecklistStep: ({ residence }: { residence: string }) => <div>unlock-checklist:{residence}</div>,
}))

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) =>
    render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={jest.fn()} onVerify={jest.fn()} presentation="page" {...props} />
        </IntlWrapper>
    )

const ALL_INTENTS = { qr: true, local: true, card: true, bank: true }

describe('InitiateKycModal — one-shot onboarding', () => {
    beforeEach(() => {
        mockOneShotResidence = null
        mockKycIntents = null
    })

    // items 9a and 3b: closing the SDK halfway and tapping Verify again, a
    // reload, or a second device resumes the applicant from today's start
    // screen; the set is stored on the server, so the questions are not asked twice
    it('skips the checklist once a set is stored', () => {
        mockOneShotResidence = 'BR'
        mockKycIntents = ALL_INTENTS
        const onVerify = jest.fn()
        renderModal({ onVerify })
        expect(screen.queryByText(/unlock-checklist/)).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Verify identity' }))
        expect(onVerify).toHaveBeenCalledTimes(1)
    })

    it("keeps today's screen when the server did not flag the user", () => {
        renderModal()
        expect(screen.getByRole('button', { name: 'Verify identity' })).toBeInTheDocument()
        expect(screen.queryByText(/unlock-checklist/)).not.toBeInTheDocument()
    })

    it('shows the checklist for the declared residence on the fresh offer', () => {
        mockOneShotResidence = 'BR'
        renderModal()
        expect(screen.getByText('unlock-checklist:BR')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Verify identity' })).not.toBeInTheDocument()
        expect(screen.getByText('Features to unlock')).toBeInTheDocument()
    })

    it('leaves the action and error variants on their own screens', () => {
        mockOneShotResidence = 'BR'
        renderModal({ variant: 'provider_rejection' })
        expect(screen.getByRole('heading', { name: 'We need extra documents' })).toBeInTheDocument()
        expect(screen.queryByText(/unlock-checklist/)).not.toBeInTheDocument()
    })

    // the Home "Verify" row and the Manteca flows open the drawer form
    it('hosts the checklist in the drawer form too', () => {
        mockOneShotResidence = 'BR'
        renderModal({ presentation: 'modal' })
        expect(screen.getByText('unlock-checklist:BR')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Verify identity' })).not.toBeInTheDocument()
    })
})
