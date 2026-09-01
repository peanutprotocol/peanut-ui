import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => null }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))
jest.mock('@/context/loadingStates.context', () => {
    const ReactActual = jest.requireActual('react')
    return { loadingStateContext: ReactActual.createContext({ setLoadingState: jest.fn(), isLoading: false }) }
})
jest.mock('@/context/tokenSelector.context', () => {
    const ReactActual = jest.requireActual('react')
    return {
        tokenSelectorContext: ReactActual.createContext({
            selectedChainID: '8453',
            selectedTokenAddress: '0xusdc',
            isXChain: true,
        }),
    }
})
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Base', resolvedTokenSymbol: 'USDC' }),
}))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ address: '0x2222' }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('../../../useClaimLink', () => ({
    __esModule: true,
    default: () => ({ claimLinkXchain: jest.fn(), claimLink: jest.fn() }),
}))
jest.mock('@/hooks/useRecipientDisplay', () => ({ useRecipientDisplay: () => ({ displayName: 'bob' }) }))
jest.mock('@/hooks/useFriendlyError', () => ({ useFriendlyError: () => (e: unknown) => String(e) }))
jest.mock('@/services/sendLinks', () => ({ sendLinksApi: { associateClaim: jest.fn() } }))
jest.mock('@/constants/analytics.consts', () => ({ ANALYTICS_EVENTS: {} }))
jest.mock('@/config/underMaintenance.config', () => ({
    __esModule: true,
    default: { disableXchainSend: false },
    CROSS_CHAIN_DISABLED_MESSAGE: '',
}))
jest.mock('@/components/Invites/badge-campaign-context', () => ({ badgeCampaignForLegacyWire: () => null }))
jest.mock('../../../Claim.consts', () => ({}))

import { ConfirmClaimLinkView } from '../Confirm.view'

const props = {
    onNext: jest.fn(),
    onPrev: jest.fn(),
    setClaimType: jest.fn(),
    claimLinkData: {
        amount: 10_000_000n,
        tokenDecimals: 6,
        tokenSymbol: 'USDC',
        chainId: '42161',
        link: 'https://peanut.test/claim',
        senderAddress: '0x9999',
        sender: null,
    },
    recipient: { address: '0x2222', name: '' },
    tokenPrice: 1,
    setTransactionHash: jest.fn(),
    attachment: { message: '', attachmentUrl: '' },
} as unknown as React.ComponentProps<typeof ConfirmClaimLinkView>

describe('ConfirmClaimLinkView — max network fee row', () => {
    it('shows the sponsored label for a zero-fee cross-chain route', () => {
        renderWithIntl(
            <ConfirmClaimLinkView
                {...props}
                selectedRoute={{ chainId: '8453', tokenAddress: '0xusdc', receiveAmount: '10', feeUsd: 0 }}
            />
        )
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('shows a quoted route fee verbatim', () => {
        renderWithIntl(
            <ConfirmClaimLinkView
                {...props}
                selectedRoute={{ chainId: '8453', tokenAddress: '0xusdc', receiveAmount: '9.5', feeUsd: 0.5 }}
            />
        )
        expect(screen.getByText('$0.50')).toBeInTheDocument()
    })
})
