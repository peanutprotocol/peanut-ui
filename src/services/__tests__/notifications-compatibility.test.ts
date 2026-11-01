import { notificationsApi } from '../notifications'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const fetchMock = jest.mocked(serverFetch)
const response = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

beforeEach(() => fetchMock.mockReset())

it.each([true, false])('retries a mixed-version 400 once using only push=%s', async (push) => {
    fetchMock.mockResolvedValueOnce(response(400)).mockResolvedValueOnce(response(200, { push }))
    await expect(
        notificationsApi.savePreferences({ push, marketingPush: false, emailUpdates: true, pushPermission: 'granted' })
    ).resolves.toMatchObject({ push })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ push }),
    })
})

it.each([401, 403, 429, 500])('does not downgrade or retry a %s response', async (status) => {
    fetchMock.mockResolvedValue(response(status))
    await expect(notificationsApi.savePreferences({ push: false, emailUpdates: false })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
})

it.each([{ push: false }, { emailUpdates: false }])(
    'does not invent push or repeat an old-schema request: %p',
    async (changes) => {
        fetchMock.mockResolvedValue(response(400))
        await expect(notificationsApi.savePreferences(changes)).rejects.toThrow()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    }
)

it('bounds fallback failure to two attempts', async () => {
    fetchMock.mockResolvedValue(response(400))
    await expect(notificationsApi.savePreferences({ push: false, marketingPush: false })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
})
