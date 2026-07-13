import { addressFamilyForChainId, isValidAddressForFamily } from '../addressFamily'

// Real addresses: canonical USDC mint (Solana), canonical USDT contract (Tron)
const SOLANA_ADDR = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const TRON_ADDR = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
// lowercase — viem isAddress is checksum-strict on mixed-case input
const EVM_ADDR = '0xb44401be236a81fcf8437ea917035e0934fda196'

describe('addressFamilyForChainId', () => {
    it('maps non-EVM slugs to their family', () => {
        expect(addressFamilyForChainId('solana')).toBe('solana')
        expect(addressFamilyForChainId('tron')).toBe('tron')
        expect(addressFamilyForChainId('SOLANA')).toBe('solana')
    })

    it('maps EVM numeric ids (and null/undefined) to evm', () => {
        expect(addressFamilyForChainId('42161')).toBe('evm')
        expect(addressFamilyForChainId(43114)).toBe('evm')
        expect(addressFamilyForChainId(null)).toBe('evm')
        expect(addressFamilyForChainId(undefined)).toBe('evm')
    })
})

describe('isValidAddressForFamily', () => {
    it('validates real addresses in their own family', () => {
        expect(isValidAddressForFamily(SOLANA_ADDR, 'solana')).toBe(true)
        expect(isValidAddressForFamily(TRON_ADDR, 'tron')).toBe(true)
        expect(isValidAddressForFamily(EVM_ADDR, 'evm')).toBe(true)
    })

    it('rejects cross-family inputs', () => {
        expect(isValidAddressForFamily(EVM_ADDR, 'solana')).toBe(false)
        expect(isValidAddressForFamily(EVM_ADDR, 'tron')).toBe(false)
        expect(isValidAddressForFamily(SOLANA_ADDR, 'evm')).toBe(false)
        expect(isValidAddressForFamily(SOLANA_ADDR, 'tron')).toBe(false)
        // NOTE: a Tron address IS valid base58 in Solana's length range — the
        // family always comes from the selected chain, never string-sniffed.
        expect(isValidAddressForFamily(TRON_ADDR, 'evm')).toBe(false)
    })

    it('rejects malformed base58 (0, O, I, l are not in the alphabet)', () => {
        expect(isValidAddressForFamily('0PjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'solana')).toBe(false)
        expect(isValidAddressForFamily('TOOOOqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', 'tron')).toBe(false)
        expect(isValidAddressForFamily('', 'solana')).toBe(false)
        expect(isValidAddressForFamily('short', 'solana')).toBe(false)
    })

    it('rejects tron addresses without the T prefix / wrong length', () => {
        expect(isValidAddressForFamily(TRON_ADDR.slice(1), 'tron')).toBe(false)
        expect(isValidAddressForFamily(TRON_ADDR + 'a', 'tron')).toBe(false)
    })
})
