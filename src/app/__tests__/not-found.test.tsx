import { fireEvent, render, screen } from '@testing-library/react'
import NotFound from '../not-found'
import { ModalsProvider, useModalsContext } from '@/context/ModalsContext'

jest.mock('next/dynamic', () => () => null)
jest.mock('@/constants/ragdoll.consts', () => ({ RAGDOLL_ENABLED: false }))
jest.mock('@/components/Global/SupportDrawer', () => ({
    __esModule: true,
    default: () => <div data-testid="support-drawer" />,
}))
// no Button mock: the CTAs use the real component's link mode, and the test
// asserts the anchors it renders (server-renderable href = 404 recovery)

function ModalState() {
    const { isSupportModalOpen, supportPrefilledMessage } = useModalsContext()
    return (
        <output data-testid="modal-state">
            {isSupportModalOpen ? 'open' : 'closed'}:{supportPrefilledMessage}
        </output>
    )
}

describe('global not-found page', () => {
    it('renders a safe email fallback without app providers', () => {
        render(<NotFound />)

        expect(screen.getByRole('heading', { name: "Hmm, we can't find that page." })).toBeInTheDocument()
        expect(screen.queryByTestId('support-drawer')).not.toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'let support know' })).toHaveAttribute('href', 'mailto:help@peanut.me')
        // both CTAs are real anchors so the 404 recovers even without hydration
        expect(screen.getByRole('link', { name: 'Take me home' })).toHaveAttribute('href', '/')
        expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:help@peanut.me')
    })

    it('keeps the provider-backed support drawer and prefilled action', () => {
        render(
            <ModalsProvider>
                <NotFound />
                <ModalState />
            </ModalsProvider>
        )

        expect(screen.getByTestId('support-drawer')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Contact support' }))
        expect(screen.getByTestId('modal-state')).toHaveTextContent('open:Hey! I hit a 404 — can you help?')
        expect(screen.getByTestId('modal-state')).toHaveTextContent('Path: /')
    })
})
