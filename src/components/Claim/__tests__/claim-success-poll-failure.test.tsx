/**
 * SUCCESS view — what the poller renders when the optimistic claim failed.
 *
 * A Peanut Wallet P2P claim sends `optimisticReturn: true`, so POST /claim
 * answers 202 before it broadcasts and this view is already mounted when the
 * broadcast fails. Nothing in the response can carry the outcome; the only
 * channel is the polled SendLink, and until `claimFailureCode` existed the
 * view stopped its spinner with a sentinel 'FAILED' hash and left the success
 * card on screen — a claim that never happened, rendered as money received.
 */
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { IntlWrapper } from '@/test-utils/intl'

const mockTriggerHaptic = jest.fn()
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockRouterPush, replace: jest.fn(), prefetch: jest.fn(), back: jest.fn() }),
    useSearchParams: () => new URLSearchParams(),
}))

jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: any) => {
        const { priority, fill, unoptimized, ...rest } = props
        return <img {...rest} />
    },
}))

const mockSendLinksApi = { get: jest.fn() }
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
}))

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ fetchUser: jest.fn() }) }))
jest.mock('@/context/ClaimBankFlowContext', () => ({
    useClaimBankFlow: () => ({ offrampDetails: null, claimType: 'claim', bankDetails: null }),
}))
jest.mock('@/redux/hooks', () => ({ useUserStore: () => ({ user: null }) }))
jest.mock('@/hooks/useRecipientDisplay', () => ({
    useRecipientDisplay: () => ({ displayName: 'alice' }),
}))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: mockTriggerHaptic }) }))
jest.mock('@/utils/general.utils', () => ({
    formatTokenAmount: (n: number) => String(n),
    getTokenDetails: () => ({ symbol: 'USDC', decimals: 6 }),
    shortenStringLong: (s: string) => s,
}))
const mockSoundPlayed = jest.fn()
jest.mock('@/components/Global/SoundPlayer', () => ({
    SoundPlayer: (props: any) => {
        mockSoundPlayed(props.sound)
        return null
    },
}))
// ds: PeanutLoading is retired here; the view renders Loading variant="mascot"
jest.mock('@/components/Global/Loading', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="peanut-loading">{props.message}</div>,
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/CreateAccountButton', () => ({
    __esModule: true,
    default: () => <button>create account</button>,
}))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({
    __esModule: true,
    default: (props: any) => <div data-testid="success-card">{props.title}</div>,
}))
jest.mock('@/components/Invites/badge-campaign-context', () => ({
    badgeCampaignForLegacyWire: () => undefined,
}))

import { SuccessClaimLinkView } from '../Link/Onchain/Success.view'

const claimLinkData = {
    link: 'https://peanut.to/claim#?c=42161&v=v4.3&i=7&p=secret',
    pubKey: '0xpub',
    chainId: '42161',
    amount: 5_000_000n,
    tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenDecimals: 6,
    tokenSymbol: 'USDC',
    senderAddress: '0xsender',
    sender: null,
} as any

const renderView = (onCustom = jest.fn(), initialHash?: string) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

    // the real parent owns `transactionHash`, so the poll's setter has to
    // rebind the prop — a jest.fn() here would leave the view stuck pending
    const Harness = () => {
        const [transactionHash, setTransactionHash] = React.useState<string | undefined>(initialHash)
        return (
            <SuccessClaimLinkView
                {...({
                    transactionHash,
                    setTransactionHash,
                    claimLinkData,
                    tokenPrice: 1,
                    onCustom,
                } as any)}
            />
        )
    }

    render(
        <IntlWrapper>
            <QueryClientProvider client={client}>
                <Harness />
            </QueryClientProvider>
        </IntlWrapper>
    )
    return { onCustom }
}

describe('SUCCESS view — polled claim failure', () => {
    beforeEach(() => {
        mockSendLinksApi.get.mockReset()
        mockRouterPush.mockReset()
        mockSoundPlayed.mockReset()
        mockTriggerHaptic.mockReset()
    })

    test('a retryable failure replaces the success card with the retry copy and a way back', async () => {
        mockSendLinksApi.get.mockResolvedValue({
            status: 'FAILED',
            claimFailureCode: 'CHAIN_INFRA_UNAVAILABLE',
            events: [],
        })

        const { onCustom } = renderView()

        expect(await screen.findByText(/network is busy/i)).toBeInTheDocument()
        // the money-received card must be gone — nothing was claimed
        expect(screen.queryByTestId('success-card')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /try again/i }))
        expect(onCustom).toHaveBeenCalledWith('INITIAL')
    })

    test('a failure with no code gets the generic copy and no retry button', async () => {
        mockSendLinksApi.get.mockResolvedValue({ status: 'FAILED', claimFailureCode: null, events: [] })

        renderView()

        expect(await screen.findByText(/contact support/i)).toBeInTheDocument()
        expect(screen.queryByTestId('success-card')).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
    })

    test('a confirmed claim still renders the success card', async () => {
        mockSendLinksApi.get.mockResolvedValue({
            status: 'CLAIMED',
            claim: { txHash: '0xabc' },
            events: [],
        })

        renderView()

        await waitFor(() => expect(screen.getByTestId('success-card')).toBeInTheDocument())
        expect(screen.queryByText(/network is busy/i)).not.toBeInTheDocument()
    })

    test('a CLAIMED status with no projected hash still renders the success card', async () => {
        // matches the backend's notify point: CLAIMED means the money moved, so
        // the view must not sit on "processing" waiting the txHash out
        mockSendLinksApi.get.mockResolvedValue({
            status: 'CLAIMED',
            events: [],
        })

        renderView()

        await waitFor(() => expect(screen.getByTestId('success-card')).toBeInTheDocument())
        expect(screen.queryByText(/network is busy/i)).not.toBeInTheDocument()
    })
})

describe('SUCCESS view — before the poll resolves', () => {
    beforeEach(() => {
        mockSendLinksApi.get.mockReset()
        mockSoundPlayed.mockReset()
        mockTriggerHaptic.mockReset()
    })

    test('a claim with no outcome yet shows processing — no success card, sound or haptic', async () => {
        // a poll that never settles: the optimistic 202 has landed, nothing else
        mockSendLinksApi.get.mockReturnValue(new Promise(() => {}))

        renderView()

        expect(await screen.findByTestId('peanut-loading')).toBeInTheDocument()
        expect(screen.queryByTestId('success-card')).not.toBeInTheDocument()
        expect(mockSoundPlayed).not.toHaveBeenCalled()
        expect(mockTriggerHaptic).not.toHaveBeenCalled()
    })

    test('a poll that keeps erroring stays in processing rather than claiming success', async () => {
        mockSendLinksApi.get.mockRejectedValue(new Error('network down'))

        renderView()

        await waitFor(() => expect(mockSendLinksApi.get).toHaveBeenCalled())
        expect(screen.getByTestId('peanut-loading')).toBeInTheDocument()
        expect(screen.queryByTestId('success-card')).not.toBeInTheDocument()
    })

    test('a synchronous claim arrives with its hash and renders success immediately', () => {
        mockSendLinksApi.get.mockReturnValue(new Promise(() => {}))

        renderView(jest.fn(), '0xabc')

        expect(screen.getByTestId('success-card')).toBeInTheDocument()
        expect(mockSoundPlayed).toHaveBeenCalledWith('success')
        expect(mockTriggerHaptic).toHaveBeenCalled()
    })
})
