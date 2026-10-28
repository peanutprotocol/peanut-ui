/**
 * The token context fetches the selected token's price only while a flow that
 * reads it is mounted (TASK-23850). Claim and request payment read it; withdraw
 * no longer does, so a token pick there must not ask /tokens/price.
 */
import React, { useContext, useState } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TokenContextProvider, tokenSelectorContext } from '@/context/tokenSelector.context'
import { useReadsSelectedTokenPrice } from '@/hooks/useReadsSelectedTokenPrice'
import { fetchTokenPrice } from '@/services/tokens-price'

jest.mock('@/services/tokens-price', () => ({ fetchTokenPrice: jest.fn() }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ isConnected: true }) }))

const NATIVE = '0x0000000000000000000000000000000000000000'
jest.mock('@/hooks/useSupportedChainsAndTokens', () => ({
    useSupportedChainsAndTokens: () => ({
        isPending: false,
        data: {
            '8453': {
                chainId: '8453',
                networkName: 'Base',
                chainIconURI: '',
                tokens: [
                    {
                        chainId: '8453',
                        address: '0x0000000000000000000000000000000000000000',
                        symbol: 'ETH',
                        name: 'Ether',
                        decimals: 18,
                        logoURI: '',
                    },
                ],
            },
        },
    }),
}))

const mockFetchTokenPrice = fetchTokenPrice as jest.MockedFunction<typeof fetchTokenPrice>

/** Picks ETH on Base, the way the withdraw token picker does, and shows the price it sees. */
function Picker() {
    const { setSelectedChainID, setSelectedTokenAddress, selectedTokenData } = useContext(tokenSelectorContext)
    return (
        <>
            <button
                onClick={() => {
                    setSelectedChainID('8453')
                    setSelectedTokenAddress(NATIVE)
                }}
            >
                pick ETH on Base
            </button>
            <output data-testid="price">{selectedTokenData?.price ?? 'none'}</output>
        </>
    )
}

/** A flow that reads the price: claim and request payment call this hook. */
function Reader() {
    useReadsSelectedTokenPrice()
    return null
}

function Harness({ withReader }: { withReader: boolean }) {
    const [reading, setReading] = useState(withReader)
    return (
        <TokenContextProvider>
            <Picker />
            {reading && <Reader />}
            <button onClick={() => setReading(false)}>leave the flow</button>
        </TokenContextProvider>
    )
}

const renderHarness = (withReader: boolean) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(
        <QueryClientProvider client={client}>
            <Harness withReader={withReader} />
        </QueryClientProvider>
    )
    return client
}

const flush = () => act(async () => {})

describe('token context price fetch', () => {
    beforeEach(() => {
        mockFetchTokenPrice.mockReset()
        mockFetchTokenPrice.mockResolvedValue({
            chainId: '8453',
            address: NATIVE,
            symbol: 'ETH',
            name: 'Ether',
            decimals: 18,
            logoURI: '',
            price: 2500,
        })
    })

    it('makes no /tokens/price request for a pick in a flow that does not read the price', async () => {
        const client = renderHarness(false)
        fireEvent.click(screen.getByText('pick ETH on Base'))
        await flush()

        expect(mockFetchTokenPrice).not.toHaveBeenCalled()
        expect(screen.getByTestId('price')).toHaveTextContent('none')
        client.clear()
    })

    it('fetches the price while a flow that reads it is mounted', async () => {
        const client = renderHarness(true)
        fireEvent.click(screen.getByText('pick ETH on Base'))

        await waitFor(() => expect(screen.getByTestId('price')).toHaveTextContent('2500'))
        expect(mockFetchTokenPrice).toHaveBeenCalledWith(NATIVE, '8453')
        client.clear()
    })

    it('stops fetching once the reading flow unmounts', async () => {
        const client = renderHarness(true)
        await flush()
        fireEvent.click(screen.getByText('leave the flow'))
        fireEvent.click(screen.getByText('pick ETH on Base'))
        await flush()

        expect(mockFetchTokenPrice).not.toHaveBeenCalled()
        client.clear()
    })
})
