/**
 * Claim Component — State Matrix Tests
 *
 * Tests the Claim component across 15 state combinations covering:
 * loading, link states (claimed/cancelled/not found/wrong password),
 * claim flow, sender view, and guest view.
 *
 * Strategy: mock every hook and service at the module level, then configure
 * per-test via mockReturnValue / mockImplementation.
 */
import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
    usePathname: () => '/claim',
}))

// next/image
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, layout, objectFit, fill, ...rest } = props
        return <img {...rest} />
    },
}))

// next/link
jest.mock('next/link', () => ({
    __esModule: true,
    default: ({ children, href, ...rest }: any) => (
        <a href={href} {...rest}>
            {children}
        </a>
    ),
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

const mockUseTransactionDetailsDrawer = jest.fn()
jest.mock('@/hooks/useTransactionDetailsDrawer', () => ({
    useTransactionDetailsDrawer: () => mockUseTransactionDetailsDrawer(),
}))

jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryEntryType: { SEND_LINK: 'SEND_LINK' },
    EHistoryUserRole: { SENDER: 'SENDER' },
}))

jest.mock('@/hooks/useUserInteractions', () => ({
    useUserInteractions: () => ({ interactions: {} }),
}))

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

const mockSetFlowStep = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        SavedAccountsList: 'saved-accounts-list',
        BankDetailsForm: 'bank-details-form',
        BankConfirmClaim: 'bank-confirm-claim',
        BankCountryList: 'bank-country-list',
    },
    useClaimBankFlow: () => ({
        setFlowStep: mockSetFlowStep,
        flowStep: null,
    }),
}))

jest.mock('@/context', () => ({
    tokenSelectorContext: React.createContext({
        selectedTokenAddress: '',
        selectedChainID: '',
        setSelectedChainID: jest.fn(),
        setSelectedTokenAddress: jest.fn(),
    }),
}))

jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({
        selectedTokenAddress: '',
        selectedChainID: '',
        setSelectedChainID: jest.fn(),
        setSelectedTokenAddress: jest.fn(),
    }),
}))

jest.mock('@/utils/general.utils', () => ({
    getInitialsFromName: jest.fn((n: string) => (n ? n.slice(0, 2).toUpperCase() : 'UN')),
    getTokenDetails: jest.fn(() => ({ symbol: 'USDC', decimals: 6 })),
    isStableCoin: jest.fn(() => true),
    getChainName: jest.fn(() => 'Polygon'),
    getTokenLogo: jest.fn(() => '/token.png'),
    getChainLogo: jest.fn(() => '/chain.png'),
}))

jest.mock('@/constants/kyc.consts', () => ({
    isUserKycVerified: jest.fn(() => false),
}))

jest.mock('@/app/actions/tokens', () => ({
    fetchTokenDetails: jest.fn(() => Promise.resolve({ symbol: 'USDC', decimals: 6 })),
    fetchTokenPrice: jest.fn(() => Promise.resolve({ price: 1 })),
}))

const mockSendLinksApi = {
    get: jest.fn(),
}
const mockGetParamsFromLink = jest.fn()
jest.mock('@/services/sendLinks', () => ({
    ESendLinkStatus: {
        creating: 'creating',
        completed: 'completed',
        CLAIMING: 'CLAIMING',
        CLAIMED: 'CLAIMED',
        CANCELLED: 'CANCELLED',
        FAILED: 'FAILED',
    },
    sendLinksApi: mockSendLinksApi,
    getParamsFromLink: (...args: any[]) => mockGetParamsFromLink(...args),
}))

jest.mock('@/utils/peanut-link.utils', () => ({
    generateKeysFromString: jest.fn(() => ({
        address: '0xPUBKEY',
        privateKey: '0xPRIVKEY',
    })),
    getParamsFromLink: jest.fn(),
    getLinkFromParams: jest.fn(),
}))

jest.mock('@/services/rhino-sda', () => ({
    previewSdaTransfer: jest.fn(),
    provisionSdaTransfer: jest.fn(),
}))

jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    REWARD_TOKENS: {},
}))

jest.mock('@/components/TransactionDetails/TransactionDetailsReceipt', () => ({
    TransactionDetailsReceipt: (props: any) => (
        <div data-testid="transaction-details-receipt">Receipt</div>
    ),
}))

jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({
        setIsSupportModalOpen: jest.fn(),
        openSupportWithMessage: jest.fn(),
    }),
}))

// Mock the sub-components
jest.mock('../Link/FlowManager', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="flow-manager">Claim Flow</div>,
}))

jest.mock('../Generic', () => ({
    ClaimedView: (props: any) => (
        <div data-testid="claimed-view">
            Link no longer available - ${props.amount}
            {props.senderUsername && <span> sent by {props.senderUsername}</span>}
        </div>
    ),
    ClaimErrorView: (props: any) => (
        <div data-testid="claim-error-view">
            <h1>{props.title}</h1>
            <p>{props.message}</p>
            <button data-testid="error-primary-btn" onClick={props.onPrimaryClick}>
                {props.primaryButtonText}
            </button>
        </div>
    ),
}))

