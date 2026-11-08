import { notificationsApi } from '../notifications'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const fetchMock = jest.mocked(serverFetch)
const response = (status: number, body: unknown = {}) =>
    ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response

beforeEach(() => fetchMock.mockReset())

it.each([true, false])('sends exactly one complete PUT on 400 for push=%s', async (push) => {
    const changes = { push, marketingPush: false, emailUpdates: false, pushPermission: 'granted' as const }
    fetchMock.mockResolvedValue(response(400))
    await expect(notificationsApi.savePreferences(changes)).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(changes),
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

it.each([{ marketingPush: true }, { emailUpdates: true }])(
    'fails instead of dropping an opt-in an older API cannot store: %p',
    async (optIn) => {
        fetchMock.mockResolvedValue(response(400))
        await expect(notificationsApi.savePreferences({ push: true, ...optIn })).rejects.toThrow()
        expect(fetchMock).toHaveBeenCalledTimes(1)
    }
)

it('binds a preference PUT to the account that initiated the choice', async () => {
    const changes = { push: true, marketingPush: false, pushPermission: 'granted' as const }
    fetchMock.mockResolvedValue(response(200, { ...changes }))
    await notificationsApi.savePreferences(changes, 'user-a')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify({ ...changes, expectedUserId: 'user-a' }),
    })
})
