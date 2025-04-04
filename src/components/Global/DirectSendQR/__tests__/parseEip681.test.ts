import { parseEip681 } from '../utils'

describe('parseEip681', () => {
    it('should parse simple ETH payment request', () => {
        const url = 'ethereum:0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359?value=2.014e18'
        const result = parseEip681(url)
        expect(result).toEqual({
            address: '0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359',
            amount: '2.014e18',
            tokenSymbol: 'ETH',
        })
    })

    it('should parse ETH payment request with chain ID', () => {
        const url = 'ethereum:0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359@42?value=1.5e18'
        const result = parseEip681(url)
        expect(result).toEqual({
            address: '0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359',
            chainId: '42',
            amount: '1.5e18',
            tokenSymbol: 'ETH',
        })
    })

    it('should parse ERC-20 token transfer request', () => {
        const url =
            'ethereum:0x89205a3a3b2a69de6dbf7f01ed13b2108b2c43e7/transfer?address=0x8e23ee67d1332ad560396262c48ffbb01f93d052&uint256=1'
        const result = parseEip681(url)
        expect(result).toEqual({
            address: '0x8e23ee67d1332ad560396262c48ffbb01f93d052',
            amount: '1',
            tokenSymbol: '',
        })
    })

    it('should handle invalid EIP-681 URL', () => {
        const url = 'invalid:url'
        const result = parseEip681(url)
        expect(result).toEqual({ address: '' })
    })

    it('should handle URL with pay- prefix', () => {
        const url = 'ethereum:pay-0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359?value=1e18'
        const result = parseEip681(url)
        expect(result).toEqual({
            address: '0xfb6916095ca1df60bb79Ce92ce3ea74c37c5d359',
            amount: '1e18',
            tokenSymbol: 'ETH',
        })
    })
})
