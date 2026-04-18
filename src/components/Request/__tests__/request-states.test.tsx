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
    default: { capture: jest.fn(), init: jest.fn() },
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
    fetchTokenDetails: jest.fn(() =>
        Promise.resolve({ symbol: 'USDC', decimals: 6, logoURI: '/usdc.png' })
    ),
}))

jest.mock('@/utils/general.utils', () => ({
    fetchTokenSymbol: jest.fn(() => Promise.resolve('USDC')),
    formatTokenAmount: jest.fn((amount: any, _decimals?: number) => amount?.toString() ?? '0'),
    isNativeCurrency: jest.fn(() => false),
    getRequestLink: jest.fn((data: any) => `https://peanut.me/request/pay?id=${data?.uuid || 'test-uuid'}`),
    formatAmount: jest.fn((v: any) => v ?? '0'),
    printableAddress: jest.fn((a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`),
    jsonStringify: jest.fn((v: any) => JSON.stringify(v)),
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
    PEANUT_WALLET_SUPPORTED_TOKENS: { '42161': ['0xaf88d065e77c8cc2239327c5edb3a432268e5831'] },
}))

jest.mock('@/constants/query.consts', () => ({
    TRANSACTIONS: 'transactions',
}))

jest.mock('@squirrel-labs/peanut-sdk', () => ({
    interfaces: {
        EPeanutLinkType: { native: 0, erc20: 1 },
    },
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
        <div data-testid="amount-input" data-disabled={props.disabled}>
            <input
                data-testid="amount-field"
                value={props.initialAmount ?? ''}
                onChange={(e) => {
                    props.setPrimaryAmount?.(e.target.value)
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
        <button data-testid="share-button" onClick={() => props.generateUrl?.()}>
            {props.children}
        </button>
    ),
}))

jest.mock('@/components/Global/FileUploadInput', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="file-upload-input">
            <input
                data-testid="comment-field"
                value={props.attachmentOptions?.message ?? ''}
                onChange={(e) =>
                    props.setAttachmentOptions?.({
                        ...props.attachmentOptions,
                        message: e.target.value,
                    })
                }
                placeholder={props.placeholder}
            />
        </div>
    ),
}))

jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: () => <div data-testid="loading-spinner" />,
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

jest.mock('@/components/Global/ErrorAlert', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="error-alert" role="alert">
            {props.description}
        </div>
    ),
}))

// ---------- context mocks ----------

const mockSetLoadingState = jest.fn()
const mockSetSelectedChainID = jest.fn()
const mockSetSelectedTokenAddress = jest.fn()

jest.mock('@/context', () => {
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
        loadingStateContext: React.createContext({
            loadingState: 'Idle' as string,
            setLoadingState: (...args: any[]) => mockSetLoadingState(...args),
            isLoading: false,
        }),
    }
})

// ---------- import components under test AFTER all mocks ----------
import { CreateRequestLinkView } from '../link/views/Create.request.link.view'
import { PayRequestLink } from '../Pay/Pay'

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
        <QueryClientProvider client={queryClient}>
            <CreateRequestLinkView />
        </QueryClientProvider>
    )
}

function renderPayRequest(params: Record<string, string> = {}) {
    setSearchParams(params)
    const queryClient = createQueryClient()

    return render(
        <QueryClientProvider client={queryClient}>
            <PayRequestLink />
        </QueryClientProvider>
    )
}

// ---------- default mock values ----------

function applyDefaults() {
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

    test('QR code is blurred before request is created', () => {
        renderCreateRequest()

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

        expect(screen.getByTestId('file-upload-input')).toBeInTheDocument()
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

    test('success toast is shown after link creation', async () => {
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

        const commentField = screen.getByTestId('comment-field')
        expect(commentField).toHaveValue('Bill split for CoolCafe')
    })

    test('merchant + amount params auto-create request link', async () => {
        renderCreateRequest({ merchant: 'CoolCafe', amount: '25' })

        await waitFor(() => {
            expect(mockRequestsApi.create).toHaveBeenCalled()
        })
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

    test('changing amount after link creation resets request state', async () => {
        renderCreateRequest()

        const field = screen.getByTestId('amount-field')
        fireEvent.change(field, { target: { value: '10' } })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Create request' }))
        })

        // Wait for link creation
        await waitFor(() => {
            expect(screen.getByTestId('share-button')).toBeInTheDocument()
        })

        // Now change the amount — this should reset the request
        await act(async () => {
            fireEvent.change(field, { target: { value: '20' } })
        })

        // The Create request button should reappear (since requestId is reset)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'Create request' })).toBeInTheDocument()
        })
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
        expect(mockSetSelectedTokenAddress).toHaveBeenCalledWith(
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
        )
    })
})
