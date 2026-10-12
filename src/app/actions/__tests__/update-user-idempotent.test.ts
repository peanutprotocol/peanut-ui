// updateUserById marks /update-user idempotent, so a request that WebKit
// dropped before it reached the server is resent once (PEANUT-UI-T0D).
// A request carrying a step-up proof is not, because the proof may be single-use.
import { updateUserById } from '../users'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/services/step-up', () => ({
    withStepUpHeader: jest.fn(async () => ({ 'X-Step-Up': 'proof' })),
}))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const okResponse = { ok: true, json: async () => ({ userId: 'u1' }) } as Response

beforeEach(() => mockServerFetch.mockReset().mockResolvedValue(okResponse))

it('marks a plain profile update idempotent', async () => {
    await updateUserById({ userId: 'u1', email: 'a@b.co' })

    expect(mockServerFetch).toHaveBeenCalledWith('/update-user', expect.objectContaining({ idempotent: true }))
})

it('does not mark an update that carries an email verification code', async () => {
    await updateUserById({ userId: 'u1', email: 'a@b.co', emailVerificationCode: '123456' })

    expect(mockServerFetch).toHaveBeenCalledWith('/update-user', expect.objectContaining({ idempotent: false }))
})
