/**
 * DeleteAccountButton — modal state-machine tests.
 * Strategy: mock the deps (auth, toast, service, posthog, mascots) and stub
 * ActionModal to a minimal surface that renders the title + CTA buttons, so we
 * can drive confirm -> loading -> done -> logout and the error-toast branch.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DeleteAccountButton from '@/components/Settings/DeleteAccountButton'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

const mockLogout = jest.fn()
const mockToastError = jest.fn()
const mockRequestDeletion = jest.fn()
const mockCapture = jest.fn()

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ logoutUser: mockLogout }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: mockToastError }) }))
jest.mock('@/services/users', () => ({ usersApi: { requestDeletion: (...a: unknown[]) => mockRequestDeletion(...a) } }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: (...a: unknown[]) => mockCapture(...a) } }))
jest.mock('@/assets/mascot', () => ({ PeanutSad: { src: 'sad' }, PeanutCrying: { src: 'cry' } }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

// Minimal ActionModal: render title + CTAs as buttons when visible, and surface
// the lock props (preventClose / hideModalCloseButton) as data-attributes so we
// can assert the dismissal wiring without rendering the real modal.
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: ({ visible, title, ctas, preventClose, hideModalCloseButton }: any) =>
        visible ? (
            <div
                data-testid="modal"
                data-prevent-close={String(!!preventClose)}
                data-hide-close={String(!!hideModalCloseButton)}
            >
                <h1>{title}</h1>
                {ctas?.map((c: any, i: number) => (
                    <button key={i} disabled={c.disabled} onClick={c.onClick}>
                        {c.text}
                    </button>
                ))}
            </div>
        ) : null,
}))

beforeEach(() => jest.clearAllMocks())

describe('DeleteAccountButton', () => {
    it('opens the confirm modal and fires the initiated event', () => {
        render(<DeleteAccountButton />)
        fireEvent.click(screen.getByText('Delete My Account'))

        expect(screen.getByText("Aw, you're leaving?")).toBeInTheDocument()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.DELETE_ACCOUNT_INITIATED)
    })

    it('confirm -> success -> done -> logout', async () => {
        mockRequestDeletion.mockResolvedValueOnce(undefined)
        render(<DeleteAccountButton />)

        fireEvent.click(screen.getByText('Delete My Account'))
        fireEvent.click(screen.getByText('Yes, delete it'))

        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.DELETE_ACCOUNT_CONFIRMED)
        await waitFor(() => expect(screen.getByText("We'll miss you")).toBeInTheDocument())
        expect(mockRequestDeletion).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByText('Goodbye'))
        expect(mockLogout).toHaveBeenCalledWith({ skipBackendCall: true })
    })

    it('shows an error toast and stays on confirm when deletion fails', async () => {
        mockRequestDeletion.mockRejectedValueOnce(new Error('boom'))
        render(<DeleteAccountButton />)

        fireEvent.click(screen.getByText('Delete My Account'))
        fireEvent.click(screen.getByText('Yes, delete it'))

        await waitFor(() => expect(mockToastError).toHaveBeenCalled())
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.DELETE_ACCOUNT_FAILED)
        // still on the confirm step, not signed out
        expect(screen.getByText("Aw, you're leaving?")).toBeInTheDocument()
        expect(mockLogout).not.toHaveBeenCalled()
    })

    it('locks the modal (preventClose + hidden close) during submit and on the done step', async () => {
        let resolveDeletion!: () => void
        mockRequestDeletion.mockReturnValueOnce(new Promise<void>((r) => (resolveDeletion = () => r())))
        render(<DeleteAccountButton />)

        fireEvent.click(screen.getByText('Delete My Account'))
        // confirm step is dismissible
        expect(screen.getByTestId('modal').dataset.preventClose).toBe('false')
        expect(screen.getByTestId('modal').dataset.hideClose).toBe('false')

        fireEvent.click(screen.getByText('Yes, delete it'))
        // during submit → locked
        await waitFor(() => expect(screen.getByTestId('modal').dataset.preventClose).toBe('true'))
        expect(screen.getByTestId('modal').dataset.hideClose).toBe('true')

        resolveDeletion()
        // done step → still locked (user must complete via "Goodbye")
        await waitFor(() => expect(screen.getByText("We'll miss you")).toBeInTheDocument())
        expect(screen.getByTestId('modal').dataset.preventClose).toBe('true')
        expect(screen.getByTestId('modal').dataset.hideClose).toBe('true')
    })

    it('cancel closes the modal without calling the API', () => {
        render(<DeleteAccountButton />)
        fireEvent.click(screen.getByText('Delete My Account'))
        fireEvent.click(screen.getByText("Never mind, I'll stay"))

        expect(screen.queryByText("Aw, you're leaving?")).not.toBeInTheDocument()
        expect(mockRequestDeletion).not.toHaveBeenCalled()
    })
})
