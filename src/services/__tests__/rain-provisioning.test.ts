/** @jest-environment jsdom */

import { rainApi } from '@/services/rain'

const mockedApiFetch = jest.fn()
const mockedGetStepUpToken = jest.fn()

jest.mock('@/utils/api-fetch', () => ({ apiFetch: (...args: unknown[]) => mockedApiFetch(...args) }))
jest.mock('@/utils/auth-token', () => ({ getAuthToken: () => 'jwt-abc' }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/services/step-up', () => ({
    STEP_UP_HEADER: 'x-step-up-token',
    getStepUpToken: (...args: unknown[]) => mockedGetStepUpToken(...args),
}))

const jsonResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

beforeEach(() => jest.clearAllMocks())

describe('rainApi.getProvisioningAuthorization', () => {
    it('uses an explicit proof without starting another step-up ceremony', async () => {
        mockedApiFetch.mockResolvedValue(
            jsonResponse({ walletAuthorizationToken: 'grant-1', walletAuthorizationExpiresIn: 2_592_000 })
        )

        await expect(
            rainApi.getProvisioningAuthorization('card-1', 'apple', { stepUpToken: 'cached-proof' })
        ).resolves.toEqual({ walletAuthorizationToken: 'grant-1', walletAuthorizationExpiresIn: 2_592_000 })

        expect(mockedApiFetch).toHaveBeenCalledWith('/rain/cards/card-1/provisioning-authorization', {
            method: 'POST',
            headers: expect.objectContaining({
                'api-key': expect.any(String),
                'x-step-up-token': 'cached-proof',
            }),
            body: JSON.stringify({ wallet: 'apple' }),
            cache: 'no-store',
            timeoutMs: undefined,
        })
        expect(mockedGetStepUpToken).not.toHaveBeenCalled()
    })
})
