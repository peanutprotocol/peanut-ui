import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HomeActionDrawers } from '../components/HomeActionDrawers'

// url-backed drawer state — controlled per test
let mockDrawer: string | null = null
// deferred like the real nuqs setter (returns a promise) so the ordering
// assertion below actually exercises navigate's await
const mockSetDrawer = jest.fn(async (value: string | null) => {
    mockDrawer = value
    await Promise.resolve()
})
jest.mock('nuqs', () => ({
    useQueryState: () => [mockDrawer, mockSetDrawer],
    parseAsStringEnum: () => ({ withDefault: jest.fn() }),
}))

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
}))

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

jest.mock('@/hooks/useAppHaptic', () => ({
    useAppHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

beforeAll(() => {
    window.matchMedia =
        window.matchMedia ||
        ((query: string) =>
            ({
                matches: false,
                media: query,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false,
                onchange: null,
            }) as MediaQueryList)
})

beforeEach(() => {
    jest.clearAllMocks()
    mockDrawer = null
})

describe('HomeActionDrawers', () => {
    it('renders nothing when no drawer param is set', () => {
        render(<HomeActionDrawers />)
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the send drawer with its two options and routes on click', async () => {
        mockDrawer = 'send'
        render(<HomeActionDrawers />)

        expect(screen.getByText('sendToFriends')).toBeInTheDocument()
        const withdraw = screen.getByTestId('home-drawer-send-withdraw')
        fireEvent.click(withdraw)
        expect(mockSetDrawer).toHaveBeenCalledWith(null)
        // push must wait for the queued url reset (coderabbit #2780)
        expect(mockPush).not.toHaveBeenCalled()
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/withdraw'))
    })

    it('opens the add drawer with bank, crypto and withdraw options', async () => {
        mockDrawer = 'add'
        render(<HomeActionDrawers />)

        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))

        fireEvent.click(screen.getByTestId('home-drawer-add-crypto'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/crypto'))

        expect(screen.getByTestId('home-drawer-add-withdraw')).toBeInTheDocument()
    })
})
