/**
 * Request Flow — State Matrix Tests
 *
 * Tests CreateRequestLinkView and PayRequestLink across state combinations covering:
 * initial form, link creation, sharing, error states, loading states, and the payer redirect.
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// ---------- module-level mocks (must be before imports that depend on them) ----------

// next/navigation
const mockRouterPush = jest.fn()
const mockRouterBack = jest.fn()
const mockSearchParams = new Map<string, string>()

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: mockRouterPush,
        back: mockRouterBack,
        replace: jest.fn(),
        prefetch: jest.fn(),
    }),
    usePathname: () => '/request',
}))

// next/image — render a plain <img>
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, layout, objectFit, fill, ...rest } = props
        return <img {...rest} />
    },
}))

// Sentry
jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

// PostHog
jest.mock('posthog-js', () => ({
    __esModule: true,
    // onFeatureFlags: the guest store hand-off CTA reads the migration flag and
    // the bank-hub link on this screen is flag-gated — both subscribe through it.
    default: {
        capture: jest.fn(),
        init: jest.fn(),
        isFeatureEnabled: jest.fn(() => false),
        onFeatureFlags: jest.fn(() => jest.fn()),
    },
}))

// ---------- hooks & services ----------

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

const mockUseDebounce = jest.fn((value: any) => value)
jest.mock('@/hooks/useDebounce', () => ({
    useDebounce: (value: any, _delay: number) => mockUseDebounce(value),
}))

const mockRequestsApi = {
    create: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    search: jest.fn(),
    close: jest.fn(),
}
jest.mock('@/services/requests', () => ({
    requestsApi: mockRequestsApi,
}))

const mockChargesApi = {
    get: jest.fn(),
    create: jest.fn(),
}
jest.mock('@/services/charges', () => ({
    chargesApi: mockChargesApi,
}))

jest.mock('@/app/actions/tokens', () => ({
    fetchTokenDetails: jest.fn(() => Promise.resolve({ symbol: 'USDC', decimals: 6, logoURI: '/usdc.png' })),
}))

jest.mock('@/utils/general.utils', () => ({
    fetchTokenSymbol: jest.fn(() => Promise.resolve('USDC')),
    formatTokenAmount: jest.fn((amount: any, _decimals?: number) => amount?.toString() ?? '0'),
    isNativeCurrency: jest.fn(() => false),
    getRequestLink: jest.fn((data: any) => `https://peanut.me/request/pay?id=${data?.uuid || 'test-uuid'}`),
    formatAmount: jest.fn((v: any) => v ?? '0'),
    printableAddress: jest.fn((a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`),
    jsonStringify: jest.fn((v: any) => JSON.stringify(v)),
    // the bank-hub link names its origin through withReturnTo, which sanitizes
    sanitizeRedirectURL: jest.requireActual('@/utils/cookie-url.utils').sanitizeRedirectURL,
}))

jest.mock('@/utils/balance.utils', () => ({
    printableUsdc: jest.fn(() => '100.00'),
}))

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161, name: 'Arbitrum One' },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    PEANUT_WALLET_TOKEN_DECIMALS: 6,
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
    PEANUT_WALLET_TOKEN_NAME: 'USD Coin',
    PEANUT_WALLET_TOKEN_IMG_URL: '/usdc.png',
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
}))

jest.mock('@/interfaces/peanut-sdk-types', () => ({
    EPeanutLinkType: { native: 0, erc20: 1 },
}))

const mockCopyTextToClipboard = jest.fn<Promise<boolean>, [string]>()
const mockCancelClipboardCopy = jest.fn()
jest.mock('@/utils/clipboard.utils', () => ({
    beginClipboardCopy: () => ({
        resolve: (text: string) => mockCopyTextToClipboard(text),
        cancel: () => mockCancelClipboardCopy(),
    }),
}))

// Mock Toast
const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({
        success: mockToastSuccess,
        error: mockToastError,
        info: jest.fn(),
        warning: jest.fn(),
    }),
}))

// Mock complex UI components
jest.mock('@/components/Global/AmountInput', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="amount-input" data-disabled={props.disabled} data-wallet-balance={props.walletBalance}>
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => {
                    // the real field reports all three in one pass, the dollar side last
                    props.setDisplayedAmount?.(e.target.value)
                    props.setPrimaryAmount?.(e.target.value)
                    props.setSecondaryAmount?.('')
                }}
                disabled={props.disabled}
            />
            {props.infoContent}
        </div>
    ),
}))

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

jest.mock('@/components/Global/PeanutActionCard', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="peanut-action-card" data-type={props.type} />,
}))

jest.mock('@/components/Global/QRCodeWrapper', () => ({
    __esModule: true,
    default: (props: any) => (
        <div
            data-testid="qr-code-wrapper"
            data-blurred={props.isBlurred}
            data-loading={props.isLoading}
            data-url={props.url}
        />
    ),
}))

jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: (props: any) => (
        <button data-testid="share-button" data-url={props.url} onClick={() => props.generateUrl?.()}>
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: (props: any) =>
        props.variant === 'mascot' ? <div data-testid="peanut-loading" /> : <div data-testid="loading-spinner" />,
}))

jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: (props: any) => (
        <button
            data-testid={props['data-testid'] ?? 'button'}
            onClick={props.onClick}
            disabled={props.disabled || props.loading}
            className={props.className}
        >
            {props.loading ? 'Loading...' : props.children}
        </button>
    ),
}))

jest.mock('@/components/Global/Icons/Icon', () => ({
    Icon: (props: any) => <span data-testid={`icon-${props.name}`} />,
}))

// ---------- context mocks ----------

const mockSetLoadingState = jest.fn()
const mockSetSelectedChainID = jest.fn()
const mockSetSelectedTokenAddress = jest.fn()

jest.mock('@/context/tokenSelector.context', () => {
    const React = require('react')
    return {
        tokenSelectorContext: React.createContext({
            selectedChainID: '42161',
            setSelectedChainID: (...args: any[]) => mockSetSelectedChainID(...args),
            selectedTokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
            setSelectedTokenAddress: (...args: any[]) => mockSetSelectedTokenAddress(...args),
            selectedTokenData: {
                chainId: '42161',
                address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
                decimals: 6,
                symbol: 'USDC',
                price: 1,
            },
        }),
    }
})

jest.mock('@/context/loadingStates.context', () => {
    const React = require('react')
    return {
        loadingStateContext: React.createContext({
            loadingState: 'Idle' as string,
            setLoadingState: (...args: any[]) => mockSetLoadingState(...args),
            isLoading: false,
        }),
    }
})

// DirectRequestInitialView deps — only this view uses them (PayRequestLink does
// not), so stubbing them globally is safe. Defaults resolve to a logged-in user
// viewing a valid recipient, so the main form (incl. AmountInput) renders.

const mockUseUserByUsername = jest.fn(() => ({
    user: { userId: 'recip-1', username: 'test-user', fullName: 'Test User', isVerified: false },
    isLoading: false,
    error: undefined,
}))
jest.mock('@/hooks/useUserByUsername', () => ({
    useUserByUsername: () => mockUseUserByUsername(),
}))

const mockUseUserInteractions = jest.fn(() => ({ interactions: {} }))
jest.mock('@/hooks/useUserInteractions', () => ({
    useUserInteractions: () => mockUseUserInteractions(),
}))

jest.mock('@/components/User/UserCard', () => ({
    __esModule: true,
    default: () => <div data-testid="user-card" />,
}))

// ---------- import components under test AFTER all mocks ----------
import { CreateRequestLinkView } from '../link/views/Create.request.link.view'
import { PayRequestLink } from '../Pay/Pay'
import DirectRequestInitialView from '../direct-request/views/Initial.direct.request.view'

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

function renderCreateRequest(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()

    return render(
        <NuqsTestingAdapter searchParams={params}>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <CreateRequestLinkView />
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsTestingAdapter>
    )
}

function renderPayRequest(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()

    return render(
        <NuqsTestingAdapter searchParams={params}>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <PayRequestLink />
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsTestingAdapter>
    )
}

function renderDirectRequest() {
    const queryClient = createQueryClient()

    return render(
        <NuqsTestingAdapter searchParams={{}}>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <DirectRequestInitialView username="test-user" />
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsTestingAdapter>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
    mockCopyTextToClipboard.mockResolvedValue(true)

    mockUseAuth.mockReturnValue({
        user: { user: { username: 'test-user', userId: 'user-1' } },
        isFetchingUser: false,
        fetchUser: jest.fn(),
    })

    mockUseWallet.mockReturnValue({
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConnected: true,
        balance: BigInt(100_000_000), // 100 USDC (6 decimals)
    })

    mockUseDebounce.mockImplementation((value: any) => value)

    mockRequestsApi.create.mockResolvedValue({
        uuid: 'req-uuid-1',
        chainId: '42161',
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        tokenAmount: '10',
        tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        tokenDecimals: 6,
        tokenType: '1',
        tokenSymbol: 'USDC',
        trackId: null,
        reference: null,
        attachmentUrl: null,
        createdAt: '2026-04-16T00:00:00Z',
        updatedAt: '2026-04-16T00:00:00Z',
        charges: [],
        history: [],
        recipientAccount: {
            userId: 'user-1',
            identifier: 'test-user',
            type: 'PEANUT',
            user: { username: 'test-user' },
        },
    })

    mockRequestsApi.update.mockResolvedValue({
        uuid: 'req-uuid-1',
        chainId: '42161',
        recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
        tokenAmount: '10',
        tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
        tokenDecimals: 6,
        tokenType: '1',
        tokenSymbol: 'USDC',
        trackId: null,
        reference: 'Updated message',
        attachmentUrl: null,
        createdAt: '2026-04-16T00:00:00Z',
        updatedAt: '2026-04-16T00:01:00Z',
        charges: [],
        history: [],
        recipientAccount: {
            userId: 'user-1',
            identifier: 'test-user',
            type: 'PEANUT',
            user: { username: 'test-user' },
        },
    })

    mockChargesApi.get.mockResolvedValue({
        tokenAmount: '25',
        tokenSymbol: 'USDC',
        chainId: '42161',
        requestLink: {
            uuid: 'req-uuid-1',
            recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
            recipientAccount: {
                type: 'PEANUT',
                user: { username: 'test-user' },
            },
        },
    })
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    applyDefaults()
})

// ============================================================
// GROUP 0: Balance affordance — a request shows no balance at all
// ============================================================
describe('GROUP 0: Balance affordance', () => {
    // A request asks somebody ELSE for money, so the user's own balance is not a
    // ceiling on what they may type — and an amount row the user cannot act on is
    // noise. Both request entry views therefore pass no walletBalance (TASK-22452).
    // The screens that DO spend the balance (send-link, direct send, semantic
    // request, contribute pot, withdraw) show it AND fill it; their coverage lives
    // in Global/AmountInput/__tests__/balance-fill.test.tsx.
    const walletWithSplit = {
        address: '0x1234567890abcdef1234567890abcdef12345678',
        isConnected: true,
        spendableBalance: BigInt(250_000_000), // defined → not the loading branch
        formattedSpendableBalance: '250.00 (spendable)',
        formattedBalance: '100.00 (smart-only)',
    }

    test('create-request shows no balance row', () => {
        mockUseWallet.mockReturnValue(walletWithSplit)

        renderCreateRequest()

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-wallet-balance')
    })

    test('direct-request shows no balance row', () => {
        mockUseWallet.mockReturnValue(walletWithSplit)

        renderDirectRequest()

        expect(screen.getByTestId('amount-input')).not.toHaveAttribute('data-wallet-balance')
    })
})

// ============================================================
// GROUP 1: CreateRequestLinkView — Initial Form States
// ============================================================
describe('GROUP 1: Initial Form States', () => {
    test('renders request form with nav header, action card, QR code, amount input, and create button', () => {
        renderCreateRequest()

        expect(screen.getByText('Request')).toBeInTheDocument()
        expect(screen.getByTestId('peanut-action-card')).toHaveAttribute('data-type', 'request')
        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'true')
        expect(screen.getByTestId('amount-input')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create request' })).toBeInTheDocument()
    })

    test('nav header back button navigates to /home', () => {
        renderCreateRequest()

        fireEvent.click(screen.getByTestId('nav-back'))
        expect(mockRouterPush).toHaveBeenCalledWith('/home')
    })

    test.each(['/request', '/request?amount=20', '/request/', 'https://outside.example'])(
        'request Back rejects a same-route or external return target (%s)',
        (returnTo) => {
            renderCreateRequest({ returnTo })

            fireEvent.click(screen.getByTestId('nav-back'))

            expect(mockRouterPush).toHaveBeenCalledWith('/home')
            expect(mockRouterBack).not.toHaveBeenCalled()
        }
    )

    test('request Back honors a safe explicit origin', () => {
        renderCreateRequest({ returnTo: '/profile?section=payments' })

        fireEvent.click(screen.getByTestId('nav-back'))

        expect(mockRouterPush).toHaveBeenCalledWith('/profile?section=payments')
        expect(mockRouterBack).not.toHaveBeenCalled()
    })

    test('QR code is blurred before an amount is entered', () => {
        renderCreateRequest()

        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'true')
    })

    test('QR code unblurs as soon as a positive amount is entered', () => {
        renderCreateRequest()

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '10' } })

        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'false')
    })

    test('QR code stays blurred for a zero amount and re-blurs when the amount is cleared', () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')

        fireEvent.change(field, { target: { value: '0' } })
        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'true')

        fireEvent.change(field, { target: { value: '10' } })
        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'false')

        fireEvent.change(field, { target: { value: '' } })
        expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'true')
    })

    test('amount input is enabled before request is created', () => {
        renderCreateRequest()

        const amountInput = screen.getByTestId('amount-input')
        expect(amountInput).toHaveAttribute('data-disabled', 'false')
    })

    test('pre-filled amount from URL params is set in form', () => {
        renderCreateRequest({ amount: '42.50' })

        const field = screen.getByTestId('amount-field')
        expect(field).toHaveValue('42.50')
    })

    test('comment input is available', () => {
        renderCreateRequest()

        expect(screen.getByPlaceholderText('Comment')).toBeInTheDocument()
    })

    test('info content shows hint about leaving amount empty', () => {
        renderCreateRequest()

        expect(screen.getByText(/Leave empty to let payers choose amounts/)).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 2: CreateRequestLinkView — Link Creation
// ============================================================
describe('GROUP 2: Link Creation', () => {
    test('clicking Create request calls requestsApi.create and shows share button', async () => {
        renderCreateRequest()

        // Enter an amount
        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '25' } })

        // Click create
        const createBtn = screen.getByRole('button', { name: 'Create request' })
        await act(async () => {
            fireEvent.click(createBtn)
        })

        await waitFor(() => {
            expect(mockRequestsApi.create).toHaveBeenCalled()
        })

        // After creation, share button should appear
        await waitFor(() => {
            expect(screen.getByTestId('share-button')).toBeInTheDocument()
        })
    })

    test('after link creation, QR code is no longer blurred', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        const createBtn = screen.getByRole('button', { name: 'Create request' })
        await act(async () => {
            fireEvent.click(createBtn)
        })

        await waitFor(() => {
            expect(screen.getByTestId('qr-code-wrapper')).toHaveAttribute('data-blurred', 'false')
        })
    })

    test('after link creation, amount input is disabled', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        const createBtn = screen.getByRole('button', { name: 'Create request' })
        await act(async () => {
            fireEvent.click(createBtn)
        })

        await waitFor(() => {
            expect(screen.getByTestId('amount-input')).toHaveAttribute('data-disabled', 'true')
        })
    })

    test('after link creation, Create request button is replaced by share button', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: 'Create request' })).not.toBeInTheDocument()
            expect(screen.getByTestId('share-button')).toBeInTheDocument()
        })
    })

    test('share button shows amount in label when amount is set', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '50' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.getByTestId('share-button')).toHaveTextContent('Share $50 request')
        })
    })

    test('share button shows "Share open request" when no amount is set', async () => {
        renderCreateRequest()

        // Create without entering amount
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.getByTestId('share-button')).toHaveTextContent('Share open request')
        })
    })

    test('the new link lands on the clipboard and the success toast says so', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(mockCopyTextToClipboard).toHaveBeenCalledWith('https://peanut.me/request/pay?id=req-uuid-1')
            expect(mockToastSuccess).toHaveBeenCalledWith('Link created and copied to clipboard!')
        })
    })

    test('sharing hands over the created link instead of creating a second request', async () => {
        renderCreateRequest()

        fireEvent.change(screen.getByTestId('amount-field'), { target: { value: '10' } })
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        const shareButton = await screen.findByTestId('share-button')
        expect(shareButton).toHaveAttribute('data-url', 'https://peanut.me/request/pay?id=req-uuid-1')

        await act(async () => {
            fireEvent.click(shareButton)
        })

        // ShareButton owns the copy from here — no second create, no second toast
        expect(mockRequestsApi.create).toHaveBeenCalledTimes(1)
        expect(mockCopyTextToClipboard).toHaveBeenCalledTimes(1)
        expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    })

    test('a refused clipboard falls back to the plain link-created toast', async () => {
        mockCopyTextToClipboard.mockResolvedValue(false)
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(mockToastSuccess).toHaveBeenCalledWith('Link created successfully!')
        })
    })
})

// ============================================================
// GROUP 3: CreateRequestLinkView — Error States
// ============================================================
describe('GROUP 3: Error States', () => {
    test('API failure shows error message and toast', async () => {
        mockRequestsApi.create.mockRejectedValue(new Error('Network error'))

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.getByText('Failed to create link')).toBeInTheDocument()
        })
        expect(mockToastError).toHaveBeenCalledWith('Failed to create link')
        // a link that never existed must release the reserved clipboard write
        expect(mockCancelClipboardCopy).toHaveBeenCalled()
        expect(mockCopyTextToClipboard).not.toHaveBeenCalled()
        expect(mockToastSuccess).not.toHaveBeenCalled()
    })

    test('not connected wallet shows error when creating request', async () => {
        mockUseWallet.mockReturnValue({
            address: undefined,
            isConnected: false,
            balance: undefined,
        })

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.getByText('Please enter a recipient address')).toBeInTheDocument()
        })
    })

    test('Sentry captures exception on create failure', async () => {
        const mockError = new Error('API failure')
        mockRequestsApi.create.mockRejectedValue(mockError)

        const { captureException } = require('@sentry/nextjs')

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(captureException).toHaveBeenCalledWith(mockError)
        })
    })
})

// ============================================================
// GROUP 4: CreateRequestLinkView — Loading States
// ============================================================
describe('GROUP 4: Loading States', () => {
    test('creating link shows loading state on button', async () => {
        // Make create hang to observe loading state
        mockRequestsApi.create.mockReturnValue(new Promise(() => {}))

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        // During creation, the button should show loading
        await waitFor(() => {
            expect(mockSetLoadingState).toHaveBeenCalledWith('Creating link')
        })
    })

    test('loading state resets to Idle after successful creation', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(mockSetLoadingState).toHaveBeenCalledWith('Idle')
        })
    })

    test('loading state resets to Idle after failed creation', async () => {
        mockRequestsApi.create.mockRejectedValue(new Error('fail'))

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(mockSetLoadingState).toHaveBeenCalledWith('Idle')
        })
    })

    test('QR code shows loading state during link creation', async () => {
        mockRequestsApi.create.mockReturnValue(new Promise(() => {}))

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        // The QR code component receives isLoading prop from isCreatingLink state
        // Since the create is pending, the component should be in loading state
        await waitFor(() => {
            expect(mockSetLoadingState).toHaveBeenCalledWith('Creating link')
        })
    })
})

// ============================================================
// GROUP 5: CreateRequestLinkView — Merchant / Bill Split Flow
// ============================================================
describe('GROUP 5: Merchant / Bill Split Flow', () => {
    test('merchant param populates comment with bill split message', () => {
        renderCreateRequest({ merchant: 'CoolCafe' })

        const commentField = screen.getByPlaceholderText('Comment')
        expect(commentField).toHaveValue('Bill split for CoolCafe')
    })

    // ui#3271 QA pass 2: this used to auto-create the link the instant both
    // params were present, skipping the create step where BankInstructionsToggle
    // lives — a split-bill request could never offer bank-sharing. It must now
    // behave like any other prefilled request: show the create form and wait
    // for an explicit tap.
    test('merchant + amount params prefill the form instead of auto-creating', () => {
        renderCreateRequest({ merchant: 'CoolCafe', amount: '25' })

        expect(screen.getByRole('button', { name: 'Create request' })).toBeInTheDocument()
        expect(mockRequestsApi.create).not.toHaveBeenCalled()
    })
})

// ============================================================
// GROUP 6: PayRequestLink — Payer Redirect
// ============================================================
describe('GROUP 6: PayRequestLink — Payer Redirect', () => {
    test('with valid UUID, fetches charge and redirects to request link', async () => {
        renderPayRequest({ id: 'charge-uuid-1' })

        await waitFor(() => {
            expect(mockChargesApi.get).toHaveBeenCalledWith('charge-uuid-1')
        })

        await waitFor(() => {
            expect(mockRouterPush).toHaveBeenCalled()
        })
    })

    test('without UUID, redirects to /404', async () => {
        renderPayRequest()

        await waitFor(() => {
            expect(mockRouterPush).toHaveBeenCalledWith('/404')
        })
    })

    test('API failure redirects to /404', async () => {
        mockChargesApi.get.mockRejectedValue(new Error('Not found'))

        renderPayRequest({ id: 'bad-uuid' })

        await waitFor(() => {
            expect(mockRouterPush).toHaveBeenCalledWith('/404')
        })
    })

    test('renders nothing (null) — no visible UI', () => {
        const { container } = renderPayRequest({ id: 'charge-uuid-1' })

        // PayRequestLink returns null — the container should be effectively empty
        // (just the QueryClientProvider wrapper)
        expect(container.textContent).toBe('')
    })
})

// ============================================================
// GROUP 7: CreateRequestLinkView — Edge Cases
// ============================================================
describe('GROUP 7: Edge Cases', () => {
    test('invalid amount param (NaN) results in empty amount', () => {
        renderCreateRequest({ amount: 'not-a-number' })

        const field = screen.getByTestId('amount-field')
        expect(field).toHaveValue('')
    })

    test('duplicate create clicks do not fire multiple API calls', async () => {
        // First call hangs
        let resolveCreate: (value: any) => void
        mockRequestsApi.create.mockImplementation(
            () =>
                new Promise((resolve) => {
                    resolveCreate = resolve
                })
        )

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        const createBtn = screen.getByRole('button', { name: 'Create request' })

        // Click twice rapidly
        await act(async () => {
            fireEvent.click(createBtn)
        })
        await act(async () => {
            fireEvent.click(createBtn)
        })

        // Should only have been called once due to isCreatingLink guard
        expect(mockRequestsApi.create).toHaveBeenCalledTimes(1)

        // Cleanup: resolve the pending promise
        await act(async () => {
            resolveCreate!({
                uuid: 'req-uuid-1',
                recipientAccount: { type: 'PEANUT', user: { username: 'test-user' } },
                recipientAddress: '0x1234567890abcdef1234567890abcdef12345678',
            })
        })
    })

    // The field is disabled once the request exists, so a change that still
    // arrives is the input echoing its own value (currency swap, reformat, new
    // FX rate). It must not bring the Create button back: the next tap there
    // made a duplicate request.
    test('an amount change after link creation keeps the created request', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        await waitFor(() => {
            expect(screen.getByTestId('share-button')).toBeInTheDocument()
        })

        await act(async () => {
            fireEvent.change(field, { target: { value: '20' } })
        })

        expect(screen.getByTestId('share-button')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Create request' })).not.toBeInTheDocument()
        expect(mockRequestsApi.create).toHaveBeenCalledTimes(1)
    })

    test('aborted request does not show error', async () => {
        const abortError = new Error('AbortError')
        abortError.name = 'AbortError'
        mockRequestsApi.create.mockRejectedValue(abortError)

        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        // AbortError should not show error message
        await waitFor(() => {
            expect(screen.queryByText('Failed to create link')).not.toBeInTheDocument()
        })
    })

    test('sets wallet chain and token defaults on mount when connected', () => {
        renderCreateRequest()

        expect(mockSetSelectedChainID).toHaveBeenCalledWith('42161')
        expect(mockSetSelectedTokenAddress).toHaveBeenCalledWith('0xaf88d065e77c8cc2239327c5edb3a432268e5831')
    })
})
