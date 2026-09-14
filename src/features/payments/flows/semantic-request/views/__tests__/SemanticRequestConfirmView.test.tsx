import React from 'react'
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    useSearchParams: () => ({ get: () => null }),
}))
jest.mock('@/components/Global/NavHeader', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Loading', () => ({ __esModule: true, default: () => <div data-testid="loading" /> }))
jest.mock('@/components/Global/DisplayIcon', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutActionDetailsCard', () => ({ __esModule: true, default: () => null }))
jest.mock('@/features/payments/shared/components/SendWithPeanutCta', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/0_Bruddle/Button', () => ({
    Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))
jest.mock('@/hooks/useTokenChainIcons', () => ({
    useTokenChainIcons: () => ({ resolvedChainName: 'Base', resolvedTokenSymbol: 'USDC' }),
}))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
    PEANUT_WALLET_TOKEN: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    PEANUT_WALLET_TOKEN_SYMBOL: 'USDC',
}))

const flow = {
    amount: '10',
    usdAmount: '10',
    recipient: { recipientType: 'USERNAME', identifier: 'alice' },
    charge: { chainId: '8453', tokenAddress: '0xusdc', tokenSymbol: 'USDC', tokenDecimals: 6, tokenAmount: '10' },
    attachment: null,
    error: { showError: false, errorMessage: '' },
    calculatedReceiveAmount: '10',
    calculatedGasCost: 0,
    calculatedFeeUsd: 0,
    isCalculatingRoute: false,
    isFeeEstimationError: false,
    routeError: null,
    isXChain: true,
    isDiffToken: false,
    isLoading: false,
    isFetchingCharge: false,
    selectedChainID: '8453',
    selectedTokenData: { symbol: 'USDC' },
    urlToken: null,
    isTokenDenominated: false,
    goBackToInitial: jest.fn(),
    executePayment: jest.fn(),
    prepareRoute: jest.fn(),
}
jest.mock('../../useSemanticRequestFlow', () => ({ useSemanticRequestFlow: () => flow }))

import { SemanticRequestConfirmView } from '../SemanticRequestConfirmView'

describe('SemanticRequestConfirmView — network fee row', () => {
    it('cross-chain with a zero account quote shows the sponsored label', () => {
        renderWithIntl(<SemanticRequestConfirmView />)
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })

    it('same-chain strikes through the paymaster-covered gas', () => {
        Object.assign(flow, { isXChain: false, calculatedGasCost: 0.05, calculatedFeeUsd: undefined })
        renderWithIntl(<SemanticRequestConfirmView />)
        expect(screen.getByText('$ 0.05')).toHaveClass('line-through')
        expect(screen.getByText('Sponsored by Peanut!')).toBeInTheDocument()
    })
})
