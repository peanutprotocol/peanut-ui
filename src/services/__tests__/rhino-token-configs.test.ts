/** @jest-environment jsdom */
/**
 * Rhino's token list feeds recover funds (TASK-23850). A failure must reject,
 * so the hook falls back to our own list instead of treating it as "no Rhino
 * tokens", and it is reported to Sentry exactly once.
 */
import { fetchRhinoTokenConfigs } from '@/services/rhino-token-configs'
import { fetchWithSentry } from '@/utils/sentry.utils'

jest.mock('@/utils/sentry.utils', () => ({ fetchWithSentry: jest.fn() }))
const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => mockCaptureException(...args) }))

const mockFetchWithSentry = fetchWithSentry as jest.MockedFunction<typeof fetchWithSentry>

const response = (status: number, json: () => Promise<unknown>) =>
    ({ ok: status >= 200 && status < 300, status, json }) as unknown as Response

const LIST = {
    ARBITRUM: [
        { tokenAddress: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', symbol: 'USDT', name: 'USDT', decimals: 6 },
    ],
}

describe('fetchRhinoTokenConfigs', () => {
    beforeEach(() => jest.clearAllMocks())

    it("returns Rhino's list on 200, from the public endpoint with a timeout", async () => {
        mockFetchWithSentry.mockResolvedValue(response(200, async () => LIST))
        await expect(fetchRhinoTokenConfigs()).resolves.toEqual(LIST)
        expect(mockFetchWithSentry).toHaveBeenCalledWith(
            'https://api.rhino.fi/bridge/bridge-swap-token-configs',
            { method: 'GET' },
            expect.any(Number)
        )
    })

    it('rejects on a non-2xx without a second report (fetchWithSentry made the first)', async () => {
        mockFetchWithSentry.mockResolvedValue(response(503, async () => ({})))
        await expect(fetchRhinoTokenConfigs()).rejects.toThrow('503')
        expect(mockCaptureException).not.toHaveBeenCalled()
    })

    it.each([
        ['invalid JSON', async () => Promise.reject(new SyntaxError('bad json'))],
        ['an array', async () => []],
        ['null', async () => null],
    ])('rejects AND reports a malformed 200 (%s)', async (_case, json) => {
        mockFetchWithSentry.mockResolvedValue(response(200, json))
        await expect(fetchRhinoTokenConfigs()).rejects.toThrow('malformed 200')
        expect(mockCaptureException).toHaveBeenCalledTimes(1)
    })
})
