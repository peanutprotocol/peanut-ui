import { getSupportedTokens } from '@/constants/rhino.consts'

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
