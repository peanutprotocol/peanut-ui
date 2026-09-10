import Cookies from 'js-cookie'
import { installPasskeyVerifyCapture } from '../passkey-auth-capture'
import { guardPasskeyCeremony } from '../passkeyCeremony.utils'
import { getAuthToken } from '../auth-token'
import { invitesApi } from '@/services/invites'
import { claimBadgeCampaigns } from '@/services/badge-campaigns'
import { EInviteType } from '@/services/services.types'

jest.mock('@/app/actions/invites', () => ({ validateInviteCode: jest.fn() }))
jest.mock('@/utils/general.utils', () => ({
    toInviteCode: (value: string) => value,
    getFromLocalStorage: (key: string) => {
        const value = localStorage.getItem(key)
        return value ? JSON.parse(value) : null
    },
    saveToLocalStorage: (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value)),
}))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/constants/general.consts', () => ({ PEANUT_API_URL: 'https://api.test.com' }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))
jest.mock('@/dev/fixtures/active', () => ({ ensureActiveFixture: () => false }))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: jest.fn(),
    withScope: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}))
jest.mock('@/utils/sentry.utils', () => ({
    fetchWithSentry: (url: string, init: RequestInit) => window.fetch(url, init),
}))

const calls: Array<{ url: string; authorization?: string }> = []
function response(body: unknown): Response {
    const result = {
        ok: true,
        status: 200,
        json: async () => body,
        text: async () => JSON.stringify(body),
        clone: () => result,
    }
    return result as unknown as Response
}

beforeAll(() => {
    window.fetch = jest.fn(async (input, init) => {
        const url = String(input)
        const authorization = (init?.headers as Record<string, string> | undefined)?.Authorization
        calls.push({ url, authorization })
        if (url.endsWith('/verify')) return response({ verification: { verified: true }, token: 'fresh-web-session' })
        if (url.endsWith('/options')) return response({ options: { challenge: 'challenge' } })
        expect(authorization).toBe('Bearer fresh-web-session')
        return response(
            url.endsWith('/invites/accept')
                ? { onboardingResolved: true, attributionResolved: true }
                : { claims: [{ badgeCampaign: 'campaign', outcome: 'awarded' }] }
        )
    })
    installPasskeyVerifyCapture()
})
beforeEach(() => {
    Cookies.remove('jwt-token')
    calls.length = 0
})

it('commits verify before fresh web invite and badge requests, without response cookies', async () => {
    expect(getAuthToken()).toBeNull()
    await guardPasskeyCeremony(async () => {
        await window.fetch('https://api.test.com/passkeys/register/options', { method: 'POST' })
        await window.fetch('https://api.test.com/passkeys/register/verify', { method: 'POST' })
        expect(getAuthToken()).toBeNull()
    })
    const invite = await invitesApi.acceptInvite('inviter', EInviteType.DIRECT)
    const badge = await claimBadgeCampaigns(['campaign'])
    expect(invite).toMatchObject({ success: true, onboardingResolved: true })
    expect(badge).toMatchObject({ claims: [{ badgeCampaign: 'campaign', outcome: 'awarded' }] })
    expect(calls).toHaveLength(4)
})

it('does not commit a token when the ceremony fails after verification', async () => {
    await expect(
        guardPasskeyCeremony(async () => {
            await window.fetch('https://api.test.com/passkeys/register/verify', { method: 'POST' })
            throw new Error('credential conversion failed')
        })
    ).rejects.toThrow('credential conversion failed')
    expect(getAuthToken()).toBeNull()
})
