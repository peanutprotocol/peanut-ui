/** @jest-environment jsdom */
/**
 * The deposit call kept only the body's `error`, which for a provider refusal
 * is the generic "Unexpected error". The API's typed `code` (PROVIDER_REJECTED,
 * a 422 before any money moved) was dropped, so the add-money screen could not
 * tell the user what happened (TASK-23645).
 */
import { mantecaApi } from '@/services/manteca'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const params = { amount: '10000', isUsdDenominated: false, currency: 'ARS' } as never

const respond = (status: number, body: unknown) =>
    mockServerFetch.mockResolvedValue({ ok: status < 400, status, json: async () => body } as Response)

beforeEach(() => jest.clearAllMocks())

describe('mantecaApi.deposit refusals', () => {
    it('passes the typed refusal code through with the error', async () => {
        respond(422, { error: 'Unexpected error', message: 'User needs extra doc.', code: 'PROVIDER_REJECTED' })

        await expect(mantecaApi.deposit(params)).resolves.toEqual({
            error: 'Unexpected error',
            code: 'PROVIDER_REJECTED',
        })
    })

    it('an untyped failure carries no code', async () => {
        respond(500, { error: 'Unexpected error', message: 'boom' })

        await expect(mantecaApi.deposit(params)).resolves.toEqual({ error: 'Unexpected error' })
    })
})
