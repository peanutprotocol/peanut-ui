/**
 * InitialClaimLinkView — cashout-limit refusal channel (chip P17 regression)
 *
 * The MIN/MAX_CASHOUT_LIMIT refusals fire in handleIbanRecipient, which only
 * runs on the claim-to-bank path (claimToExternalWallet = false). During the
 * TASK-22121 #26 error split they were briefly routed to fieldError, whose
 * only render site (the FieldColumn under the external-wallet recipient
 * input) is gated behind claimToExternalWallet — the refusal became
 * unrenderable on a money path. Pin the fix: the message must reach the
 * user through the flow Notification, and loading must return to Idle.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { IClaimScreenProps } from '../../Claim.consts'

// ---------- module mocks ----------

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/claim',
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, fill, ...rest } = props
        return <img alt="" {...rest} />
    },
}))

jest.mock('@sentry/nextjs', () => ({
    captureException: jest.fn(),
}))

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))

const mockSetLoadingState = jest.fn()
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: (state: string) => mockSetLoadingState(state),
            isLoading: false,
        }),
    }
})

// same-chain, same-token as the link so every cross-chain effect stays quiet
const ARB_CHAIN_ID = '42161'
const USDC_ARB = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext({
            selectedChainID: '42161',
            selectedTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            setSelectedChainID: jest.fn(),
            setSelectedTokenAddress: jest.fn(),
            selectedTokenData: {
                chainId: '42161',
                address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
                decimals: 6,
            },
            refetchXchainRoute: false,
            setRefetchXchainRoute: jest.fn(),
            isXChain: false,
            setIsXChain: jest.fn(),
            supportedChainsAndTokens: {},
            setDevconnectChainId: jest.fn(),
            setDevconnectRecipientAddress: jest.fn(),
            setDevconnectTokenAddress: jest.fn(),
        }),
    }
})

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', hasAppAccess: true, email: 'a@b.c', fullName: 'A B' }, accounts: [] },
        fetchUser: jest.fn(),
    }),
}))

jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ isConnected: false, address: undefined, fetchBalance: jest.fn() }),
}))

// claim-to-bank path: NOT claiming to an external wallet
jest.mock('@/context/ClaimBankFlowContext', () => ({
    ClaimBankFlowStep: { BankCountryList: 'BankCountryList' },
    useClaimBankFlow: () => ({
        claimToExternalWallet: false,
        flowStep: null,
        showVerificationModal: false,
        setShowVerificationModal: jest.fn(),
        verificationPromptReason: null,
        setVerificationPromptReason: jest.fn(),
        setClaimToExternalWallet: jest.fn(),
        resetFlow: jest.fn(),
        claimToMercadoPago: false,
        setClaimToMercadoPago: jest.fn(),
        setRegionalMethodType: jest.fn(),
        hideTokenSelector: false,
        setHideTokenSelector: jest.fn(),
    }),
}))

jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLink: jest.fn(), claimLinkXchain: jest.fn(), removeParamStep: jest.fn() }),
}))

jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ bankRails: () => [] }),
}))

jest.mock('@/hooks/useRecipientDisplay', () => ({
    useRecipientDisplay: () => ({ displayName: 'Sender' }),
}))

jest.mock('@/hooks/useFriendlyError', () => ({
    useFriendlyError: () => (error: unknown) => String(error),
}))

jest.mock('@/services/sendLinks', () => ({
    sendLinksApi: { associateClaim: jest.fn() },
}))

jest.mock('@/services/invites', () => ({
    invitesApi: { acceptInvite: jest.fn() },
}))

jest.mock('@/services/rhino-sda', () => ({
    previewSdaTransfer: jest.fn(),
}))

jest.mock('@/utils/api-fetch', () => ({
    apiFetch: jest.fn(),
}))

// heavy children that are irrelevant to the refusal path
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: () => <div data-testid="nav-header" />,
}))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: () => <div data-testid="details-card" />,
}))
jest.mock('@/components/Global/TokenSelector/TokenSelector', () => ({
    __esModule: true,
    default: () => <div data-testid="token-selector" />,
}))
jest.mock('@/components/Global/GeneralRecipientInput', () => ({
    __esModule: true,
    default: () => <div data-testid="recipient-input" />,
}))
jest.mock('@/components/Claim/Link/SendLinkActionList', () => ({
    __esModule: true,
    default: () => <div data-testid="action-list" />,
}))
jest.mock('../views/BankFlowManager.view', () => ({
    BankFlowManager: () => <div data-testid="bank-flow" />,
}))
jest.mock('../MantecaFlowManager', () => ({
    __esModule: true,
    default: () => <div data-testid="manteca-flow" />,
}))
jest.mock('@/components/Global/ActionModal', () => ({
    __esModule: true,
    default: () => null,
}))
jest.mock('@/components/Global/GuestVerificationModal', () => ({
    GuestVerificationModal: () => null,
}))

import { InitialClaimLinkView } from '../Initial.view'

// ---------- harness ----------

const claimLinkData = {
    // $3 link at tokenPrice 1 — below the $10 MIN_CASHOUT_LIMIT (test env is not 'development')
    amount: BigInt(3_000_000),
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    chainId: ARB_CHAIN_ID,
    tokenAddress: USDC_ARB,
    link: 'https://peanut.me/claim#p',
    pubKey: '0xpub',
    status: 'UNCLAIMED',
    createdAt: new Date().toISOString(),
    senderAddress: '0x1111111111111111111111111111111111111111',
    sender: { username: 'sender' },
}

const baseProps = {
    onPrev: jest.fn(),
    onNext: jest.fn(),
    onCustom: jest.fn(),
    claimLinkData,
    setClaimType: jest.fn(),
    // an IBAN recipient routes handleClaimAction into handleIbanRecipient
    recipient: { name: undefined, address: 'DE89370400440532013000' },
    setRecipient: jest.fn(),
    tokenPrice: 1,
    setTransactionHash: jest.fn(),
    attachment: { message: undefined, attachmentUrl: undefined },
    selectedRoute: undefined,
    setSelectedRoute: jest.fn(),
    hasFetchedRoute: false,
    setHasFetchedRoute: jest.fn(),
    recipientType: 'iban',
    setRecipientType: jest.fn(),
    setOfframpForm: jest.fn(),
    setUserType: jest.fn(),
    setInitialKYCStep: jest.fn(),
} as unknown as IClaimScreenProps

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const renderView = () =>
    render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <InitialClaimLinkView {...baseProps} />
            </QueryClientProvider>
        </IntlWrapper>
    )

beforeEach(() => {
    jest.clearAllMocks()
})

// ---------- tests ----------

describe('InitialClaimLinkView bank-claim cashout limits', () => {
    test('below-minimum refusal is user-visible in the flow Notification and loading returns to Idle', async () => {
        renderView()

        // the claim CTA (children are stubbed, so this is the only button)
        fireEvent.click(screen.getByRole('button'))

        // the refusal must render — on the bank path the recipient-input
        // FieldColumn is NOT mounted, so only the flow Notification can show it
        await waitFor(() => expect(screen.getByText(/below the \$10\.00 minimum for bank payouts/)).toBeInTheDocument())
        // no stuck spinner: the last loading transition is back to Idle
        expect(mockSetLoadingState).toHaveBeenLastCalledWith('Idle')
        // and the flow did not advance
        expect(baseProps.onNext).not.toHaveBeenCalled()
    })

    test('above-maximum refusal takes the same channel', async () => {
        const { unmount } = render(
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <InitialClaimLinkView
                        {...baseProps}
                        claimLinkData={
                            // $200,000 link — above the $101,000 MAX_CASHOUT_LIMIT
                            {
                                ...claimLinkData,
                                amount: BigInt(200_000_000_000),
                            } as unknown as typeof baseProps.claimLinkData
                        }
                    />
                </QueryClientProvider>
            </IntlWrapper>
        )

        fireEvent.click(screen.getByRole('button'))

        await waitFor(() =>
            expect(screen.getByText(/above the \$101,000\.00 maximum for bank payouts/)).toBeInTheDocument()
        )
        expect(mockSetLoadingState).toHaveBeenLastCalledWith('Idle')
        unmount()
    })
})
