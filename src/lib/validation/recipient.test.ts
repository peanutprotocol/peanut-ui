import { getRecipientType, validateAndResolveRecipient, verifyPeanutUsername } from '@/lib/validation/recipient'

// Mock the external dependencies
const mockResolveEns = jest.fn((name: string, _chainId?: string) => {
    if (name === 'vitalik.eth') {
        return Promise.resolve('0x1234567890123456789012345678901234567890')
    }
    if (name.endsWith('.testvc.eth')) {
        return Promise.resolve('0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271')
    }
    return Promise.resolve(null)
})
jest.mock('@/app/actions/ens', () => ({
    resolveEns: (name: string, chainId?: string) => mockResolveEns(name, chainId),
}))

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(),
}))

jest.mock('@/constants/general.consts', () => ({
    JUSTANAME_ENS: 'testvc.eth',
    PEANUT_API_URL: process.env.NEXT_PUBLIC_PEANUT_API_URL,
}))

// Synthetic fixtures — no customer data.
const PIX_MERCHANT_PAYLOAD =
    '00020126580014br.gov.bcb.pix0136synthetic-key-0000-0000-0000000000005204000053039865802BR6304ABCD'
const TYPED_SENTENCE = `${'quiero enviar plata a mi hermano que vive en cordoba '.repeat(5)}.`

