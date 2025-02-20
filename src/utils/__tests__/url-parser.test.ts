import { parsePaymentURL } from '@/lib/url-parser/parser'

// mock the chain resolver
jest.mock('@/lib/validation/resolvers/chain-resolver', () => ({
    resolveChainId: (chainIdentifier: string | number): string => {
        const chainMap: { [key: string]: string } = {
            eth: '1',
            arbitrum: '42161',
            optimism: '10',
            '42161': '42161',
            '1': '1',
            '10': '10',
        }

        if (!chainMap[chainIdentifier.toString()]) {
            throw new Error(`Invalid chain identifier format: ${chainIdentifier}`)
        }

        return chainMap[chainIdentifier.toString()]
    },
    normalizeChainName: (chainName: string): string => chainName.toLowerCase(),
}))

jest.mock('@/lib/url-parser/constants/tokens', () => ({
    SUPPORTED_TOKENS: {
        USDC: {
            addresses: {
                '1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                '42161': '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
                '10': '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
            },
            isSupported: true,
        },
        ETH: {
            addresses: {
                '1': 'native',
                '42161': 'native',
                '10': 'native',
            },
            isSupported: true,
        },
        XYZ: {
            isSupported: false,
        },
    },
}))

describe('Payment URL Parser', () => {
    describe('Basic Address Parsing', () => {
        it('should parse simple ethereum address', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
            })
        })

        it('should parse address with amount and token', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57', '0.1USDC'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                amount: '0.1',
                token: 'USDC',
            })
        })
    })

    describe('ERC-7828 Chain-Specific Addresses', () => {
        it('should parse address@chain format with chain ID', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@42161'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                chain: '42161',
            })
        })

        it('should parse address@chain format with hex chain ID', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@0x1'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                chain: '1',
            })
        })

        it('should parse address@chain format with L1 TLD', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@eth'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                chain: '1', // Ethereum mainnet chain ID
            })
        })

        it('should parse ENS name@chain format', () => {
            const result = parsePaymentURL(['alice.eth@arbitrum'])
            expect(result).toEqual({
                recipient: 'alice.eth',
                recipientType: 'ENS',
                chain: '42161', // arb chain ID
            })
        })

        it('should parse complex ENS with L2 chain', () => {
            const result = parsePaymentURL(['user.rollup1.eth@arbitrum'])
            expect(result).toEqual({
                recipient: 'user.rollup1.eth',
                recipientType: 'ENS',
                chain: '42161',
            })
        })

        it('should parse ENS name starting with 0x', () => {
            const result = parsePaymentURL(['0xdhruv.eth@arbitrum'])
            expect(result).toEqual({
                recipient: '0xdhruv.eth',
                recipientType: 'ENS',
                chain: '42161',
            })
        })
    })

    describe('Amount and Token Parsing', () => {
        it('should parse chain-specific address with amount', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@arbitrum', '0.1USDC'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                chain: '42161',
                amount: '0.1',
                token: 'USDC',
            })
        })

        it('should parse ENS with chain and amount', () => {
            const result = parsePaymentURL(['alice.eth@optimism', '1.5ETH'])
            expect(result).toEqual({
                recipient: 'alice.eth',
                recipientType: 'ENS',
                chain: '10', // optimism chain ID
                amount: '1.5',
                token: 'ETH',
            })
        })
    })

    describe('Error Cases', () => {
        it('should throw error for invalid address format', () => {
            expect(() => parsePaymentURL(['0xxyzzzaaabbbcccc'])).toThrow('Invalid Ethereum address format')
        })

        it('should throw error for invalid chain identifier', () => {
            expect(() => parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@invalidchain'])).toThrow(
                'Invalid chain identifier format: invalidchain'
            )
        })

        it('should throw error for invalid token', () => {
            expect(() => parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57', 'invalid'])).toThrow(
                'Unsupported token: invalid'
            )
        })

        it('should fallback to original chain string for special cases', () => {
            const result = parsePaymentURL(['0x2E930BA4d9DD56622f266eb4F16A08423fc75f57@special.chain'])
            expect(result).toEqual({
                recipient: '0x2E930BA4d9DD56622f266eb4F16A08423fc75f57',
                recipientType: 'ADDRESS',
                chain: 'special.chain',
            })
        })
    })
})
