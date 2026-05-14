/**
 * SendRouterView — State Matrix Tests
 *
 * Tests the SendRouterView component across 10 state combinations covering:
 * initial options, send-by-link view, contacts view, method selection, and navigation.
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockSearchParams = new Map<string, string>()

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: mockRouterPush,
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
    }),
    usePathname: () => '/send',
}))

// next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, layout, objectFit, fill, ...rest } = props
        return <img {...rest} />
    },
}))

// PostHog
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), init: jest.fn() },
}))

// Assets
jest.mock('@/assets', () => ({
    MERCADO_PAGO: '/mercado-pago.png',
    PIX: '/pix.png',
}))

jest.mock('@/constants/analytics.consts', () => ({
    ANALYTICS_EVENTS: {
        SEND_METHOD_SELECTED: 'send_method_selected',
    },
}))

// ---------- hooks & services ----------

const mockUseContacts = jest.fn()
jest.mock('@/hooks/useContacts', () => ({
    useContacts: (...args: any[]) => mockUseContacts(...args),
}))

const mockUseGeoFilteredPaymentOptions = jest.fn()
jest.mock('@/hooks/useGeoFilteredPaymentOptions', () => ({
    useGeoFilteredPaymentOptions: (...args: any[]) => mockUseGeoFilteredPaymentOptions(...args),
}))

jest.mock('@/utils/general.utils', () => ({
    getInitialsFromName: jest.fn((n: string) => (n ? n.slice(0, 2).toUpperCase() : 'UN')),
}))

jest.mock('@/constants/actionlist.consts', () => ({
    ACTION_METHODS: [
        { id: 'bank', title: 'Bank', description: 'EUR, USD, MXN, ARS & more', icons: [], soon: false },
        {
            id: 'exchange-or-wallet',
            title: 'Exchange or Wallet',
            description: 'Binance, Metamask and more',
            icons: [],
            soon: false,
        },
    ],
}))

// Mock complex UI components
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="nav-header">
            <span>{props.title}</span>
            {props.onPrev && (
                <button data-testid="nav-back" onClick={props.onPrev}>
                    Back
                </button>
            )}
        </div>
    ),
}))

jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="card" className={props.className}>
            {props.children}
        </div>
    ),
}))

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: any) => (
        <button data-testid={props['data-testid'] ?? 'button'} onClick={props.onClick} disabled={props.disabled}>
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/0_Bruddle/Divider', () => ({
    __esModule: true,
    default: (props: any) => <hr data-testid="divider" />,
}))

jest.mock('@/components/ActionListCard', () => ({
    ActionListCard: (props: any) => (
        <div data-testid={`action-card-${props.title}`} onClick={props.onClick}>
            <span>{typeof props.title === 'string' ? props.title : 'complex-title'}</span>
            <span>{props.description}</span>
        </div>
    ),
}))

jest.mock('@/components/Global/IconStack', () => ({
    __esModule: true,
    default: () => <div data-testid="icon-stack" />,
}))

jest.mock('@/components/Global/Badges/StatusBadge', () => ({
    __esModule: true,
    default: (props: any) => <span data-testid="status-badge">{props.customText}</span>,
}))

jest.mock('@/components/Profile/AvatarWithBadge', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="avatar">{props.name}</div>,
}))

// Mock sub-views
jest.mock('../link/LinkSendFlowManager', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="link-send-flow-manager">
            <button data-testid="link-back" onClick={props.onPrev}>
                Back
            </button>
            Link Send Flow
        </div>
    ),
}))

jest.mock('../views/Contacts.view', () => ({
    __esModule: true,
    default: () => <div data-testid="contacts-view">Contacts View</div>,
}))

// ---------- import component under test AFTER all mocks ----------
import { SendRouterView } from '../views/SendRouter.view'

// ---------- helpers ----------

function setSearchParams(params: Record<string, string>) {
    mockSearchParams.clear()
    Object.entries(params).forEach(([k, v]) => mockSearchParams.set(k, v))
}

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
        },
    })
}

function renderSend(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <SendRouterView />
        </QueryClientProvider>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockUseContacts.mockReturnValue({
        contacts: [],
        isLoading: false,
        error: null,
    })

    mockUseGeoFilteredPaymentOptions.mockReturnValue({
        filteredMethods: [
            { id: 'bank', title: 'Bank', description: 'EUR, USD, MXN, ARS & more', icons: [], soon: false },
            {
                id: 'exchange-or-wallet',
                title: 'Exchange or Wallet',
                description: 'Binance, Metamask and more',
                icons: [],
                soon: false,
            },
        ],
    })

    // Set window.location.pathname for link generation
    Object.defineProperty(window, 'location', {
        value: { pathname: '/send', href: 'https://peanut.me/send' },
        writable: true,
    })
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    applyDefaults()
})

// ============================================================
// GROUP 1: Initial State — Send Options
// ============================================================
describe('GROUP 1: Initial State', () => {
    test('Shows send page with link card and method options', () => {
        renderSend()

        expect(screen.getByTestId('nav-header')).toHaveTextContent('Send')
        expect(screen.getByText('Send money with a link')).toBeInTheDocument()
        expect(screen.getByText('Send via link')).toBeInTheDocument()
        expect(screen.getByTestId('divider')).toBeInTheDocument()
    })

    test('Shows Peanut contacts option at top of methods list', () => {
        renderSend()

        const contactsCard = screen.getByTestId('action-card-Peanut contacts')
        expect(contactsCard).toBeInTheDocument()
    })

    test('Shows geo-filtered payment methods', () => {
        renderSend()

        expect(screen.getByTestId('action-card-Bank')).toBeInTheDocument()
        expect(screen.getByTestId('action-card-Exchange or Wallet')).toBeInTheDocument()
    })

    test('No contacts shows fallback avatar initials', () => {
        mockUseContacts.mockReturnValue({
            contacts: [],
            isLoading: false,
            error: null,
        })

        renderSend()

        // Should still render without errors
        expect(screen.getByTestId('action-card-Peanut contacts')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 2: Send by Link View
// ============================================================
describe('GROUP 2: Send by Link', () => {
    test('view=link shows LinkSendFlowManager', () => {
        renderSend({ view: 'link' })

        expect(screen.getByTestId('link-send-flow-manager')).toBeInTheDocument()
        expect(screen.queryByText('Send money with a link')).not.toBeInTheDocument()
    })

    test('createLink=true also shows LinkSendFlowManager', () => {
        renderSend({ createLink: 'true' })

        expect(screen.getByTestId('link-send-flow-manager')).toBeInTheDocument()
    })

    test('Back from link view navigates to /send', () => {
        renderSend({ view: 'link' })

        fireEvent.click(screen.getByTestId('link-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send')
    })
})

// ============================================================
// GROUP 3: Contacts View
// ============================================================
describe('GROUP 3: Contacts View', () => {
    test('view=contacts shows ContactsView', () => {
        renderSend({ view: 'contacts' })

        expect(screen.getByTestId('contacts-view')).toBeInTheDocument()
        expect(screen.queryByText('Send money with a link')).not.toBeInTheDocument()
    })
})

// ============================================================
// GROUP 4: Method Selection Navigation
// ============================================================
describe('GROUP 4: Method Selection', () => {
    test('Clicking bank navigates to /withdraw?method=bank', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Bank'))
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw?method=bank')
    })

    test('Clicking exchange-or-wallet navigates to /withdraw?method=crypto', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Exchange or Wallet'))
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw?method=crypto')
    })

    test('Clicking Peanut contacts navigates to /send?view=contacts', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Peanut contacts'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send?view=contacts')
    })

    test('Back from main send navigates to /home', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })
})
