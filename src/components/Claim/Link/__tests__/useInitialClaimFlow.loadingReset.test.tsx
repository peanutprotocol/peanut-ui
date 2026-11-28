/**
 * An external-wallet claim confirmed with no recipient address must not leave
 * the app-wide loading state on: it used to set 'Loading' and return before
 * the try/finally that resets it, so the claim button stayed in its spinner.
 */
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import type { IClaimScreenProps } from '../../Claim.consts'

const mockSetLoadingState = jest.fn()
const mockClaimLink = jest.fn()

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/claim',
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: (...args: unknown[]) => mockSetLoadingState(...args),
            isLoading: false,
        }),
    }
})
// the selection is supplied per test through the provider below
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return { tokenSelectorContext: ReactActual.createContext(null) }
})
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: { user: { userId: 'u1', email: 'a@b.c', fullName: 'A B' }, accounts: [] },
        fetchUser: jest.fn(),
    }),
}))
// an external-wallet / bank claimer, not a Peanut wallet user
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ isConnected: false, address: undefined, fetchBalance: jest.fn() }),
}))
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
        setRegionalMethodType: jest.fn(),
        hideTokenSelector: false,
        setHideTokenSelector: jest.fn(),
    }),
}))
jest.mock('../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLink: mockClaimLink, claimLinkXchain: jest.fn(), removeParamStep: jest.fn() }),
}))
jest.mock('@/hooks/useCapabilities', () => ({ useCapabilities: () => ({ bankRails: () => [] }) }))
jest.mock('@/hooks/useRecipientDisplay', () => ({ useRecipientDisplay: () => ({ displayName: 'Sender' }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (error: unknown) => String(error) }))
jest.mock('@/services/sendLinks', () => ({
    sendLinksApi: { associateClaim: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock('@/services/invites', () => ({ invitesApi: { acceptInvite: jest.fn() } }))
const mockPreviewSdaTransfer = jest.fn()
jest.mock('@/services/rhino-sda', () => ({
    previewSdaTransfer: (...args: unknown[]) => mockPreviewSdaTransfer(...args),
}))
jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn() }))

import { tokenSelectorContext } from '@/context/tokenSelector.context'
import { useInitialClaimFlow } from '../useInitialClaimFlow'

const ARB_USDC = {
    chainId: '42161',
    address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    symbol: 'USDC',
    decimals: 6,
}

const renderFlow = (recipientAddress: string) => {
    const selector = {
        selectedChainID: ARB_USDC.chainId,
        selectedTokenAddress: ARB_USDC.address,
        setSelectedChainID: jest.fn(),
        setSelectedTokenAddress: jest.fn(),
        selectedTokenData: { ...ARB_USDC, price: 1 },
        refetchXchainRoute: false,
        setRefetchXchainRoute: jest.fn(),
        readTokenPrice: () => () => {},
        isXChain: false,
        setIsXChain: jest.fn(),
        supportedChainsAndTokens: {},
        setDevconnectChainId: jest.fn(),
        setDevconnectRecipientAddress: jest.fn(),
        setDevconnectTokenAddress: jest.fn(),
    }
    const props = {
        onPrev: jest.fn(),
        onNext: jest.fn(),
        onCustom: jest.fn(),
        claimLinkData: {
            amount: 5_000_000n,
            tokenDecimals: 6,
            tokenSymbol: 'USDC',
            chainId: ARB_USDC.chainId,
            tokenAddress: ARB_USDC.address,
            link: 'https://peanut.me/claim#p',
            pubKey: '0xpub',
            status: 'UNCLAIMED',
            createdAt: new Date().toISOString(),
            senderAddress: '0x1111111111111111111111111111111111111111',
            sender: { username: 'sender' },
        },
        setClaimType: jest.fn(),
        recipient: { name: undefined, address: recipientAddress },
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
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const NuqsAdapter = withNuqsTestingAdapter({ searchParams: '' })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <NuqsAdapter>
            <IntlWrapper>
                <QueryClientProvider client={queryClient}>
                    <tokenSelectorContext.Provider value={selector as never}>{children}</tokenSelectorContext.Provider>
                </QueryClientProvider>
            </IntlWrapper>
        </NuqsAdapter>
    )
    return renderHook(() => useInitialClaimFlow(props, undefined), { wrapper })
}

beforeEach(() => jest.clearAllMocks())

describe('external-wallet claim without a recipient address', () => {
    it('claims nothing and releases the loading state', async () => {
        const { result } = renderFlow('')

        await act(async () => {
            await result.current.handleClaimLink(true)
        })

        expect(mockClaimLink).not.toHaveBeenCalled()
        expect(mockSetLoadingState).toHaveBeenCalledWith('Loading')
        expect(mockSetLoadingState).toHaveBeenLastCalledWith('Idle')
    })
})
