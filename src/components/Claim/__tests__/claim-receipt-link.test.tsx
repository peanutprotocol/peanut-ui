/**
 * The sender's receipt on /claim builds itself from the link, so only the
 * link's history entry can say whether it has a public receipt (TASK-24263).
 * The claim flow's receipt goes through the real ReceiptActions: with the
 * API's flag, Share receipt sends the same link Activity shares; without it,
 * the PDF share stays.
 */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import React from 'react'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import type { TransactionDetails } from '@/components/TransactionDetails/transactionTransformer'
import type { ReceiptViewModel } from '@/components/TransactionDetails/useReceiptViewModel'

// ---------- claim flow ----------

jest.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: () => null }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
    usePathname: () => '/claim',
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
const mockUseAuth = jest.fn()
jest.mock('@/context/authContext', () => ({ useAuth: () => mockUseAuth() }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ address: '0xWALLET' }) }))
jest.mock('@/hooks/useUserInteractions', () => ({ useUserInteractions: () => ({ interactions: {} }) }))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ isKycApproved: false }) }))
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: {},
    useClaimBankFlow: () => ({ setFlowStep: jest.fn(), flowStep: null }),
}))
jest.mock('@/context/tokenSelector.context', () => ({
    tokenSelectorContext: React.createContext({ setSelectedChainID: jest.fn(), setSelectedTokenAddress: jest.fn() }),
}))
jest.mock('@/app/actions/users', () => ({ getUserById: jest.fn(() => Promise.resolve({ isVerified: false })) }))
jest.mock('@/app/actions/tokens', () => ({
    fetchTokenDetails: jest.fn(() => Promise.resolve({ symbol: 'USDC', decimals: 6 })),
}))
jest.mock('@/services/tokens-price', () => ({ fetchTokenPrice: jest.fn(() => Promise.resolve({ price: 1 })) }))
const mockGetSendLink = jest.fn()
jest.mock('@/services/sendLinks', () => ({
    ESendLinkStatus: {
        creating: 'creating',
        completed: 'completed',
        CLAIMING: 'CLAIMING',
        CLAIMED: 'CLAIMED',
        CANCELLED: 'CANCELLED',
        FAILED: 'FAILED',
    },
    sendLinksApi: { get: (...args: unknown[]) => mockGetSendLink(...args) },
    getParamsFromLink: () => ({ password: 'testpassword' }),
    resolveClaimLink: (link: string) => link,
}))
jest.mock('@/utils/peanut-link.utils', () => ({ generateKeysFromString: () => ({ address: '0xPUBKEY' }) }))
const mockUseHistoryEntry = jest.fn()
jest.mock('@/hooks/useHistoryEntry', () => ({
    useHistoryEntry: (...args: unknown[]) => mockUseHistoryEntry(...args),
}))

// ---------- receipt actions (harness of ReceiptActions.receipt-routing.test) ----------

