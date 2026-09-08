/**
 * InitialClaimLinkView — post-auth auto-claim trigger (consumer half of the
 * redirect contract, chip re-review on TASK-21854)
 *
 * After an auth redirect the URL is the only carrier of the tapped intent:
 * `?step=claim` must fire the claim exactly once for a peanut-wallet user,
 * `?step=regional-claim&method=pix` must restore the regional method, and the
 * trigger must not re-fire across a re-render. The REAL useInitialClaimFlow
 * runs (params via withNuqsTestingAdapter); the claim is observed at the
 * service boundary (useClaimLink's claimLink), since handleClaimLink's own
 * (false, true) call args are internal to the hook.
 */
import React from 'react'
import { render, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
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

// The trigger effect depends on `user` identity. In prod, fetchUser() during
// the claim REPLACES the user object, so the effect re-runs mid-claim — the
// consume-once guard in useInitialClaimFlow is what keeps that re-run from
// firing a second claim POST. `currentUser` is mutable so a test can stage
// exactly that identity swap.
const stableUser = {
    user: { userId: 'u1', hasAppAccess: true, email: 'a@b.c', fullName: 'A B' },
    accounts: [],
}
let currentUser: typeof stableUser = stableUser
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: currentUser,
        fetchUser: jest.fn(),
    }),
}))

// peanut-wallet user: isConnected + address make the claim route to claimLink
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({
        isConnected: true,
        address: '0x2222222222222222222222222222222222222222',
        fetchBalance: jest.fn(),
    }),
}))

const mockSetRegionalMethodType = jest.fn()
const mockSetClaimToMercadoPago = jest.fn()
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
        setClaimToMercadoPago: (...args: unknown[]) => mockSetClaimToMercadoPago(...args),
        setRegionalMethodType: (...args: unknown[]) => mockSetRegionalMethodType(...args),
        hideTokenSelector: false,
        setHideTokenSelector: jest.fn(),
    }),
}))

// the claim service boundary — the observable effect of handleClaimLink
const mockClaimLink = jest.fn()
const mockRemoveParamStep = jest.fn()
jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({
        claimLink: (...args: unknown[]) => mockClaimLink(...args),
        claimLinkXchain: jest.fn(),
        removeParamStep: (...args: unknown[]) => mockRemoveParamStep(...args),
    }),
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
    sendLinksApi: { associateClaim: jest.fn().mockResolvedValue(undefined) },
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

// heavy children that are irrelevant to the trigger path
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
jest.mock('../views/ClaimAddressConfirmationModal.view', () => ({
    ClaimAddressConfirmationModal: () => null,
}))
jest.mock('../MantecaFlowManager', () => ({
    __esModule: true,
    default: () => <div data-testid="manteca-flow" />,
}))
jest.mock('@/components/Global/GuestVerificationModal', () => ({
    GuestVerificationModal: () => null,
}))

import { InitialClaimLinkView } from '../Initial.view'

// ---------- harness ----------

const claimLinkData = {
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
    recipient: { name: undefined, address: '' },
    setRecipient: jest.fn(),
    tokenPrice: 1,
    setTransactionHash: jest.fn(),
    attachment: { message: undefined, attachmentUrl: undefined },
    selectedRoute: undefined,
    setSelectedRoute: jest.fn(),
    hasFetchedRoute: false,
    setHasFetchedRoute: jest.fn(),
    recipientType: 'address',
    setRecipientType: jest.fn(),
    setOfframpForm: jest.fn(),
    setUserType: jest.fn(),
    setInitialKYCStep: jest.fn(),
} as unknown as IClaimScreenProps

const renderView = (searchParams: string) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
        <IntlWrapper>
            <QueryClientProvider client={queryClient}>
                <InitialClaimLinkView {...baseProps} />
            </QueryClientProvider>
        </IntlWrapper>,
        // real nuqs reads: the trigger params come from the adapter's URL
        { wrapper: withNuqsTestingAdapter({ searchParams }) }
    )
}

beforeEach(() => {
    jest.clearAllMocks()
    currentUser = stableUser
    mockClaimLink.mockResolvedValue('0xtxhash')
})

// ---------- tests ----------

describe('InitialClaimLinkView post-auth auto-claim trigger', () => {
    test('?step=claim with a peanut-wallet user fires the claim exactly once at the service boundary', async () => {
        renderView('?step=claim')

        await waitFor(() => expect(mockClaimLink).toHaveBeenCalledTimes(1))
        // the peanut-wallet auto-claim: own wallet address, the link itself,
        // optimistic return — the observable shape of handleClaimLink(false, true)
        expect(mockClaimLink).toHaveBeenCalledWith(
            expect.objectContaining({
                address: '0x2222222222222222222222222222222222222222',
                link: claimLinkData.link,
                optimisticReturn: true,
            })
        )
        // the producer half of the contract: the trigger param is cleared
        expect(mockRemoveParamStep).toHaveBeenCalled()
        // and the flow advanced to SUCCESS
        await waitFor(() => expect(baseProps.onCustom).toHaveBeenCalledWith('SUCCESS'))
    })

    test('?step=regional-claim&method=pix restores the regional method and opens the regional flow', async () => {
        renderView('?step=regional-claim&method=pix')

        await waitFor(() => expect(mockSetClaimToMercadoPago).toHaveBeenCalledWith(true))
        expect(mockSetRegionalMethodType).toHaveBeenCalledWith('pix')
        expect(mockRemoveParamStep).toHaveBeenCalled()
        // regional path must not touch the on-chain claim boundary
        expect(mockClaimLink).not.toHaveBeenCalled()
    })

    test('the claim is not re-fired across a re-render, and a cleared step param fires nothing', async () => {
        const { rerender } = renderView('?step=claim')

        await waitFor(() => expect(mockClaimLink).toHaveBeenCalledTimes(1))

        // re-render with identical inputs — the trigger effect must not re-run
        // (stable deps; removeParamStep already cleared the URL in prod)
        rerender(
            <IntlWrapper>
                <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                    <InitialClaimLinkView {...baseProps} />
                </QueryClientProvider>
            </IntlWrapper>
        )
        expect(mockClaimLink).toHaveBeenCalledTimes(1)
        expect(mockRemoveParamStep).toHaveBeenCalledTimes(1)

        // and a mount with the step param already cleared triggers nothing
        jest.clearAllMocks()
        mockClaimLink.mockResolvedValue('0xtxhash')
        renderView('')
        // the trigger effect still runs (guard passes) and clears params,
        // but with no step it must not claim
        await waitFor(() => expect(mockRemoveParamStep).toHaveBeenCalled())
        expect(mockClaimLink).not.toHaveBeenCalled()
        expect(mockSetClaimToMercadoPago).not.toHaveBeenCalled()
    })

    test('a user refetch mid-claim (new user identity) does not fire a second claim POST', async () => {
        // Prod sequence: auto-claim fires -> fetchUser() replaces the user
        // object -> the trigger effect re-runs while nuqs still reports
        // step=claim (removeParamStep goes through a raw replaceState nuqs
        // does not observe). The consume-once guard must swallow the re-run —
        // a second POST rejects against the claimed link and paints an error
        // over the success screen.
        const { rerender } = renderView('?step=claim')
        await waitFor(() => expect(mockClaimLink).toHaveBeenCalledTimes(1))

        currentUser = { ...stableUser }
        rerender(
            <IntlWrapper>
                <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                    <InitialClaimLinkView {...baseProps} />
                </QueryClientProvider>
            </IntlWrapper>
        )

        expect(mockClaimLink).toHaveBeenCalledTimes(1)
    })
})
