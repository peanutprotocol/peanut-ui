import { findKycProviderRefusals, findKycSetup } from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'

// A returning user sees the setup status only when the current identity was
// verified through a verification attempt, and the rows follow the saved set.

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const features = { qr: true, local: false, bank: true, card: false }
const plan = { available: false, activeAttemptId: null, policyVersion: 'v1', features, routes: [] }
const attempt = (overrides: Record<string, unknown>) => ({
    id: 'identity-attempt',
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

describe('findKycSetup', () => {
    it('returns the saved features of an identity verified through a verification attempt', async () => {
        answers(profile([attempt({})]))
        await expect(findKycSetup()).resolves.toEqual({ features, refusals: {} })
    })

    it('carries the plan refusals the onboarding attempts record', async () => {
        const refused = attempt({
            id: 'manteca-onboarding',
            kind: 'ONBOARDING',
            provider: 'MANTECA',
            verificationId: 'manteca-1',
            status: 'REJECTED',
            decisionSource: 'POLICY',
            reasonCode: 'local_tax_id_missing',
            sourceAttemptId: 'identity-attempt',
            createdAt: '2026-10-01T10:01:00.000Z',
        })
        answers(profile([refused, attempt({})]))
        await expect(findKycSetup()).resolves.toEqual({ features, refusals: { manteca: 'local_tax_id_missing' } })
    })

    it('an identity verified any other way has none', async () => {
        answers(profile([]))
        await expect(findKycSetup()).resolves.toBeNull()
    })

    it('ignores a replaced attempt and an attempt of an older identity', async () => {
        answers(profile([attempt({ status: 'SUPERSEDED' }), attempt({ verificationId: 'identity-0' })]))
        await expect(findKycSetup()).resolves.toBeNull()
    })

    it('no identity has none', async () => {
        answers(profile([attempt({})], null))
        await expect(findKycSetup()).resolves.toBeNull()
    })

    it('a failed read has none, so the legacy status shows', async () => {
        answers(profile([attempt({})]), false)
        await expect(findKycSetup()).resolves.toBeNull()
    })
})

describe('findKycProviderRefusals', () => {
    it('reads the refusals and whether the plan is recorded', async () => {
        answers(profile([attempt({})]))
        await expect(findKycProviderRefusals()).resolves.toEqual({ refusals: {}, recorded: false })
    })

    it('a failed read has none, so the rails alone decide', async () => {
        mockFetch.mockResolvedValue(answer(null, false))
        await expect(findKycProviderRefusals()).resolves.toBeNull()
    })
})