jest.mock('next-intl', () => ({ useLocale: () => 'en' }))
jest.mock('posthog-js', () => ({ capture: jest.fn() }))
jest.mock('@/i18n/app/useAppTranslations', () => ({ useAppTranslations: () => (key: string) => key }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn().mockReturnValue(false),
    isIOSNative: jest.fn().mockReturnValue(false),
    isAndroidNative: jest.fn().mockReturnValue(false),
    isLegacyWebKit: jest.fn().mockReturnValue(false),
    openExternalUrl: jest.fn(),
}))
jest.mock('@/components/TransactionDetails/useReceiptActions', () => ({
    useReceiptActions: () => ({ closeRequest: jest.fn(), rejectRequest: jest.fn(), cancelSendLink: jest.fn() }),
}))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({
        children,
        onClick,
        ...rest
    }: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: React.ReactNode }) => (
        <button onClick={onClick} data-testid={(rest as Record<string, string>)['data-testid']}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/Global/CancelSendLinkDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Icons/Icon', () => ({ Icon: () => null }))
jest.mock('@/components/Global/ShareButton', () => ({
    __esModule: true,
    default: ({ children, url }: { children?: React.ReactNode; url?: string }) => (
        <button data-testid="link-share" data-url={url}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/TransactionDetails/useReceiptPdfFile', () => ({
    useReceiptPdfFile: () => ({ share: jest.fn(), download: jest.fn(), busy: null, unavailable: false, error: false }),
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/components/TransactionDetails/useReceiptReferralAction', () => ({ useReceiptReferralAction: () => null }))
jest.mock('@/components/Setup/Views/SignTestTransaction', () => ({ PasskeyDocsLink: () => null }))
jest.mock('@/components/TransactionDetails/provider-actions/CancelDepositActions', () => ({
    CancelDepositActions: () => null,
}))
jest.mock('@/components/TransactionDetails/ReceiptSupportLink', () => ({ ReceiptSupportLink: () => null }))
jest.mock('@/components/TransactionDetails/DownloadReceiptPdfLink', () => ({ DownloadReceiptPdfLink: () => null }))
jest.mock('@/components/TransactionDetails/ReceiptMoreActionsDrawer', () => ({ ReceiptMoreActionsDrawer: () => null }))

import { useClaimFlow } from '../useClaimFlow'
import { ReceiptActions } from '@/components/TransactionDetails/ReceiptActions'

const SENDER = { user: { userId: 'sender-123' } }
const RECEIVER = { user: { userId: 'receiver-456' } }

const claimedLink = {
    pubKey: '0xPUBKEY',
    depositIdx: 0,
    chainId: '137',
    contractVersion: 'v4',
    status: 'CLAIMED',
    createdAt: new Date('2026-10-30'),
    senderAddress: '0xSENDER',
    amount: BigInt(10000000),
    tokenAddress: '0xTOKEN',
    sender: { userId: 'sender-123', username: 'alice' },
    claim: { txHash: '0xCLAIM', recipient: { username: 'bob' } },
    events: [],
}

/** The SEND_LINK entry Activity shows: keyed by the intent id, not the pubKey. */
const linkEntry = (publicReceipt?: boolean) => ({
    uuid: 'intent-1',
    status: 'COMPLETED',
    extraData: { kind: 'SEND_LINK', publicReceipt },
})

const vm = {
    isPendingBankRequest: false,
    isPendingRequestee: false,
    isPendingRequester: false,
    isPendingSentLink: false,
    shouldShowShareReceipt: true,
    shouldShowDownloadPdf: true,
} as ReceiptViewModel

function renderClaimFlow() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const NuqsAdapter = withNuqsTestingAdapter()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </NuqsAdapter>
    )
    return renderHook(() => useClaimFlow(), { wrapper })
}

const renderReceiptActions = (receipt: TransactionDetails) =>
    render(
        <ReceiptActions transaction={receipt} vm={vm} isPublic={false} amountDisplay="$10" shouldShowQrShare={false} />
    )

/** The sender's receipt once the claim flow has resolved the link. */
async function senderReceipt() {
    const { result } = renderClaimFlow()
    await waitFor(() => expect(result.current.showTransactionReceipt).toBe(true))
    return result.current.selectedTransaction as TransactionDetails
}

beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: SENDER, isFetchingUser: false })
    mockGetSendLink.mockResolvedValue(claimedLink)
    mockUseHistoryEntry.mockReturnValue({ data: undefined })
})

describe('claim page receipt link (TASK-24263)', () => {
    test('a flagged entry: Share receipt sends the link Activity shares, keyed by the intent id', async () => {
        mockUseHistoryEntry.mockReturnValue({ data: linkEntry(true) })

        const receipt = await senderReceipt()
        renderReceiptActions(receipt)

        expect(mockUseHistoryEntry).toHaveBeenLastCalledWith('0xPUBKEY', 'SEND_LINK', { enabled: true })
        const share = screen.getByTestId('link-share')
        expect(share).toHaveTextContent('actions.shareReceipt')
        expect(share).toHaveAttribute('data-url', expect.stringContaining('/receipt/intent-1?kind=SEND_LINK'))
        expect(screen.queryByTestId('pdf-share')).not.toBeInTheDocument()
    })

    test.each([
        ['the entry has not loaded or its fetch failed', undefined],
        ['the entry has no public receipt', linkEntry(false)],
    ])('%s: the PDF share stays the primary', async (_case, entry) => {
        mockUseHistoryEntry.mockReturnValue({ data: entry })

        const receipt = await senderReceipt()
        renderReceiptActions(receipt)

        expect(screen.queryByTestId('link-share')).not.toBeInTheDocument()
        expect(screen.getByTestId('pdf-share')).toHaveTextContent('actions.shareReceipt')
    })

    test.each([
        ['a guest', null],
        ['the receiver', RECEIVER],
    ])('%s never reads the history entry', async (_case, user) => {
        mockUseAuth.mockReturnValue({ user, isFetchingUser: false })

        const { result } = renderClaimFlow()
        await waitFor(() => expect(result.current.claimLinkData).toBeDefined())
        await waitFor(() => expect(mockUseHistoryEntry).toHaveBeenCalled())

        expect(result.current.showTransactionReceipt).toBe(false)
        for (const call of mockUseHistoryEntry.mock.calls) expect(call[2]).toEqual({ enabled: false })
    })
})
