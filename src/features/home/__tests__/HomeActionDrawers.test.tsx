import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter, type UrlUpdateEvent } from 'nuqs/adapters/testing'
import { HomeActionDrawers } from '../components/HomeActionDrawers'

// F-28: the real nuqs pipeline runs (parser, enum validation, url writes) via
// the official testing adapter — the old suite mocked all of nuqs, so the
// ?drawer= URL contract was asserted nowhere.

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

let mockBadges: Array<{ code: string }> = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { badges: mockBadges } } }),
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
    mockBadges = []
})

const renderWithUrl = (search: string, onUrlUpdate?: (e: UrlUpdateEvent) => void) =>
    render(<HomeActionDrawers />, {
        wrapper: withNuqsTestingAdapter({ searchParams: search, onUrlUpdate }),
    })

describe('HomeActionDrawers', () => {
    it('renders nothing when no drawer param is set', () => {
        renderWithUrl('')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('URL contract: the key is `drawer` and values outside the enum read as closed', () => {
        renderWithUrl('?drawer=nonsense')
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('opens the send drawer from ?drawer=send and routes on click after clearing the param', async () => {
        const urlUpdates: UrlUpdateEvent[] = []
        renderWithUrl('?drawer=send', (e) => urlUpdates.push(e))

        expect(screen.getByText('sendToFriends')).toBeInTheDocument()
        fireEvent.click(screen.getByTestId('home-drawer-send-withdraw'))
        // push must wait for the queued url reset (coderabbit #2780)
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/withdraw'))
        // the drawer param was cleared from the URL before routing
        expect(urlUpdates.at(-1)?.searchParams.get('drawer')).toBeNull()
    })

    it('opens the add drawer with bank and crypto options only', async () => {
        renderWithUrl('?drawer=add')

        fireEvent.click(screen.getByTestId('home-drawer-add-bank'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money?method=bank'))

        fireEvent.click(screen.getByTestId('home-drawer-add-crypto'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/crypto'))

        // withdraw is reachable via the SEND drawer only (product ruling)
        expect(screen.queryByTestId('home-drawer-add-withdraw')).not.toBeInTheDocument()
        // no offramp migration row without the badge
        expect(screen.queryByTestId('home-drawer-add-offramp-migration')).not.toBeInTheDocument()
    })

    it('shows the offramp migration row for OFFRAMP_USER badge holders (parity with /add-money)', async () => {
        mockBadges = [{ code: 'OFFRAMP_USER' }]
        renderWithUrl('?drawer=add')

        fireEvent.click(screen.getByTestId('home-drawer-add-offramp-migration'))
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/add-money/crypto?network=EVM&source=offramp'))
    })
})
