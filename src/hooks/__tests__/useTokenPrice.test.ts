/**
 * The price hook asks the API for any token on an EVM chain (TASK-23850).
 * It used to skip every chain outside a hand-kept Mobula list, so a chain
 * that list missed (Linea, HyperEVM) never got a price even when the API had one.
 * Non-numeric ids are the synthetic Solana and Tron records: they carry
 * stablecoins only, which the hook prices at $1 without a call.
 */
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTokenPrice } from '@/hooks/useTokenPrice'
import { fetchTokenPrice } from '@/services/tokens-price'
import type { ChainWithTokens } from '@/interfaces/chain-meta'

jest.mock('@/services/tokens-price', () => ({ fetchTokenPrice: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const mockFetchTokenPrice = fetchTokenPrice as jest.MockedFunction<typeof fetchTokenPrice>

const NATIVE = '0x0000000000000000000000000000000000000000'
const SOLANA_WRAPPED_SOL = 'So11111111111111111111111111111111111111112'

const chains: Record<string, ChainWithTokens> = {
    '59144': {
        chainId: '59144',
        networkName: 'Linea',
        chainIconURI: '',
        tokens: [{ chainId: '59144', address: NATIVE, symbol: 'ETH', name: 'Ether', decimals: 18, logoURI: '' }],
    },
    solana: {
        chainId: 'solana',
        networkName: 'Solana',
        chainIconURI: '',
        tokens: [
            {
                chainId: 'solana',
                address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                symbol: 'USDC',
                name: 'USD Coin',
                decimals: 6,
                logoURI: '',
            },
        ],
    },
}

const renderPrice = (tokenAddress: string, chainId: string) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    const hook = renderHook(
        () => useTokenPrice({ tokenAddress, chainId, supportedChainsAndTokens: chains, isPeanutWallet: true }),
        { wrapper }
    )
    return { ...hook, client }
}

describe('useTokenPrice chain guard', () => {
    beforeEach(() => mockFetchTokenPrice.mockReset())

    it('asks the API for a token on an EVM chain the old Mobula list did not have', async () => {
        mockFetchTokenPrice.mockResolvedValue({
            chainId: '59144',
            address: NATIVE,
            symbol: 'ETH',
            name: 'Ether',
            decimals: 18,
            logoURI: '',
            price: 2500,
        })
        const { result, client } = renderPrice(NATIVE, '59144')

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(mockFetchTokenPrice).toHaveBeenCalledWith(NATIVE, '59144')
        expect(result.current.data?.price).toBe(2500)
        client.clear()
    })

    it('never asks the API for a non-EVM chain id', async () => {
        const { result, client } = renderPrice(SOLANA_WRAPPED_SOL, 'solana')

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toBeNull()
        expect(mockFetchTokenPrice).not.toHaveBeenCalled()
        client.clear()
    })

    it('still prices a stablecoin on a non-EVM chain at $1 with no call', async () => {
        const { result, client } = renderPrice('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana')

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        expect(result.current.data).toEqual(expect.objectContaining({ symbol: 'USDC', price: 1 }))
        expect(mockFetchTokenPrice).not.toHaveBeenCalled()
        client.clear()
    })
})
