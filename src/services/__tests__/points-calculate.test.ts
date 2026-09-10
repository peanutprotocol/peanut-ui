/** @jest-environment jsdom */
import { pointsApi } from '@/services/points'
import { PointsAction } from '@/services/services.types'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({
    serverFetch: jest.fn(),
    apiFetch: jest.fn(),
}))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const response = (init: { ok: boolean; body?: unknown }) =>
    ({
        ok: init.ok,
        status: init.ok ? 200 : 500,
        statusText: init.ok ? 'OK' : 'Internal Server Error',
        json: async () => init.body,
    }) as Response

const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

beforeEach(() => {
    mockServerFetch.mockReset()
    consoleError.mockClear()
})

// calculatePoints is a preview endpoint: a failure must degrade to null, never
// reject — success screens call it and a throw would crash a completed payment.
describe('pointsApi.calculatePoints', () => {
    it('resolves the estimate on success', async () => {
        mockServerFetch.mockResolvedValue(response({ ok: true, body: { estimatedPoints: 42 } }))

        await expect(
            pointsApi.calculatePoints({ actionType: PointsAction.P2P_SEND_LINK, usdAmount: 10 })
        ).resolves.toEqual({ estimatedPoints: 42 })
    })

    it('resolves null on API failure and on network error, logging only once', async () => {
        mockServerFetch.mockResolvedValueOnce(response({ ok: false }))
        await expect(
            pointsApi.calculatePoints({ actionType: PointsAction.P2P_SEND_LINK, usdAmount: 10 })
        ).resolves.toBeNull()

        mockServerFetch.mockRejectedValueOnce(new Error('network down'))
        await expect(
            pointsApi.calculatePoints({ actionType: PointsAction.P2P_SEND_LINK, usdAmount: 10 })
        ).resolves.toBeNull()

        // once per session — repeated previews must not storm the console/Sentry
        expect(consoleError).toHaveBeenCalledTimes(1)
    })
})
