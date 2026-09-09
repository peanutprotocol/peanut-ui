/**
 * ConfirmClaimLinkView — cross-chain sub-minimum guard (rendered-view coverage).
 *
 * The external-wallet claim path runs the min guard in handleOnClaim: a
 * sub-minimum cross-chain claim must render the network-minimum refusal and
 * never call claimLinkXchain; an at-or-above claim must call claimLinkXchain
 * WITH the computed USD amount (dropping that argument silently disables the
 * hook-level backstop). Pins both.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import type { IClaimScreenProps } from '../../../Claim.consts'

jest.mock('next/navigation', () => ({
    useSearchParams: () => new URLSearchParams(),
}))

jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableXchainSend: false },
    CROSS_CHAIN_DISABLED_MESSAGE: 'Cross-chain temporarily unavailable',
}))

const mockSetLoadingState = jest.fn()
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        loadingStateContext: ReactActual.createContext({
            loadingState: 'Idle',
            setLoadingState: (s: string) => mockSetLoadingState(s),
            isLoading: false,
        }),
    }
})

// Destination = Ethereum ($5 floor).
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext({
            selectedChainID: '1',
            selectedTokenAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            isXChain: true,
        }),
    }
})

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'u1' } } }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({
    useWallet: () => ({ address: '0x1111111111111111111111111111111111111111' }),
}))

const mockClaimLinkXchain = jest.fn().mockResolvedValue('0xtxhash')
jest.mock('../../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLinkXchain: mockClaimLinkXchain, claimLink: jest.fn() }),
}))

jest.mock('@/hooks/useRecipientDisplay', () => ({ useRecipientDisplay: () => ({ displayName: 'Sender' }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({
        tokenIconUrl: '',
        chainIconUrl: '',
        resolvedChainName: 'Ethereum',
        resolvedTokenSymbol: 'USDC',
    }),
}))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: { associateClaim: jest.fn() } }))

// presentational stubs
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children, onClick, disabled }: any) => (
        <button onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}))
jest.mock('@/components/0_Bruddle/Notification', () => ({ Notification: ({ children }: any) => <div>{children}</div> }))
jest.mock('@/components/0_Bruddle/PageStack', () => {
    const Pass = ({ children }: any) => <div>{children}</div>
    return { PageStack: Object.assign(Pass, { Center: Pass }) }
})
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Global/Card', () => ({
    __esModule: true,
    default: ({ children }: any) => <div>{children}</div>,
}))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => <div /> }))
jest.mock('@/components/Payment/PaymentInfoRow', () => ({ PaymentInfoRow: () => <div /> }))

import { ConfirmClaimLinkView } from '../Confirm.view'

function props(amountBase: bigint): IClaimScreenProps {
    return {
        onNext: jest.fn(),
        onPrev: jest.fn(),
        setClaimType: jest.fn(),
        claimLinkData: {
            amount: amountBase,
            tokenDecimals: 6,
            tokenSymbol: 'USDC',
            chainId: '42161',
            tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            link: 'https://peanut.me/claim#p',
            pubKey: '0xpub',
            status: 'UNCLAIMED',
            createdAt: new Date().toISOString(),
            senderAddress: '0x2222222222222222222222222222222222222222',
            sender: { username: 'sender' },
        },
        recipient: { name: undefined, address: '0x3333333333333333333333333333333333333333' },
        tokenPrice: 1,
        setTransactionHash: jest.fn(),
        attachment: { message: undefined, attachmentUrl: undefined },
        // a route present → handleOnClaim takes the cross-chain branch
        selectedRoute: { chainId: '1', tokenAddress: '0xeth-usdc', receiveAmount: '2' },
    } as unknown as IClaimScreenProps
}

const renderView = (amountBase: bigint) =>
    render(
        <IntlWrapper>
            <ConfirmClaimLinkView {...props(amountBase)} />
        </IntlWrapper>
    )

beforeEach(() => jest.clearAllMocks())

describe('ConfirmClaimLinkView cross-chain minimum guard', () => {
    it('blocks a sub-minimum claim: shows the network-minimum copy and never calls claimLinkXchain', async () => {
        renderView(BigInt(2_000_000)) // $2, below Ethereum's $5

        fireEvent.click(screen.getByRole('button', { name: /receive|now/i }))

        await waitFor(() => expect(screen.getByText(/at least \$5/i)).toBeInTheDocument())
        expect(mockClaimLinkXchain).not.toHaveBeenCalled()
        expect(mockSetLoadingState).toHaveBeenLastCalledWith('Idle')
    })

    it('at or above the minimum calls claimLinkXchain with the computed USD amount', async () => {
        renderView(BigInt(10_000_000)) // $10, above $5

        fireEvent.click(screen.getByRole('button', { name: /receive|now/i }))

        await waitFor(() => expect(mockClaimLinkXchain).toHaveBeenCalledTimes(1))
        expect(mockClaimLinkXchain).toHaveBeenCalledWith(expect.objectContaining({ amountUsd: 10 }))
    })
})