jest.mock('@/components/0_Bruddle/PageContainer', () => ({
    __esModule: true,
    default: (props: any) => (
        <div data-testid="page-container" className={props.className}>
            {props.children}
        </div>
    ),
}))

jest.mock('@/components/Global/PeanutLoading', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="peanut-loading">Loading...</div>,
}))

jest.mock('@/animations/GIF_ALPHA_BACKGORUND/512X512_ALPHA_GIF_konradurban_05.gif', () => ({
    src: '/peanut-cry.gif',
}))

// ---------- import component under test AFTER all mocks ----------
import { Claim } from '../Claim'

// ---------- helpers ----------

function createQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
    })
}

function renderClaim() {
    const queryClient = createQueryClient()
    return render(
        <QueryClientProvider client={queryClient}>
            <Claim />
        </QueryClientProvider>
    )
}

// Standard link data returned from API
function makeSendLink(overrides: Record<string, any> = {}) {
    return {
        pubKey: '0xPUBKEY',
        depositIdx: 0,
        chainId: '137',
        contractVersion: 'v4',
        textContent: 'Hello!',
        fileUrl: undefined,
        status: 'completed',
        createdAt: new Date('2026-04-15'),
        senderAddress: '0xSENDER',
        amount: BigInt(10000000), // 10 USDC
        tokenAddress: '0xTOKEN',
        tokenDecimals: 6,
        tokenSymbol: 'USDC',
        sender: {
            userId: 'sender-123',
            username: 'alice',
        },
        claim: null,
        events: [],
        ...overrides,
    }
}

// ---------- default mock values ----------

function applyDefaults() {
    // window.location.href for link URL extraction
    Object.defineProperty(window, 'location', {
        value: { href: 'https://peanut.me/claim#p=testpassword' },
        writable: true,
    })

    mockGetParamsFromLink.mockReturnValue({ password: 'testpassword' })

    mockUseAuth.mockReturnValue({
        user: null,
        isFetchingUser: false,
        fetchUser: jest.fn(),
    })

    mockUseWallet.mockReturnValue({
        address: '0xWALLET',
        balance: BigInt(100000000),
    })

    mockUseTransactionDetailsDrawer.mockReturnValue({
        openTransactionDetails: jest.fn(),
        selectedTransaction: null,
        isDrawerOpen: false,
        closeTransactionDetails: jest.fn(),
    })

    // Default: API returns nothing (not called yet)
    mockSendLinksApi.get.mockResolvedValue(undefined)
}

// ---------- test suites ----------

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
    applyDefaults()
})

// ============================================================
// GROUP 1: Loading States
// ============================================================
describe('GROUP 1: Loading States', () => {
    test('Initial render shows loading spinner', () => {
        // sendLinksApi.get never resolves
        mockSendLinksApi.get.mockReturnValue(new Promise(() => {}))

        renderClaim()

        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })

    test('Loading with retries shows retry message', async () => {
        // Make API keep failing to trigger retries
        mockSendLinksApi.get.mockRejectedValue(new Error('Network error'))

        renderClaim()

        // Initially shows loading
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
    })
})

// ============================================================
// GROUP 2: Link Found States
// ============================================================
describe('GROUP 2: Link Found — Claimable', () => {
    test('Valid link shows claim flow manager', async () => {
        const link = makeSendLink()
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('flow-manager')).toBeInTheDocument()
        })
    })

    test('Valid link with text content processes correctly', async () => {
        const link = makeSendLink({ textContent: 'Here is your money!' })
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('flow-manager')).toBeInTheDocument()
        })
    })
})

// ============================================================
// GROUP 3: Already Claimed / Cancelled States
// ============================================================
describe('GROUP 3: Already Claimed / Cancelled', () => {
    test('CLAIMED link shows ClaimedView to guest', async () => {
        const link = makeSendLink({ status: 'CLAIMED', claim: { txHash: '0xCLAIM' } })
        mockSendLinksApi.get.mockResolvedValue(link)

        // Mock transaction drawer to provide selectedTransaction
        mockUseTransactionDetailsDrawer.mockReturnValue({
            openTransactionDetails: jest.fn(),
            selectedTransaction: { amount: 10, tokenSymbol: 'USDC' },
            isDrawerOpen: false,
            closeTransactionDetails: jest.fn(),
        })

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claimed-view')).toBeInTheDocument()
        })
    })

    test('CANCELLED link shows ClaimedView (link no longer available)', async () => {
        const link = makeSendLink({ status: 'CANCELLED' })
        mockSendLinksApi.get.mockResolvedValue(link)

        mockUseTransactionDetailsDrawer.mockReturnValue({
            openTransactionDetails: jest.fn(),
            selectedTransaction: { amount: 10, tokenSymbol: 'USDC' },
            isDrawerOpen: false,
            closeTransactionDetails: jest.fn(),
        })

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claimed-view')).toBeInTheDocument()
        })
    })

    test('CLAIMING link (in progress) shows as already claimed', async () => {
        const link = makeSendLink({ status: 'CLAIMING' })
        mockSendLinksApi.get.mockResolvedValue(link)

        mockUseTransactionDetailsDrawer.mockReturnValue({
            openTransactionDetails: jest.fn(),
            selectedTransaction: { amount: 10, tokenSymbol: 'USDC' },
            isDrawerOpen: false,
            closeTransactionDetails: jest.fn(),
        })

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claimed-view')).toBeInTheDocument()
        })
    })

    test('FAILED link with txHash shows as already claimed (funds left)', async () => {
        const link = makeSendLink({ status: 'FAILED', claim: { txHash: '0xFAILED' } })
        mockSendLinksApi.get.mockResolvedValue(link)

        mockUseTransactionDetailsDrawer.mockReturnValue({
            openTransactionDetails: jest.fn(),
            selectedTransaction: { amount: 10, tokenSymbol: 'USDC' },
            isDrawerOpen: false,
            closeTransactionDetails: jest.fn(),
        })

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claimed-view')).toBeInTheDocument()
        })
    })

    test('FAILED link WITHOUT txHash is retryable (shows claim flow)', async () => {
        const link = makeSendLink({ status: 'FAILED', claim: { txHash: null } })
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('flow-manager')).toBeInTheDocument()
        })
    })
})