describe('Recipient Validation', () => {
    describe('getRecipientType', () => {
        it('should identify ENS names', () => {
            expect(getRecipientType('vitalik.eth')).toBe('ENS')
            expect(getRecipientType('user.subdomain.eth')).toBe('ENS')
        })

        it('should identify DNS-backed ENS names', () => {
            expect(getRecipientType('example.com')).toBe('ENS')
            expect(getRecipientType('sub.example.xyz')).toBe('ENS')
        })

        it('should identify Ethereum addresses', () => {
            expect(getRecipientType('0x1234567890123456789012345678901234567890')).toBe('ADDRESS')
        })

        it('should identify usernames', () => {
            expect(getRecipientType('kusharc')).toBe('USERNAME')
        })

        it('should reject an Argentine payment alias before ENS', () => {
            expect(() => getRecipientType('CASA.FUTBOLERA')).toThrow('Argentine payment aliases are not supported')
            expect(() => getRecipientType('CASA.FUTBOLERA', true)).toThrow(
                'Argentine payment aliases are not supported'
            )
        })

        it('should keep ENS precedence for an alias-shaped name that really resolves', () => {
            // Same 6-20 char dotted shape as an alias, but a real namespace.
            expect(getRecipientType('vitalik.eth')).toBe('ENS')
            expect(getRecipientType('example.com')).toBe('ENS')
        })

        it('should reject free text in withdrawal context instead of calling ENS', () => {
            expect(() => getRecipientType('kusharc', true)).toThrow('Enter a wallet address or an ENS name')
            expect(() => getRecipientType('someuser', true)).toThrow('Enter a wallet address or an ENS name')
        })

        it('should reject a dotted string that is no supported ENS name', () => {
            // Too long for the alias shape, so it falls to the ENS message.
            expect(() => getRecipientType('not.a.real.ens.namespace.at.all')).toThrow('Invalid ENS name')
        })

        it('should still identify ENS and addresses correctly when isWithdrawal is true', () => {
            expect(getRecipientType('vitalik.eth', true)).toBe('ENS')
            expect(getRecipientType('0x1234567890123456789012345678901234567890', true)).toBe('ADDRESS')
        })
    })

    describe('validateAndResolveRecipient', () => {
        it('should validate and resolve ENS names', async () => {
            const result = await validateAndResolveRecipient('vitalik.eth')
            expect(result).toEqual({
                identifier: 'vitalik.eth',
                recipientType: 'ENS',
                resolvedAddress: '0x1234567890123456789012345678901234567890',
            })
        })

        it('should throw for unresolvable ENS names', async () => {
            await expect(validateAndResolveRecipient('nonexistent.eth')).rejects.toThrow('ENS name not found')
        })

        it('should validate Ethereum addresses', async () => {
            const address = '0x1234567890123456789012345678901234567890'
            const result = await validateAndResolveRecipient(address)
            expect(result).toEqual({
                identifier: address,
                recipientType: 'ADDRESS',
                resolvedAddress: address,
            })
        })

        it('should throw for invalid addresses', async () => {
            await expect(validateAndResolveRecipient('0xinvalid')).rejects.toThrow('Invalid address')
        })

        it('should throw for invalid Peanut usernames', async () => {
            // Mock failed API response
            const { fetchWithSentry } = require('@/utils/sentry.utils')
            fetchWithSentry.mockResolvedValueOnce({ status: 404 })

            await expect(validateAndResolveRecipient('lmaoo')).rejects.toThrow('Invalid Peanut username')
        })

        it('should reject free text in withdrawal context with no ENS lookup', async () => {
            mockResolveEns.mockClear()
            await expect(validateAndResolveRecipient('kusharc', true)).rejects.toThrow(
                'Enter a wallet address or an ENS name'
            )
            await expect(validateAndResolveRecipient('someuser', true)).rejects.toThrow(
                'Enter a wallet address or an ENS name'
            )
            expect(mockResolveEns).not.toHaveBeenCalled()
        })

        it('should guide an Argentine alias to the QR with no ENS lookup', async () => {
            mockResolveEns.mockClear()
            await expect(validateAndResolveRecipient('CASA.FUTBOLERA', true)).rejects.toMatchObject({
                code: 'ARGENTINE_ALIAS',
            })
            expect(mockResolveEns).not.toHaveBeenCalled()
        })

        it.each([
            ['a pasted PIX merchant payload', PIX_MERCHANT_PAYLOAD],
            ['a typed sentence', TYPED_SENTENCE],
            ['an overlong label', `${'a'.repeat(64)}.eth`],
            ['a malformed name', 'test..eth'],
        ])('should reject %s with no ENS lookup', async (_description, input) => {
            mockResolveEns.mockClear()
            await expect(validateAndResolveRecipient(input, true)).rejects.toThrow()
            expect(mockResolveEns).not.toHaveBeenCalled()
        })

        it('should resolve DNS-backed ENS names', async () => {
            mockResolveEns.mockClear()
            mockResolveEns.mockResolvedValueOnce('0x1234567890123456789012345678901234567890')

            const result = await validateAndResolveRecipient('sub.example.xyz', true)

            expect(mockResolveEns).toHaveBeenCalledWith('sub.example.xyz', undefined)
            expect(result.recipientType).toBe('ENS')
        })

        it('should forward the destination chainId to ENS resolution (ENSIP-11)', async () => {
            mockResolveEns.mockClear()
            await validateAndResolveRecipient('vitalik.eth', true, 'evm', '42161')
            expect(mockResolveEns).toHaveBeenCalledWith('vitalik.eth', '42161')
        })

        it('should resolve without a chainId when none is given (legacy callers)', async () => {
            mockResolveEns.mockClear()
            await validateAndResolveRecipient('vitalik.eth')
            expect(mockResolveEns).toHaveBeenCalledWith('vitalik.eth', undefined)
        })
    })

    describe('verifyPeanutUsername', () => {
        it('should return true for valid usernames', async () => {
            const { fetchWithSentry } = require('@/utils/sentry.utils')
            fetchWithSentry.mockResolvedValueOnce({ status: 200 })

            const result = await verifyPeanutUsername('kusharc')
            expect(result).toBe(true)
        })

        it('should return false for invalid usernames', async () => {
            const { fetchWithSentry } = require('@/utils/sentry.utils')
            fetchWithSentry.mockResolvedValueOnce({ status: 404 })

            const result = await verifyPeanutUsername('invaliduser')
            expect(result).toBe(false)
        })

        it('should handle API errors gracefully', async () => {
            const { fetchWithSentry } = require('@/utils/sentry.utils')
            fetchWithSentry.mockRejectedValueOnce(new Error('API Error'))

            const result = await verifyPeanutUsername('someuser')
            expect(result).toBe(false)
        })
    })
})
