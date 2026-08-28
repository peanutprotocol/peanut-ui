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
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockRouterBack = jest.fn()
const mockRouterReplace = jest.fn()
const mockSearchParams = new Map<string, string>()

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: mockRouterPush,
        replace: mockRouterReplace,
        prefetch: jest.fn(),
        back: mockRouterBack,
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
        // present in the catalog but must NOT surface in the send list —
        // withdraw-to-own-account rail (see the exclusion test below)
        { id: 'mercadopago', title: 'Mercado Pago', description: 'Instant transfers', icons: [], soon: false },
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
    default: (_props: any) => <hr data-testid="divider" />,
}))

jest.mock('@/components/0_Bruddle/ListItem', () => ({
    ListItem: (props: any) => (
        <div data-testid={`action-card-${props.title}`} onClick={props.onClick}>
            <span>{typeof props.title === 'string' ? props.title : 'complex-title'}</span>
            <span>{props.body}</span>
        </div>
    ),
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
    default: (props: any) => (
        <div data-testid="contacts-view">
            <button data-testid="contacts-back" onClick={props.onPrev}>
                Back
            </button>
            Contacts View
        </div>
    ),
}))

// withdraw-flow context — SendRouterView resets it when a click enters the withdraw flow
const mockResetWithdrawFlow = jest.fn()
jest.mock('@/context/WithdrawFlowContext', () => ({
    useWithdrawFlow: () => ({ resetWithdrawFlow: mockResetWithdrawFlow }),
}))

// ---------- import component under test AFTER all mocks ----------
import { SendRouterView } from '../views/SendRouter.view'
import { __testing as safeBackTesting } from '@/hooks/useSafeBack'

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
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <SendRouterView />
            </QueryClientProvider>
        </IntlWrapper>
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
    safeBackTesting.reset()
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

    test('Excludes Mercado Pago from the send list (withdraw-to-own-account rail — PR #2813 review)', () => {
        renderSend()

        // the mocked catalog above contains mercadopago; SendRouterView must
        // drop it before geo-filtering, so the hook never sees it
        const methodsPassedToGeoFilter = mockUseGeoFilteredPaymentOptions.mock.calls[0][0].methods
        expect(methodsPassedToGeoFilter.map((m: { id: string }) => m.id)).not.toContain('mercadopago')
        expect(screen.queryByTestId('action-card-Mercado Pago')).not.toBeInTheDocument()
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

    test('Back from a cold deep-link into link view replaces to /send without minting history', () => {
        renderSend({ view: 'link' })

        fireEvent.click(screen.getByTestId('link-back'))
        // replace, not push — a pushed entry would let the base view's safe-back
        // walk right back into the subview
        expect(mockRouterReplace).toHaveBeenCalledWith('/send')
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterBack).not.toHaveBeenCalled()
    })

    test('Back from an in-app-entered link view pops history instead of pushing', () => {
        window.history.pushState({}, '', '/send?view=link')
        renderSend({ view: 'link' })

        fireEvent.click(screen.getByTestId('link-back'))
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterReplace).not.toHaveBeenCalled()
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

    test('Back from a cold deep-link into contacts replaces to /send without minting history', () => {
        renderSend({ view: 'contacts' })

        fireEvent.click(screen.getByTestId('contacts-back'))
        expect(mockRouterReplace).toHaveBeenCalledWith('/send')
        expect(mockRouterPush).not.toHaveBeenCalled()
        expect(mockRouterBack).not.toHaveBeenCalled()
    })

    // Regression: the subview branch used to router.push('/send'), minting a
    // history entry that made the base view's safe-back re-open the subview —
    // Back looped between Contacts and base Send forever.
    test('cold /send → open contacts → back → back leaves Send, not re-enters contacts', () => {
        // cold /send: user opens contacts (real in-app push, as the contacts card does)
        window.history.pushState({}, '', '/send?view=contacts')
        const contactsView = renderSend({ view: 'contacts' })

        // Back from contacts pops the pushed entry instead of pushing a new one
        fireEvent.click(screen.getByTestId('contacts-back'))
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalled()

        // the browser pops the subview entry in response to router.back()
        window.dispatchEvent(new PopStateEvent('popstate'))
        contactsView.unmount()

        // back at base /send: Back must fall back to /home, never into contacts
        renderSend()
        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
    })
})

// ============================================================
// GROUP 4: Method Selection Navigation
// ============================================================
describe('GROUP 4: Method Selection', () => {
    test('Clicking bank resets the withdraw flow, then navigates to /withdraw?method=bank', () => {
        // Regression: browser back from an abandoned /withdraw?method=crypto skips the
        // in-app NavHeader reset, so a stale selectedMethod survives in the app-wide
        // context. Without the reset, Bank skips method selection and lands on the
        // crypto amount step (continuing into /withdraw/crypto?method=bank).
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Bank'))
        expect(mockResetWithdrawFlow).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw?method=bank')
        // reset must land before navigation hands off to /withdraw
        expect(mockResetWithdrawFlow.mock.invocationCallOrder[0]).toBeLessThan(
            mockRouterPush.mock.invocationCallOrder[0]
        )
    })

    test('Clicking exchange-or-wallet resets the withdraw flow, then navigates to /withdraw?method=crypto', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Exchange or Wallet'))
        expect(mockResetWithdrawFlow).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw?method=crypto')
        expect(mockResetWithdrawFlow.mock.invocationCallOrder[0]).toBeLessThan(
            mockRouterPush.mock.invocationCallOrder[0]
        )
    })

    test('Pix also resets the withdraw flow before navigating', () => {
        mockUseGeoFilteredPaymentOptions.mockReturnValue({
            filteredMethods: [{ id: 'pix', title: 'Pix', description: '', icons: [], soon: false }],
        })
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Pix'))
        expect(mockResetWithdrawFlow).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/manteca?method=pix&country=brazil')
        expect(mockResetWithdrawFlow.mock.invocationCallOrder[0]).toBeLessThan(
            mockRouterPush.mock.invocationCallOrder[0]
        )
    })

    test('Clicking Peanut contacts navigates to /send?view=contacts without touching the withdraw flow', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('action-card-Peanut contacts'))
        expect(mockRouterPush).toHaveBeenCalledWith('/send?view=contacts')
        // contacts is not a withdraw entry — never clobber an unrelated flow's state
        expect(mockResetWithdrawFlow).not.toHaveBeenCalled()
    })

    test('Back from main send falls back to /home on a cold deep-link', () => {
        renderSend()

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
        expect(mockRouterBack).not.toHaveBeenCalled()
    })

    test('Back from main send returns through in-app history when it exists', () => {
        // e.g. Rewards pushed this screen — back must land there, not /home
        window.history.pushState({}, '', '/send')
        renderSend()

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockRouterBack).toHaveBeenCalledTimes(1)
        expect(mockRouterPush).not.toHaveBeenCalledWith('/home')
    })
})
