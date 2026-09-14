/**
 * useClaimFlow — state-machine hook extracted from Claim.tsx (TASK-21854).
 *
 * Covers the link-state resolution paths (claimable, already claimed, wrong
 * password) and the step navigation handlers. Mock harness mirrors
 * claim-states.test.tsx.
 */
import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'

// ---------- module-level mocks (must be before imports that depend on them) ----------

const mockSearchParams = new Map<string, string>()
jest.mock('next/navigation', () => ({
    useSearchParams: () => ({
        get: (key: string) => mockSearchParams.get(key) ?? null,
    }),
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
    }),
    usePathname: () => '/claim',
}))

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({
    useAuth: () => mockUseAuth(),
}))

const mockUseWallet = jest.fn()
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => mockUseWallet(),
}))

jest.mock('@/hooks/useTransactionHistory', () => ({
    EHistoryUserRole: { SENDER: 'SENDER' },
}))

jest.mock('@/hooks/useUserInteractions', () => ({
    useUserInteractions: () => ({ interactions: {} }),
}))

jest.mock('use-haptic', () => ({
    useHaptic: () => ({ triggerHaptic: jest.fn() }),
}))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ isKycApproved: false, bankRails: () => [] }),
}))

const mockSetFlowStep = jest.fn()
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {
        BankCountryList: 'bank-country-list',
    },
    useClaimBankFlow: () => ({
        setFlowStep: mockSetFlowStep,
        flowStep: null,
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

jest.mock('@/app/actions/users', () => ({
    getUserById: jest.fn(() => Promise.resolve({ isVerified: false })),
}))

jest.mock('@/app/actions/tokens', () => ({
    fetchTokenDetails: jest.fn(() => Promise.resolve({ symbol: 'USDC', decimals: 6 })),
}))

jest.mock('@/services/tokens-price', () => ({
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
    resolveClaimLink: (link: string) => link,
}))

jest.mock('@/utils/peanut-link.utils', () => ({
    generateKeysFromString: jest.fn(() => ({
        address: '0xPUBKEY',
        privateKey: '0xPRIVKEY',
    })),
}))

jest.mock('@/components/TransactionDetails/transactionTransformer', () => ({
    REWARD_TOKENS: {},
}))

// ---------- import hook under test AFTER all mocks ----------
import { useClaimFlow } from '../useClaimFlow'
import * as _consts from '../Claim.consts'

// ---------- helpers ----------

function renderClaimFlow() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
        },
    })
    const NuqsAdapter = withNuqsTestingAdapter()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NuqsAdapter>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
            </IntlWrapper>
        </NuqsAdapter>
    )
    return renderHook(() => useClaimFlow(), { wrapper })
}

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
        amount: BigInt(10000000),
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

beforeEach(() => {
    jest.clearAllMocks()
    mockSearchParams.clear()
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
    mockSendLinksApi.get.mockResolvedValue(undefined)
})

describe('useClaimFlow', () => {
    test('starts in LOADING with the initial step', () => {
        mockSendLinksApi.get.mockReturnValue(new Promise(() => {}))

        const { result } = renderClaimFlow()

        expect(result.current.linkState).toBe(_consts.claimLinkStateType.LOADING)
        expect(result.current.step).toEqual(_consts.INIT_VIEW_STATE)
    })

    test('valid claimable link resolves to CLAIM with populated claimLinkData', async () => {
        mockSendLinksApi.get.mockResolvedValue(makeSendLink())

        const { result } = renderClaimFlow()

        await waitFor(() => {
            expect(result.current.linkState).toBe(_consts.claimLinkStateType.CLAIM)
        })
        expect(result.current.claimLinkData?.tokenSymbol).toBe('USDC')
        expect(result.current.claimLinkData?.password).toBe('testpassword')
        expect(result.current.tokenPrice).toBe(1)
        expect(result.current.attachment.message).toBe('Hello!')
    })

    test('CLAIMED link resolves to ALREADY_CLAIMED', async () => {
        mockSendLinksApi.get.mockResolvedValue(makeSendLink({ status: 'CLAIMED', claim: { txHash: '0xCLAIM' } }))

        const { result } = renderClaimFlow()

        await waitFor(() => {
            expect(result.current.linkState).toBe(_consts.claimLinkStateType.ALREADY_CLAIMED)
        })
    })

    test('link without a password resolves to WRONG_PASSWORD', async () => {
        // note: the pubkey-mismatch WRONG_PASSWORD is transient — the
        // user-dependent effect overwrites it once claimLinkData lands
        // (pre-existing behavior) — so assert on the stable no-password path
        mockGetParamsFromLink.mockReturnValue({ password: undefined })
        mockSendLinksApi.get.mockResolvedValue(makeSendLink())

        const { result } = renderClaimFlow()

        await waitFor(() => {
            expect(result.current.linkState).toBe(_consts.claimLinkStateType.WRONG_PASSWORD)
        })
    })

    test('sender viewing their own claimable link resolves to CLAIM_SENDER', async () => {
        mockUseAuth.mockReturnValue({
            user: { user: { userId: 'sender-123' } },
            isFetchingUser: false,
            fetchUser: jest.fn(),
        })
        mockSendLinksApi.get.mockResolvedValue(makeSendLink())

        const { result } = renderClaimFlow()

        await waitFor(() => {
            expect(result.current.linkState).toBe(_consts.claimLinkStateType.CLAIM_SENDER)
        })
    })

    test('step navigation: next, prev, and custom jump', () => {
        mockSendLinksApi.get.mockReturnValue(new Promise(() => {}))

        const { result } = renderClaimFlow()

        expect(result.current.step.idx).toBe(0)

        act(() => result.current.handleOnNext())
        expect(result.current.step.idx).toBe(1)
        expect(result.current.step.screen).toBe(_consts.CLAIM_SCREEN_FLOW[1])

        act(() => result.current.handleOnPrev())
        expect(result.current.step.idx).toBe(0)

        // prev at the first screen is a no-op
        act(() => result.current.handleOnPrev())
        expect(result.current.step.idx).toBe(0)

        act(() => result.current.handleOnCustom('SUCCESS'))
        expect(result.current.step.screen).toBe('SUCCESS')
        expect(result.current.step.idx).toBe(_consts.CLAIM_SCREEN_FLOW.indexOf('SUCCESS'))
    })
})
