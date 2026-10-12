// updateUserById marks /update-user idempotent and says how a failed update failed.
// It marks /update-user idempotent, so a request that WebKit
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

it('returns the status and an http failure kind for a non-2xx, even when the body is not JSON', async () => {
    mockServerFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => {
            throw new SyntaxError('Unexpected token <')
        },
    } as unknown as Response)

    expect(await updateUserById({ userId: 'u1' })).toEqual({
        error: 'Failed to update user',
        failureKind: 'http',
        status: 502,
    })
})

it('classifies a request that got no response as a network failure', async () => {
    mockServerFetch.mockRejectedValueOnce(
        Object.assign(new Error('Something went wrong. Please try again.'), { name: 'ServiceUnavailableError' })
    )

    expect(await updateUserById({ userId: 'u1' })).toMatchObject({ failureKind: 'network' })
})

it('classifies any other throw as other', async () => {
    mockServerFetch.mockRejectedValueOnce(new Error('boom'))

    expect(await updateUserById({ userId: 'u1' })).toMatchObject({ failureKind: 'other', error: 'boom' })
})
