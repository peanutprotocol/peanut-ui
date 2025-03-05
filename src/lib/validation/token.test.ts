import { ChainValidationError } from '@/lib/url-parser/errors'
import { getChainDetails, getTokenAndChainDetails } from '@/lib/validation/token'
import { interfaces } from '@squirrel-labs/peanut-sdk'

const mockSquidChains: Record<string, interfaces.ISquidChain & { tokens: interfaces.ISquidToken[] }> = {
    '1': {
        chainId: '1',
        axelarChainName: 'Ethereum',
        chainType: 'evm',
        chainIconURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/webp128/chains/ethereum.webp',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '1',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2094.96,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/eth.svg',
                active: true,
            },
            {
                symbol: 'USDC',
                address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                chainId: '1',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
                active: true,
            },
        ],
    },
    '10': {
        chainId: '10',
        axelarChainName: 'optimism',
        chainType: 'evm',
        chainIconURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/webp128/chains/optimism.webp',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '10',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2093.52,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/eth.svg',
                active: true,
            },
            {
                symbol: 'USDC',
                address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
                chainId: '10',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
                active: true,
            },
        ],
    },
    '8453': {
        chainId: '8453',
        axelarChainName: 'base',
        chainType: 'evm',
        chainIconURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/chains/base.svg',
        tokens: [
            {
                symbol: 'ETH',
                address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
                chainId: '8453',
                name: 'ETH',
                decimals: 18,
                usdPrice: 2094.96,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/eth.svg',
                active: true,
            },
            {
                symbol: 'USDC',
                address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
                chainId: '8453',
                name: 'USD Coin',
                decimals: 6,
                usdPrice: 1,
                logoURI: 'https://raw.githubusercontent.com/0xsquid/assets/main/images/tokens/usdc.svg',
                active: true,
            },
        ],
    },
}

jest.mock('@/constants', () => ({
    PEANUT_WALLET_CHAIN: {
        id: '1',
        name: 'Ethereum',
    },
    PEANUT_WALLET_TOKEN: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
}))

jest.mock('@/app/actions/squid', () => ({
    getSquidChainsAndTokens: () => Promise.resolve(mockSquidChains),
}))

describe('Token Validation', () => {
    describe('getChainDetails', () => {
        it('should resolve chain by name', () => {
            expect(getChainDetails('ethereum', mockSquidChains)).toEqual(mockSquidChains['1'])
        })

        it('should resolve chain by decimal ID', () => {
            expect(getChainDetails('1', mockSquidChains)).toEqual(mockSquidChains['1'])
            expect(getChainDetails(1, mockSquidChains)).toEqual(mockSquidChains['1'])
        })

        it('should resolve chain by hex ID', () => {
            expect(getChainDetails('0x1', mockSquidChains)).toEqual(mockSquidChains['1'])
        })

        it('should throw for unsupported chains', () => {
            expect(() => getChainDetails('invalid', mockSquidChains)).toThrow(ChainValidationError)
            expect(() => getChainDetails('999', mockSquidChains)).toThrow(ChainValidationError)
        })

        it('should be case insensitive for chain names', () => {
            expect(getChainDetails('ETHEREUM', mockSquidChains)).toEqual(mockSquidChains['1'])
            expect(getChainDetails('EthereUM', mockSquidChains)).toEqual(mockSquidChains['1'])
        })

        it('should resolve optimism chain variants', () => {
            expect(getChainDetails('optimism', mockSquidChains)).toEqual(mockSquidChains['10'])
            expect(getChainDetails('op', mockSquidChains)).toEqual(mockSquidChains['10'])
            expect(getChainDetails('10', mockSquidChains)).toEqual(mockSquidChains['10'])
        })

        it('should resolve base chain variants', () => {
            expect(getChainDetails('base', mockSquidChains)).toEqual(mockSquidChains['8453'])
            expect(getChainDetails('8453', mockSquidChains)).toEqual(mockSquidChains['8453'])
        })
    })

    describe('getTokenAndChainDetails', () => {
        it('should resolve token with specified chain', async () => {
            const result = await getTokenAndChainDetails('ETH', '1')
            expect(result).toEqual({
                chain: mockSquidChains['1'],
                token: mockSquidChains['1'].tokens[0],
            })
        })

        it('should resolve token without chain', async () => {
            const result = await getTokenAndChainDetails('USDC')
            expect(result).toEqual({
                chain: null,
                token: mockSquidChains['1'].tokens[1],
            })
        })

        it('should handle case insensitive token symbols', async () => {
            const result = await getTokenAndChainDetails('eth', '1')
            expect(result).toEqual({
                chain: mockSquidChains['1'],
                token: mockSquidChains['1'].tokens[0],
            })
        })

        it('should return default token when no token specified', async () => {
            const result = await getTokenAndChainDetails('')
            expect(result).toEqual({
                chain: mockSquidChains['1'],
                token: mockSquidChains['1'].tokens[1], // USDC
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
