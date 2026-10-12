/**
 * TASK-22590: a cross-chain claim quote is sized by the link's amount, which
 * is in the link's (source) token base units. It used to be formatted with the
 * selected destination token's decimals — harmless while every USDC read as
 * 6, wrong by 10^12 once BNB Chain USDC reads its real 18. Both directions and
 * the explicit off-ramp route are pinned here with real catalog metadata; the
 * quote is observed at the Rhino preview boundary.
 */
import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'
import type { IClaimScreenProps } from '../../Claim.consts'

// ---------- module mocks (same boundaries as Initial.view.autoClaim.test) ----------

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
            setLoadingState: jest.fn(),
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
import { getSupportedChainsAndTokens } from '@/app/actions/supported-chains'
import { useInitialClaimFlow } from '../useInitialClaimFlow'

// ---------- harness ----------

const SENDER = '0x1111111111111111111111111111111111111111'
const EXTERNAL_RECIPIENT = '0x3333333333333333333333333333333333333333'

type CatalogToken = { chainId: string; address: string; symbol: string; decimals: number }
let arbUsdc: CatalogToken
let bscUsdc: CatalogToken

beforeAll(async () => {
    const catalog = await getSupportedChainsAndTokens()
    const usdcOn = (chainId: string) => catalog[chainId].tokens.find((t) => t.symbol === 'USDC')! as CatalogToken
    arbUsdc = usdcOn('42161')
    bscUsdc = usdcOn('56')
})

beforeEach(() => {
    jest.clearAllMocks()
    mockPreviewSdaTransfer.mockResolvedValue({
        receiveAmount: '10',
        feeUsd: 0,
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    })
})

/** A link holding `units` whole tokens of `token`, with the source decimals
 *  the claim flow reads for it (useClaimFlow → fetchTokenDetails → catalog). */
const linkOf = (token: CatalogToken, units: number) => ({
    amount: BigInt(units) * 10n ** BigInt(token.decimals),
    tokenDecimals: token.decimals,
    tokenSymbol: token.symbol,
    chainId: token.chainId,
    tokenAddress: token.address,
    link: 'https://peanut.me/claim#p',
    pubKey: '0xpub',
    status: 'UNCLAIMED',
    createdAt: new Date().toISOString(),
    senderAddress: SENDER,
    sender: { username: 'sender' },
})

const renderFlow = ({
    link,
    destination,
    recipient,
    recipientType = 'address',
    autoQuote,
}: {
    link: ReturnType<typeof linkOf>
    destination: CatalogToken
    recipient: string
    recipientType?: string
    autoQuote: boolean
}) => {
    const selector = {
        selectedChainID: destination.chainId,
        selectedTokenAddress: destination.address,
        setSelectedChainID: jest.fn(),
        setSelectedTokenAddress: jest.fn(),
        // the selector hands over catalog decimals for a stablecoin (useTokenPrice)
        selectedTokenData: { ...destination, price: 1 },
        refetchXchainRoute: autoQuote,
        setRefetchXchainRoute: jest.fn(),
        isXChain: autoQuote,
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
        claimLinkData: link,
        setClaimType: jest.fn(),
        recipient: { name: undefined, address: recipient },
        setRecipient: jest.fn(),
        tokenPrice: 1,
        setTransactionHash: jest.fn(),
        attachment: { message: undefined, attachmentUrl: undefined },
        selectedRoute: undefined,
        setSelectedRoute: jest.fn(),
        hasFetchedRoute: false,
        setHasFetchedRoute: jest.fn(),
        recipientType,
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

// ---------- tests ----------

describe('cross-chain claim quote is sized in the link token units', () => {
    it('guards the fixture: the catalog gives Arbitrum USDC 6 and BNB Chain USDC 18', () => {
        expect(arbUsdc.decimals).toBe(6)
        expect(bscUsdc.decimals).toBe(18)
    })

    it('Arbitrum USDC (6) claimed to BNB Chain USDC (18) quotes 10 USDC, not 10^-11', async () => {
        renderFlow({
            link: linkOf(arbUsdc, 10),
            destination: bscUsdc,
            recipient: EXTERNAL_RECIPIENT,
            autoQuote: true,
        })

        await waitFor(() => expect(mockPreviewSdaTransfer).toHaveBeenCalledTimes(1))
        expect(mockPreviewSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                chainIn: 'ARBITRUM',
                chainOut: 'BINANCE',
                token: 'USDC',
                amount: '10',
                mode: 'pay',
                recipient: EXTERNAL_RECIPIENT,
            })
        )
    })

    it('BNB Chain USDC (18) claimed to Arbitrum USDC (6) quotes 10 USDC, not 10^13', async () => {
        renderFlow({
            link: linkOf(bscUsdc, 10),
            destination: arbUsdc,
            recipient: EXTERNAL_RECIPIENT,
            autoQuote: true,
        })

        await waitFor(() => expect(mockPreviewSdaTransfer).toHaveBeenCalledTimes(1))
        expect(mockPreviewSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({ chainIn: 'BINANCE', chainOut: 'ARBITRUM', token: 'USDC', amount: '10' })
        )
    })

    // BNB Chain is not a Bridge off-ramp chain, so a bank claim routes through
    // an explicit USDC-on-Optimism quote. The selector still holds an unrelated
    // 6-decimal token — the quote must ignore it.
    it('a BNB Chain USDC bank claim quotes the explicit Optimism route in source units', async () => {
        const { result } = renderFlow({
            link: linkOf(bscUsdc, 25),
            destination: arbUsdc,
            recipient: 'DE89370400440532013000',
            recipientType: 'iban',
            autoQuote: false,
        })

        await act(async () => {
            result.current.handleClaimAction()
        })

        await waitFor(() => expect(mockPreviewSdaTransfer).toHaveBeenCalledTimes(1))
        expect(mockPreviewSdaTransfer).toHaveBeenCalledWith(
            expect.objectContaining({
                chainIn: 'BINANCE',
                chainOut: 'OPTIMISM',
                token: 'USDC',
                amount: '25',
                // an IBAN cannot hold the quote; the sender's EVM address prices it
                recipient: SENDER,
            })
        )
    })
})
