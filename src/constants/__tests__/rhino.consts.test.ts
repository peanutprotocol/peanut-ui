import { CHAIN_SCOPED_DEPOSIT_TOKENS, getSupportedTokens } from '@/constants/rhino.consts'

describe('CHAIN_SCOPED_DEPOSIT_TOKENS', () => {
    test('pairs each token with the one chain a real deposit proved', () => {
        expect(CHAIN_SCOPED_DEPOSIT_TOKENS.map((token) => [token.name, token.network])).toEqual([
            ['EURe v2', 'Gnosis'],
            ['EURC', 'Base'],
            ['USDS', 'Base'],
            ['USDe', 'Arbitrum'],
            ['PYUSD', 'Arbitrum'],
        ])
    })

    test('flags only the euro stablecoins, which convert at the market rate', () => {
        expect(CHAIN_SCOPED_DEPOSIT_TOKENS.filter((token) => token.isEuro).map((token) => token.name)).toEqual([
            'EURe v2',
            'EURC',
        ])
    })

    test('every token has a logo', () => {
        for (const token of CHAIN_SCOPED_DEPOSIT_TOKENS) {
            expect(token.logoUrl).toMatch(/^https:\/\//)
        }
    })
})

// A token advertised on a network Rhino's SDA doesn't accept means silent,
// permanent loss for the user (no webhook fires). These lists must mirror
// Rhino's live `depositAddresses.getSupportedConfigs()` response.
describe('getSupportedTokens', () => {
    const names = (network: 'EVM' | 'SOL' | 'TRON') => getSupportedTokens(network).map((t) => t.name)

    test('offers ETH on EVM networks only', () => {
        expect(names('EVM')).toEqual(['USDT', 'USDC', 'ETH'])
        expect(names('SOL')).not.toContain('ETH')
        expect(names('TRON')).not.toContain('ETH')
    })

    test('keeps Solana to stablecoins and Tron to USDT only', () => {
        expect(names('SOL')).toEqual(['USDT', 'USDC'])
        expect(names('TRON')).toEqual(['USDT'])
    })

    test('every advertised token has a logo', () => {
        for (const network of ['EVM', 'SOL', 'TRON'] as const) {
            for (const token of getSupportedTokens(network)) {
                expect(token.logoUrl).toMatch(/^https:\/\//)
            }
        }
    })
})
