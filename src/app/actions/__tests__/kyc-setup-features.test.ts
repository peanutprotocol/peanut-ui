import { findKycSetupFeatures } from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'

// A returning user sees the setup status only when the current identity was
// verified through the document list, and the rows follow the saved set.

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const features = { qr: true, local: false, bank: true, card: false }
const plan = { available: false, activeAttemptId: null, policyVersion: 'v1', features, routes: [] }
const attempt = (overrides: Record<string, unknown>) => ({
    kind: 'IDENTITY',
    provider: 'SUMSUB',
    verificationId: 'identity-1',
    status: 'APPROVED',
    ...overrides,
})
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response
const answers = (profile: unknown, planOk = true) =>
    mockFetch.mockImplementation(async (path) =>
        String(path).startsWith('/users/kyc/profile') ? answer(profile) : answer(plan, planOk)
    )
const profile = (attempts: unknown[], identity: unknown = { verificationId: 'identity-1' }) => ({ identity, attempts })

beforeEach(() => mockFetch.mockReset())

describe('findKycSetupFeatures', () => {
    it('returns the saved features of an identity verified through the document list', async () => {
        answers(profile([attempt({})]))
        await expect(findKycSetupFeatures()).resolves.toEqual(features)
    })

    it('an identity verified any other way has none', async () => {
        answers(profile([]))
        await expect(findKycSetupFeatures()).resolves.toBeNull()
    })

    it('ignores a replaced attempt and an attempt of an older identity', async () => {
        answers(profile([attempt({ status: 'SUPERSEDED' }), attempt({ verificationId: 'identity-0' })]))
        await expect(findKycSetupFeatures()).resolves.toBeNull()
    })

    it('no identity has none', async () => {
        answers(profile([attempt({})], null))
        await expect(findKycSetupFeatures()).resolves.toBeNull()
    })

    it('a failed read has none, so the legacy status shows', async () => {
        answers(profile([attempt({})]), false)
        await expect(findKycSetupFeatures()).resolves.toBeNull()
    })
})
