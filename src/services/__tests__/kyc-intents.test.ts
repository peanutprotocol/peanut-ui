/**
 * The two calls behind the unlock checklist (TASK-23329).
 *
 * The config URL carries the passport country, so the request opts out of URL
 * telemetry: a failed load would otherwise put that country in the Sentry
 * message and its PostHog mirror, which fetchWithSentry builds from the raw
 * URL. The redaction itself is pinned in utils/__tests__/sentry.utils.test.ts;
 * this pins that the config call asks for it.
 */
import { kycIntentsApi } from '@/services/kyc-intents'
import { apiFetch, serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>
const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const response = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

const open = { available: true }
const config = { residence: 'AR', intents: { qr: open, local: open, card: open, bank: open } }

beforeEach(() => jest.clearAllMocks())

describe('kycIntentsApi.getConfig', () => {
    it('asks for the residence alone when the ID is local', async () => {
        mockApiFetch.mockResolvedValue(response(200, config))
        await expect(kycIntentsApi.getConfig('AR')).resolves.toEqual(config)
        expect(mockApiFetch).toHaveBeenCalledWith('/config/kyc-intents?residence=AR', {
            includeAuth: false,
            redactTelemetry: true,
        })
    })

    it('sends the passport country to the API and keeps the URL out of telemetry', async () => {
        mockApiFetch.mockResolvedValue(response(200, config))
        await kycIntentsApi.getConfig('AR', 'VE')
        expect(mockApiFetch).toHaveBeenCalledWith(
            '/config/kyc-intents?residence=AR&idCountry=VE',
            expect.objectContaining({ redactTelemetry: true })
        )
    })

    it('fails with the status alone, never the request', async () => {
        mockApiFetch.mockResolvedValue(response(500))
        const failure = await kycIntentsApi.getConfig('AR', 'VE').catch((error: Error) => error)
        expect(failure).toEqual(new Error('Failed to load kyc intents: 500'))
        expect((failure as Error).message).not.toContain('VE')
    })
})

describe('kycIntentsApi.set', () => {
    const ticked = { qr: true, local: false, card: true, bank: false }

    it('stores the ticked set', async () => {
        const stored = { intents: ticked, setAt: '2026-10-05T12:00:00.000Z' }
        mockServerFetch.mockResolvedValue(response(200, stored))
        await expect(kycIntentsApi.set(ticked)).resolves.toEqual(stored)
        expect(mockServerFetch).toHaveBeenCalledWith('/users/kyc-intents', {
            method: 'PUT',
            body: JSON.stringify(ticked),
        })
    })

    it('throws when the set was not stored, so the SDK does not open on an unsaved choice', async () => {
        mockServerFetch.mockResolvedValue(response(400))
        await expect(kycIntentsApi.set(ticked)).rejects.toThrow('Failed to save kyc intents: 400')
    })
})