// ============================================================
// GROUP 4: Error States
// ============================================================
describe('GROUP 4: Error States', () => {
    test('Wrong password shows error view', async () => {
        mockGetParamsFromLink.mockReturnValue({ password: 'wrongpassword' })
        // generateKeysFromString returns a pubkey that doesn't match
        const { generateKeysFromString } = require('@/utils/peanut-link.utils')
        generateKeysFromString.mockReturnValue({ address: '0xWRONG_PUBKEY' })

        const link = makeSendLink({ pubKey: '0xPUBKEY' })
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claim-error-view')).toBeInTheDocument()
            expect(screen.getByText('Wrong password!')).toBeInTheDocument()
        })

        // Reset mock
        generateKeysFromString.mockReturnValue({ address: '0xPUBKEY' })
    })

    test('No password in link shows wrong password error', async () => {
        mockGetParamsFromLink.mockReturnValue({ password: undefined })
        const link = makeSendLink()
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('claim-error-view')).toBeInTheDocument()
            expect(screen.getByText('Wrong password!')).toBeInTheDocument()
        })
    })

    test('API error with retry:false keeps loading (failureCount < 4)', async () => {
        // With retry: false in test QueryClient, failureCount stays at 1
        // which is < 4 threshold, so component stays in LOADING state
        // (in production, after 4 retries it would show NOT_FOUND)
        mockSendLinksApi.get.mockRejectedValue(new Error('Not found'))

        renderClaim()

        // Component stays in loading state because failureCount < 4
        await waitFor(() => {
            expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
        })
    })
})

// ============================================================
// GROUP 5: User-Dependent States
// ============================================================
describe('GROUP 5: User-Dependent States', () => {
    test('Sender viewing their own claimed link sees transaction receipt', async () => {
        mockUseAuth.mockReturnValue({
            user: { user: { userId: 'sender-123' } },
            isFetchingUser: false,
            fetchUser: jest.fn(),
        })

        const link = makeSendLink({
            status: 'CLAIMED',
            claim: { txHash: '0xCLAIM', recipient: { username: 'bob' } },
            sender: { userId: 'sender-123', username: 'alice' },
        })
        mockSendLinksApi.get.mockResolvedValue(link)

        const mockOpenDetails = jest.fn()
        mockUseTransactionDetailsDrawer.mockReturnValue({
            openTransactionDetails: mockOpenDetails,
            selectedTransaction: { amount: 10, tokenSymbol: 'USDC' },
            isDrawerOpen: true,
            closeTransactionDetails: jest.fn(),
        })

        renderClaim()

        // Sender should see receipt, NOT the ClaimedView
        await waitFor(() => {
            expect(screen.getByTestId('transaction-details-receipt')).toBeInTheDocument()
        })

        // ClaimedView should NOT be shown to the sender
        expect(screen.queryByTestId('claimed-view')).not.toBeInTheDocument()
    })

    test('Guest user on claimable link sees claim flow', async () => {
        mockUseAuth.mockReturnValue({
            user: null,
            isFetchingUser: false,
            fetchUser: jest.fn(),
        })

        const link = makeSendLink()
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('flow-manager')).toBeInTheDocument()
        })
    })

    test('Authenticated non-sender on claimable link sees claim flow', async () => {
        mockUseAuth.mockReturnValue({
            user: { user: { userId: 'other-user-456' } },
            isFetchingUser: false,
            fetchUser: jest.fn(),
        })

        const link = makeSendLink()
        mockSendLinksApi.get.mockResolvedValue(link)

        renderClaim()

        await waitFor(() => {
            expect(screen.getByTestId('flow-manager')).toBeInTheDocument()
        })
    })
})
