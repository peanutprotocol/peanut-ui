import { getRecipientType, validateAndResolveRecipient, verifyPeanutUsername } from '@/lib/validation/recipient'

// Mock the external dependencies
jest.mock('@/app/actions/ens', () => ({
    resolveEns: (name: string) => {
        if (name === 'vitalik.eth') {
            return Promise.resolve('0x1234567890123456789012345678901234567890')
        }
        if (name.endsWith('.testvc.eth')) {
            return Promise.resolve('0xA4Ae9480de19bD99A55E0FdC5372B8A4151C8271')
        }
        return Promise.resolve(null)
    },
}))

jest.mock('@/utils', () => ({
    fetchWithSentry: jest.fn(),
}))

jest.mock('@/constants', () => ({
    JUSTANAME_ENS: 'testvc.eth',
    PEANUT_API_URL: process.env.NEXT_PUBLIC_PEANUT_API_URL,
}))

describe('Recipient Validation', () => {
    describe('getRecipientType', () => {
        it('should identify ENS names', () => {
            expect(getRecipientType('vitalik.eth')).toBe('ENS')
            expect(getRecipientType('user.subdomain.eth')).toBe('ENS')
        })

        it('should identify Ethereum addresses', () => {
            expect(getRecipientType('0x1234567890123456789012345678901234567890')).toBe('ADDRESS')
        })

        it('should identify usernames', () => {
            expect(getRecipientType('kusharc')).toBe('USERNAME')
        })

        it('should treat non-addresses as ENS when isWithdrawal is true', () => {
            expect(getRecipientType('kusharc', true)).toBe('ENS')
            expect(getRecipientType('someuser', true)).toBe('ENS')
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
            const fetchWithSentry = require('@/utils').fetchWithSentry
            fetchWithSentry.mockResolvedValueOnce({ status: 404 })

            await expect(validateAndResolveRecipient('lmaoo')).rejects.toThrow('Invalid Peanut username')
        })

        it('should treat non-addresses as ENS in withdrawal context', async () => {
            await expect(validateAndResolveRecipient('kusharc', true)).rejects.toThrow('ENS name not found')
            await expect(validateAndResolveRecipient('someuser', true)).rejects.toThrow('ENS name not found')
        })
    })

    describe('verifyPeanutUsername', () => {
        it('should return true for valid usernames', async () => {
            const fetchWithSentry = require('@/utils').fetchWithSentry
            fetchWithSentry.mockResolvedValueOnce({ status: 200 })

            const result = await verifyPeanutUsername('kusharc')
            expect(result).toBe(true)
        })

        it('should return false for invalid usernames', async () => {
            const fetchWithSentry = require('@/utils').fetchWithSentry
            fetchWithSentry.mockResolvedValueOnce({ status: 404 })

            const result = await verifyPeanutUsername('invaliduser')
            expect(result).toBe(false)
        })

        it('should handle API errors gracefully', async () => {
            const fetchWithSentry = require('@/utils').fetchWithSentry
            fetchWithSentry.mockRejectedValueOnce(new Error('API Error'))

            const result = await verifyPeanutUsername('someuser')
            expect(result).toBe(false)
        })
    })
})
