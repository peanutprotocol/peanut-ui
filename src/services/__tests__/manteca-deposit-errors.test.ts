import { mantecaApi } from '../manteca'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

beforeEach(() => jest.clearAllMocks())

it.each([
    [403, 'MANTECA_ACCOUNT_REJECTED'],
    [400, 'MANTECA_KYC_REQUIRED'],
] as const)('preserves deposit refusal %s/%s', async (status, code) => {
    const body = { error: 'Provider refusal', code }
    jest.mocked(serverFetch).mockResolvedValue({ ok: false, status, json: async () => body } as Response)

    await expect(mantecaApi.deposit({ amount: '100', currency: 'ARS', isUsdDenominated: false })).resolves.toEqual(body)
    expect(serverFetch).toHaveBeenCalledTimes(1)
    expect(serverFetch).toHaveBeenCalledWith('/manteca/deposit', expect.objectContaining({ method: 'POST' }))
})

it.each([undefined, null, 403, {}])('ignores malformed deposit error code %s', async (code) => {
    jest.mocked(serverFetch).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'Legacy refusal', code }),
    } as Response)

    await expect(mantecaApi.deposit({ amount: '100', currency: 'ARS', isUsdDenominated: false })).resolves.toEqual({
        error: 'Legacy refusal',
    })
})
