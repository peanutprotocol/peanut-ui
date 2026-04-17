// integration test: all action functions that make POST requests include Content-Type header

import { fetchWithSentry } from '@/utils/sentry.utils'

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(() =>
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
            clone: () => ({ json: () => Promise.resolve({}), text: () => Promise.resolve('') }),
        })
    ),
}))

jest.mock('@/utils/auth-token', () => ({
    getAuthHeaders: jest.fn((extra?: Record<string, string>) => ({
        Authorization: 'Bearer test-token',
        ...extra,
    })),
    getAuthToken: jest.fn(() => 'test-token'),
}))

jest.mock('@/constants/general.consts', () => ({
    PEANUT_API_URL: 'https://api.test.com',
}))

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => false),
}))

// mock getCurrencyPrice for the onramp test
jest.mock('@/app/actions/currency', () => ({
    getCurrencyPrice: jest.fn(() => Promise.resolve({ buy: 1, sell: 1 })),
}))

// mock getCurrencyConfig for the onramp test
jest.mock('@/utils/bridge.utils', () => ({
    getCurrencyConfig: jest.fn(() => ({ currency: 'usd', paymentRail: 'ach_push' })),
}))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

// helper to extract headers from the most recent fetchWithSentry call
function getLastCallHeaders(): Record<string, string> {
    const calls = mockFetchWithSentry.mock.calls
    const lastCall = calls[calls.length - 1]
    return (lastCall[1]?.headers as Record<string, string>) ?? {}
}

describe('action functions Content-Type headers', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('should include Content-Type in validateInviteCode', async () => {
        const { validateInviteCode } = require('@/app/actions/invites')
        await validateInviteCode('TEST-CODE')

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in purchaseCard', async () => {
        const { purchaseCard } = require('@/app/actions/card')
        await purchaseCard()

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in createBridgeExternalAccountForGuest', async () => {
        const { createBridgeExternalAccountForGuest } = require('@/app/actions/external-accounts')
        await createBridgeExternalAccountForGuest('customer-123', {
            accountType: 'iban',
            accountOwnerType: 'individual',
            iban: 'DE89370400440532013000',
            accountOwnerName: 'Test User',
            currency: 'eur',
        })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in initiateSumsubKyc', async () => {
        const { initiateSumsubKyc } = require('@/app/actions/sumsub')
        await initiateSumsubKyc()

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in updateUserById', async () => {
        const { updateUserById } = require('@/app/actions/users')
        await updateUserById({ name: 'Test' })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in getKycDetails', async () => {
        const { getKycDetails } = require('@/app/actions/users')
        await getKycDetails({ endorsements: ['base'] })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in addBankAccount', async () => {
        const { addBankAccount } = require('@/app/actions/users')
        await addBankAccount({
            accountType: 'iban',
            accountOwnerType: 'individual',
            iban: 'DE89370400440532013000',
            accountOwnerName: 'Test User',
            currency: 'eur',
        })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in confirmBridgeTos', async () => {
        const { confirmBridgeTos } = require('@/app/actions/users')
        await confirmBridgeTos()

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in createOfframp', async () => {
        const { createOfframp } = require('@/app/actions/offramp')
        await createOfframp({
            source: { currency: 'usdc', paymentRail: 'ethereum' },
            destination: { currency: 'usd', paymentRail: 'ach', externalAccountId: 'ext-123' },
        })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in createOfframpForGuest', async () => {
        const { createOfframpForGuest } = require('@/app/actions/offramp')
        await createOfframpForGuest({
            source: { currency: 'usdc', paymentRail: 'ethereum' },
            destination: { currency: 'usd', paymentRail: 'ach', externalAccountId: 'ext-123' },
        })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in confirmOfframp', async () => {
        const { confirmOfframp } = require('@/app/actions/offramp')
        await confirmOfframp('transfer-123', '0xabcdef')

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })

    it('should include Content-Type in createOnrampForGuest', async () => {
        const { createOnrampForGuest } = require('@/app/actions/onramp')
        await createOnrampForGuest({
            amount: '100',
            country: { id: 'US', name: 'United States', code: 'US' },
            userId: 'user-123',
        })

        const headers = getLastCallHeaders()
        expect(headers['Content-Type']).toBe('application/json')
    })
})
