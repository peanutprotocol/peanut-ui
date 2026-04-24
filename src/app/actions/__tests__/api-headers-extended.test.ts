// extended integration test: action functions do NOT leak apiKey in request body
// follows the same mock pattern as api-headers.test.ts

import { fetchWithSentry } from '@/utils/sentry.utils'

jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: jest.fn(() =>
        Promise.resolve({
            ok: true,
            json: () => Promise.resolve({}),
            clone: () => ({ json: () => Promise.resolve(''), text: () => Promise.resolve('') }),
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

jest.mock('@/app/actions/currency', () => ({
    getCurrencyPrice: jest.fn(() => Promise.resolve({ buy: 1, sell: 1 })),
}))

jest.mock('@/utils/bridge.utils', () => ({
    getCurrencyConfig: jest.fn(() => ({ currency: 'usd', paymentRail: 'ach_push' })),
}))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

// helper to parse the body from the last fetchWithSentry call
function getLastCallBody(): Record<string, any> | null {
    const calls = mockFetchWithSentry.mock.calls
    const lastCall = calls[calls.length - 1]
    const bodyStr = lastCall[1]?.body as string | undefined
    if (!bodyStr) return null
    return JSON.parse(bodyStr)
}

describe('action functions should NOT include apiKey in body', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    it('should not include apiKey in validateInviteCode body', async () => {
        const { validateInviteCode } = require('@/app/actions/invites')
        await validateInviteCode('TEST-CODE')

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in purchaseCard body', async () => {
        const { purchaseCard } = require('@/app/actions/card')
        await purchaseCard()

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in createBridgeExternalAccountForGuest body', async () => {
        const { createBridgeExternalAccountForGuest } = require('@/app/actions/external-accounts')
        await createBridgeExternalAccountForGuest('customer-123', {
            accountType: 'iban',
            accountOwnerType: 'individual',
            iban: 'DE89370400440532013000',
            accountOwnerName: 'Test User',
            currency: 'eur',
        })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in initiateSumsubKyc body', async () => {
        const { initiateSumsubKyc } = require('@/app/actions/sumsub')
        await initiateSumsubKyc()

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in updateUserById body', async () => {
        const { updateUserById } = require('@/app/actions/users')
        await updateUserById({ name: 'Test' })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in getKycDetails body', async () => {
        const { getKycDetails } = require('@/app/actions/users')
        await getKycDetails({ endorsements: ['base'] })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in addBankAccount body', async () => {
        const { addBankAccount } = require('@/app/actions/users')
        await addBankAccount({
            accountType: 'iban',
            accountOwnerType: 'individual',
            iban: 'DE89370400440532013000',
            accountOwnerName: 'Test User',
            currency: 'eur',
        })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in confirmBridgeTos body', async () => {
        const { confirmBridgeTos } = require('@/app/actions/users')
        await confirmBridgeTos()

        const body = getLastCallBody()
        // confirmBridgeTos may send empty body or no body
        if (body) {
            expect(body).not.toHaveProperty('apiKey')
        }
    })

    it('should not include apiKey in createOfframp body', async () => {
        const { createOfframp } = require('@/app/actions/offramp')
        await createOfframp({
            source: { currency: 'usdc', paymentRail: 'ethereum' },
            destination: { currency: 'usd', paymentRail: 'ach', externalAccountId: 'ext-123' },
        })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in createOfframpForGuest body', async () => {
        const { createOfframpForGuest } = require('@/app/actions/offramp')
        await createOfframpForGuest({
            source: { currency: 'usdc', paymentRail: 'ethereum' },
            destination: { currency: 'usd', paymentRail: 'ach', externalAccountId: 'ext-123' },
        })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in confirmOfframp body', async () => {
        const { confirmOfframp } = require('@/app/actions/offramp')
        await confirmOfframp('transfer-123', '0xabcdef')

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })

    it('should not include apiKey in createOnrampForGuest body', async () => {
        const { createOnrampForGuest } = require('@/app/actions/onramp')
        await createOnrampForGuest({
            amount: '100',
            country: { id: 'US', name: 'United States', code: 'US' },
            userId: 'user-123',
        })

        const body = getLastCallBody()
        expect(body).not.toBeNull()
        expect(body).not.toHaveProperty('apiKey')
    })
})
