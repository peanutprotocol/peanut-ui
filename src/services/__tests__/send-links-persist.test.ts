/** @jest-environment jsdom */
/**
 * sendLinksApi.persist records a funded link before the success screen
 * (TASK-24270). The pubKey is the row's primary key, so a replay is safe and
 * a 409 means an earlier attempt already wrote the row.
 */
import { sendLinksApi } from '@/services/sendLinks'
import { apiFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ apiFetch: jest.fn(), serverFetch: jest.fn() }))
jest.mock('@/utils/demo', () => ({ isDemoMode: jest.fn().mockReturnValue(false) }))

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

const link = {
    pubKey: '0x899B65fd3660F09D1504392A705a9f003316edDe',
    chainId: '42161',
    contractVersion: 'v4.4',
    depositIdx: 589,
    txHash: `0x${'72'.repeat(32)}`,
    amount: 5_000_000n,
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
}

const response = (status: number, body: unknown = {}): Response =>
    ({
        ok: status >= 200 && status < 300,
        status,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
    }) as Response

beforeEach(() => {
    jest.useFakeTimers()
    mockApiFetch.mockReset()
})
afterEach(() => jest.useRealTimers())

/** Runs persist to the end, letting its retry backoff elapse. */
async function settle(promise: Promise<void>) {
    const outcome = promise.then(
        () => 'resolved' as const,
        (error: unknown) => error
    )
    await jest.runAllTimersAsync()
    return outcome
}

test('sends the deposit index as a JSON number, the shape the API accepts', async () => {
    mockApiFetch.mockResolvedValueOnce(response(201))
    expect(await settle(sendLinksApi.persist(link))).toBe('resolved')

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]!.body as string)
    expect(body.depositIdx).toBe(589)
    expect(body.txHash).toBe(link.txHash)
})

test('retries a failure that can pass, then resolves', async () => {
    mockApiFetch.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(response(503))
    mockApiFetch.mockResolvedValueOnce(response(201))
    expect(await settle(sendLinksApi.persist(link))).toBe('resolved')
    expect(mockApiFetch).toHaveBeenCalledTimes(3)
})

test('a 409 means an earlier attempt wrote the link', async () => {
    mockApiFetch.mockResolvedValueOnce(response(409, { error: 'A send link with this pubKey already exists' }))
    expect(await settle(sendLinksApi.persist(link))).toBe('resolved')
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
})

test('a validation error is not retried', async () => {
    mockApiFetch.mockResolvedValue(response(400, { error: 'body/depositIdx must be integer' }))
    const outcome = await settle(sendLinksApi.persist(link))
    expect(outcome).toMatchObject({ name: 'ApiError', status: 400 })
    expect(mockApiFetch).toHaveBeenCalledTimes(1)
})

test('gives up after four attempts', async () => {
    mockApiFetch.mockResolvedValue(response(502))
    expect(await settle(sendLinksApi.persist(link))).toMatchObject({ status: 502 })
    expect(mockApiFetch).toHaveBeenCalledTimes(4)
})
