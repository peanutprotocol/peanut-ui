import {
    findKycReplacementPlan,
    getKycReplacementPlan,
    isPaperworkVerificationIdentity,
} from '@/app/actions/kyc-workflow'
import { serverFetch } from '@/utils/api-fetch'

// A returning user sees the /verify timeline only when the current identity was
// verified through a Smart Paperwork Verification attempt.

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
const mockFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

const features = { qr: true, local: false, bank: true, card: false }
const plan = { available: true, activeAttemptId: null, policyVersion: 'v1', features, routes: [], flow: 'verify-once' }
const attempt = (overrides: Record<string, unknown>) => ({
    id: 'identity-attempt',
    kind: 'IDENTITY',
    provider: 'SUMSUB',
    verificationId: 'identity-1',
    status: 'APPROVED',
    ...overrides,
})
const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response
const answers = (profile: unknown, planOk = true, planBody: unknown = plan) =>
    mockFetch.mockImplementation(async (path) =>
        String(path).startsWith('/users/kyc/profile') ? answer(profile) : answer(planBody, planOk)
    )
const profile = (attempts: unknown[], identity: unknown = { verificationId: 'identity-1' }) => ({ identity, attempts })

beforeEach(() => mockFetch.mockReset())

describe('isPaperworkVerificationIdentity', () => {
    it('an identity verified through a Smart Paperwork Verification attempt is on the timeline', async () => {
        answers(profile([attempt({})]))
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(true)
    })

    it('an attempt identity the plan keeps off the flow is not', async () => {
        answers(profile([attempt({})]), true, { ...plan, available: false, flow: null })
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(false)
    })

    it('an identity verified any other way is not', async () => {
        answers(profile([]))
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(false)
    })

    it('ignores a replaced attempt and an attempt of an older identity', async () => {
        answers(profile([attempt({ status: 'SUPERSEDED' }), attempt({ verificationId: 'identity-0' })]))
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(false)
    })

    it('no identity is not', async () => {
        answers(profile([attempt({})], null))
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(false)
    })

    it('a failed read is not, so the identity status shows', async () => {
        answers(profile([attempt({})]), false)
        await expect(isPaperworkVerificationIdentity()).resolves.toBe(false)
    })
})

describe('getKycReplacementPlan', () => {
    const restartPlan = {
        ...plan,
        available: true,
        routes: [
            { id: 'base', documents: [{ key: 'identity', code: 'IDENTITY', types: ['PASSPORT'], countries: ['BR'] }] },
        ],
    }
    const restartAnswers = (profileBody: unknown, planBody: unknown = restartPlan) =>
        mockFetch.mockImplementation(async (path) =>
            String(path).startsWith('/users/kyc/profile') ? answer(profileBody) : answer(planBody)
        )

    it('reads the restart plan of an identity verified through a verification attempt', async () => {
        restartAnswers(profile([attempt({})]))
        await expect(getKycReplacementPlan()).resolves.toEqual(restartPlan)
        expect(mockFetch).toHaveBeenCalledWith('/users/kyc/plan?restart=true', expect.anything())
    })

    it('an identity verified any other way keeps the legacy restart', async () => {
        restartAnswers(profile([]))
        await expect(getKycReplacementPlan()).resolves.toBeNull()
        restartAnswers(profile([attempt({ status: 'SUPERSEDED' })]))
        await expect(getKycReplacementPlan()).resolves.toBeNull()
    })

    it('without a published policy, or with nothing the API would take, the legacy restart stays', async () => {
        restartAnswers(profile([attempt({})]), { ...restartPlan, policyVersion: null })
        await expect(getKycReplacementPlan()).resolves.toBeNull()
        restartAnswers(profile([attempt({})]), { ...restartPlan, available: false, routes: [] })
        await expect(getKycReplacementPlan()).resolves.toBeNull()
    })

    it('a failed read throws for the restart screen and is null for the restart button', async () => {
        mockFetch.mockResolvedValue(answer(null, false))
        await expect(getKycReplacementPlan()).rejects.toThrow('KYC request failed')
        await expect(findKycReplacementPlan()).resolves.toBeNull()
    })
})
