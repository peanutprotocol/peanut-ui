/**
 * The unlock offers (default, cross_region, country_payments) open /verify's
 * intro, the steps of the ID check, for users the server keeps on today's flow
 * too (Slava, 2026-11-03). Continue starts the caller's check, and the account
 * provider stays named on the screen (Brazil Resolution 520, TASK-23295).
 */
/** @jest-environment jsdom */
import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
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

const renderModal = (props: Partial<React.ComponentProps<typeof InitiateKycModal>> = {}) => {
    const onVerify = jest.fn()
    const onClose = jest.fn()
    const { unmount } = render(
        <IntlWrapper>
            <InitiateKycModal visible onClose={onClose} onVerify={onVerify} {...props} />
        </IntlWrapper>
    )
    return { onVerify, onClose, unmount }
}
const stepLabels = () =>
    within(screen.getByTestId('verify-steps'))
        .getAllByRole('listitem')
        .map((row) => row.textContent)

describe('InitiateKycModal — the ID check intro', () => {
    it.each(['default', 'cross_region', 'country_payments'] as const)(
        'shows the steps for the %s offer and Continue starts the check',
        (variant) => {
            const { onVerify } = renderModal({ variant })
            expect(screen.getByTestId('identity-check-intro')).toBeInTheDocument()
            expect(screen.getByRole('heading', { name: 'Your ID check' })).toBeInTheDocument()
            expect(screen.queryByTestId('kyc-prep-checklist')).not.toBeInTheDocument()
            fireEvent.click(screen.getByTestId('kyc-initiate-cta'))
            expect(onVerify).toHaveBeenCalledTimes(1)
        }
    )

    it('lists the questions step only where the check asks them (Argentina and Brazil)', () => {
        const standard = renderModal()
        expect(stepLabels()).not.toContain('2Answer a few questions')
        expect(stepLabels()).toContain('2Take a photo of your ID')

        standard.unmount()
        renderModal({ variant: 'country_payments', prepPath: 'extended', taxIdCountry: 'AR' })
        expect(stepLabels()).toContain('2Answer a few questions')
    })

    it('names the account provider: Manteca from the country, Bridge from the caller, none when unknown', () => {
        const manteca = renderModal({ variant: 'country_payments', prepPath: 'extended', taxIdCountry: 'AR' })
        expect(screen.getByText('Account provider')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'About Manteca' })).toBeInTheDocument()

        manteca.unmount()
        const bridge = renderModal({ providerId: 'bridge-eea' })
        expect(screen.getByRole('button', { name: 'About Bridge' })).toBeInTheDocument()

        bridge.unmount()
        renderModal()
        expect(screen.queryByText('Account provider')).not.toBeInTheDocument()
    })

    it('goes back with onClose, or with onBack in the page form, and not while the check starts', () => {
        const modal = renderModal()
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(modal.onClose).toHaveBeenCalledTimes(1)

        modal.unmount()
        const onBack = jest.fn()
        const page = renderModal({ presentation: 'page', onBack })
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(onBack).toHaveBeenCalledTimes(1)
        expect(page.onClose).not.toHaveBeenCalled()

        page.unmount()
        const busy = renderModal({ isLoading: true })
        fireEvent.click(screen.getByTestId('verify-back'))
        expect(busy.onClose).not.toHaveBeenCalled()
        expect(screen.getByTestId('kyc-initiate-cta')).toBeDisabled()
    })

    it('keeps the error ending instead of the intro', () => {
        renderModal({ error: 'Network down' })
        expect(screen.queryByTestId('identity-check-intro')).not.toBeInTheDocument()
        expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('renders nothing while hidden', () => {
        renderModal({ visible: false })
        expect(screen.queryByTestId('identity-check-intro')).not.toBeInTheDocument()
    })
})
