/** @jest-environment jsdom */
import { fireEvent, render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import { normalizeResidence } from '@/utils/residence-profile'
import ResidenceMenuItem from '../ResidenceMenuItem'

/**
 * The residence row in Profile (Slava, 2026-10-27: "Move Residence to
 * Profile"): the country, its status, the change drawer, and the
 * re-verification a move starts.
 */

let mockOpenView: string | null = null
const mockSetOpenView = jest.fn()
jest.mock('nuqs', () => ({ parseAsString: {}, useQueryState: () => [mockOpenView, mockSetOpenView] }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => '/profile' }))

let mockResidence: ReturnType<typeof normalizeResidence> | null = null
jest.mock('@/hooks/useBankRows', () => ({
    useBankRows: () => ({
        residence: mockResidence,
        residenceIso2: mockResidence?.verified?.country ?? mockResidence?.declared?.country ?? null,
        secondResidenceIso2: null,
    }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } }, fetchUser: jest.fn() }),
}))
const mockSetIsSupportModalOpen = jest.fn()
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: mockSetIsSupportModalOpen }),
    useModalsContextOptional: () => undefined,
}))
const mockResidenceChange = jest.fn()
let mockFlowError: string | null = null
jest.mock('@/hooks/useMultiPhaseKycFlow', () => ({
    useMultiPhaseKycFlow: () => ({
        handleResidenceChange: mockResidenceChange,
        error: mockFlowError,
        errorCooldown: null,
        isLoading: false,
    }),
}))
jest.mock('@/components/Kyc/SumsubKycModals', () => ({ SumsubKycModals: () => null }))
jest.mock('@/components/Profile/views/ResidenceChangeDrawer', () => ({
    __esModule: true,
    default: ({
        visible,
        onClose,
        onReverify,
    }: {
        visible: boolean
        onClose: () => void
        onReverify: (targetCountry: string) => void
    }) =>
        visible ? (
            <div>
                change-modal-open
                <button onClick={onClose}>close residence</button>
                <button onClick={() => onReverify('PT')}>reverify</button>
            </div>
        ) : null,
}))

const render = () =>
    rtlRender(
        <QueryClientProvider client={new QueryClient()}>
            <ResidenceMenuItem />
        </QueryClientProvider>,
        { wrapper: IntlWrapper }
    )

beforeEach(() => {
    jest.clearAllMocks()
    mockOpenView = null
    mockResidence = null
    mockFlowError = null
})

it('names a verified residence with no status badge, and the tap opens the change drawer', () => {
    mockResidence = normalizeResidence({ declared: 'BR', verified: 'BR' })
    render()
    expect(screen.getByText('Residence')).toBeInTheDocument()
    expect(screen.getByText('Brazil')).toBeInTheDocument()
    expect(screen.queryByText('Not confirmed')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Residence'))
    expect(screen.getByText('change-modal-open')).toBeInTheDocument()
})

it('an unconfirmed residence says so', () => {
    mockResidence = normalizeResidence({ declared: 'BR', verified: null })
    render()
    expect(screen.getByText('Not confirmed')).toBeInTheDocument()
})

it('a move under review names the new country', () => {
    mockResidence = normalizeResidence({ declared: 'BR', verified: 'BR', pending: 'ES' })
    render()
    expect(screen.getByText('Change to Spain pending verification')).toBeInTheDocument()
})

it('opens from the card recovery and Add money deep link, and clears it on close', () => {
    mockOpenView = 'residence'
    render()
    expect(screen.getByText('change-modal-open')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'close residence' }))
    expect(mockSetOpenView).toHaveBeenCalledWith(null, { history: 'replace' })
})

it('a failed re-verification offers a retry of the same move, and support under it', () => {
    mockResidence = normalizeResidence({ declared: 'BR', verified: 'BR', pending: 'ES' })
    mockFlowError = 'Not Found'
    render()
    fireEvent.click(screen.getByText('Residence'))
    fireEvent.click(screen.getByText('reverify'))
    expect(mockResidenceChange).toHaveBeenNthCalledWith(1, 'PT')
    expect(screen.getByText("Verification couldn't start")).toBeInTheDocument()
    fireEvent.click(screen.getByText('Try again'))
    expect(mockResidenceChange).toHaveBeenNthCalledWith(2, 'PT')
    const support = screen.getByRole('button', { name: 'Contact support' })
    expect(support).toHaveClass('underline')
    fireEvent.click(support)
    expect(mockSetIsSupportModalOpen).toHaveBeenCalledWith(true)
})
