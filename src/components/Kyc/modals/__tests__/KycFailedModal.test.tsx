/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { KycFailedModal } from '../KycFailedModal'

const mockSetIsSupportModalOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetIsSupportModalOpen }),
}))

const renderModal = (props: Partial<React.ComponentProps<typeof KycFailedModal>> = {}) =>
    render(<KycFailedModal visible onClose={jest.fn()} onRetry={jest.fn()} {...props} />, { wrapper: IntlWrapper })

describe('KycFailedModal', () => {
    it('offers a retry when the rejection can be answered', () => {
        renderModal({ rejectType: 'RETRY' })

        expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Contact support' })).not.toBeInTheDocument()
    })

    // A caller that holds no Sumsub reject fields — the unlock-payments
    // surface — states terminality itself. Without this it offered a retry
    // that could never succeed.
    it('sends the user to support when the caller states the rejection is terminal', () => {
        renderModal({ isTerminal: true })

        expect(screen.getByRole('button', { name: 'Contact support' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
        expect(screen.getByText("We couldn't verify your ID")).toBeInTheDocument()
    })
})
