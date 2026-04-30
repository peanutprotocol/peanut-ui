import { ChainValidationError } from '@/lib/url-parser/errors'
import { getChainDetails, getTokenAndChainDetails } from '@/lib/validation/token'
import type { ChainMeta, TokenMeta } from '@/interfaces/chain-meta'

const mockChainsAndTokens: Record<string, ChainMeta & { networkName: string; tokens: TokenMeta[] }> = {
    '1': {
        chainId: '1',
        networkName: 'Ethereum',
        chainIconURI: 'https://example.test/chains/ethereum.webp',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '1',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2094.96,
                logoURI: 'https://example.test/tokens/eth.svg',
            },
            {
                symbol: 'USDC',
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                chainId: '1',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://example.test/tokens/usdc.svg',
            },
        ],
    },
    '10': {
        chainId: '10',
        networkName: 'optimism',
        chainIconURI: 'https://example.test/chains/optimism.webp',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '10',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2093.52,
                logoURI: 'https://example.test/tokens/eth.svg',
            },
            {
                symbol: 'USDC',
                address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                chainId: '10',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://example.test/tokens/usdc.svg',
            },
        ],
    },
    '8453': {
        chainId: '8453',
        networkName: 'base',
        chainIconURI: 'https://example.test/chains/base.svg',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '8453',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2094.96,
                logoURI: 'https://example.test/tokens/eth.svg',
            },
            {
                symbol: 'USDC',
                address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                chainId: '8453',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://example.test/tokens/usdc.svg',
            },
        ],
    },
}

jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: {
        id: '1',
        name: 'Ethereum',
    },
    PEANUT_WALLET_TOKEN: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}))

jest.mock('@/app/actions/supported-chains', () => ({
    getSupportedChainsAndTokens: () => Promise.resolve(mockChainsAndTokens),
}))

describe('Token Validation', () => {
    describe('getChainDetails', () => {
        it('should resolve chain by name', () => {
            expect(getChainDetails('ethereum', mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
        })

        it('should resolve chain by decimal ID', () => {
            expect(getChainDetails('1', mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
            expect(getChainDetails(1, mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
        })

        it('should resolve chain by hex ID', () => {
            expect(getChainDetails('0x1', mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
        })

        it('should throw for unsupported chains', () => {
            expect(() => getChainDetails('invalid', mockChainsAndTokens)).toThrow(ChainValidationError)
            expect(() => getChainDetails('999', mockChainsAndTokens)).toThrow(ChainValidationError)
        })

        it('should be case insensitive for chain names', () => {
            expect(getChainDetails('ETHEREUM', mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
            expect(getChainDetails('EthereUM', mockChainsAndTokens)).toEqual(mockChainsAndTokens['1'])
        })

        it('should resolve optimism chain variants', () => {
            expect(getChainDetails('optimism', mockChainsAndTokens)).toEqual(mockChainsAndTokens['10'])
            expect(getChainDetails('op', mockChainsAndTokens)).toEqual(mockChainsAndTokens['10'])
            expect(getChainDetails('10', mockChainsAndTokens)).toEqual(mockChainsAndTokens['10'])
        })

        it('should resolve base chain variants', () => {
            expect(getChainDetails('base', mockChainsAndTokens)).toEqual(mockChainsAndTokens['8453'])
            expect(getChainDetails('8453', mockChainsAndTokens)).toEqual(mockChainsAndTokens['8453'])
        })
    })

    describe('getTokenAndChainDetails', () => {
        it('should resolve token with specified chain', async () => {
            const result = await getTokenAndChainDetails('ETH', '1')
            expect(result).toEqual({
                chain: mockChainsAndTokens['1'],
                token: mockChainsAndTokens['1'].tokens[0],
            })
        })

        it('should resolve token without chain', async () => {
            const result = await getTokenAndChainDetails('USDC')
            expect(result).toEqual({
                chain: null,
                token: mockChainsAndTokens['1'].tokens[1],
            })
        })

        it('should handle case insensitive token symbols', async () => {
            const result = await getTokenAndChainDetails('eth', '1')
            expect(result).toEqual({
                chain: mockChainsAndTokens['1'],
                token: mockChainsAndTokens['1'].tokens[0],
            })
        })

        it('should return default token when no token specified', async () => {
            const result = await getTokenAndChainDetails('')
            expect(result).toEqual({
                chain: mockChainsAndTokens['1'],
                token: mockChainsAndTokens['1'].tokens[1], // USDC
            })
        })

        it('should resolve USDC on different chains', async () => {
            const ethResult = await getTokenAndChainDetails('USDC', '1')
            expect(ethResult.token?.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')

            const opResult = await getTokenAndChainDetails('USDC', '10')
            expect(opResult.token?.address).toBe('0x7F5c764cBc14f9669B88837ca1490cCa17c31607')

            const baseResult = await getTokenAndChainDetails('USDC', '8453')
            expect(baseResult.token?.address).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913')
        })

        it('should resolve ETH on different chains', async () => {
            const chains = ['1', '10', '8453']
            for (const chainId of chains) {
                const result = await getTokenAndChainDetails('ETH', chainId)
                expect(result.token?.symbol).toBe('ETH')
                expect(result.token?.chainId).toBe(chainId)
            }
        })
    })
})
