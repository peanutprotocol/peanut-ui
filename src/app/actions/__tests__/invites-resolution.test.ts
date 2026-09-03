import { validateInviteCode } from '../invites'
import { serverFetch } from '@/utils/api-fetch'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>

function response(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response
}

describe('validateInviteCode mixed-version resolution', () => {
    beforeEach(() => jest.clearAllMocks())

    it('treats a typed campaign-only HTTP 409 as a settled transport result', async () => {
        mockServerFetch.mockResolvedValue(
            response(409, {
                message: 'Campaign processed without invite attribution',
                attributionResolved: false,
                onboardingResolved: false,
                username: '',
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
            })
        )

        // the wire still echoes the retired destination fields; the action's
        // parser reduces the descriptor to the campaign identity (TASK-21226)
        await expect(validateInviteCode('offramp')).resolves.toEqual({
            data: {
                success: true,
                attributionResolved: false,
                onboardingResolved: false,
                username: '',
                legacyAcquisition: { campaignTag: 'offramp' },
            },
        })
    })

    it('keeps an untyped HTTP 409 as a transport failure', async () => {
        mockServerFetch.mockResolvedValue(response(409, { error: 'Invite code is not valid' }))

        await expect(validateInviteCode('not-an-invite')).resolves.toEqual({
            error: 'Invite code is not valid',
        })
    })

    it('supports a pre-discriminator HTTP 200 validation response with a username', async () => {
        mockServerFetch.mockResolvedValue(response(200, { username: 'legacy-inviter' }))

        await expect(validateInviteCode('legacy-invite')).resolves.toEqual({
            data: {
                success: true,
                attributionResolved: true,
                onboardingResolved: true,
                username: 'legacy-inviter',
                legacyAcquisition: undefined,
            },
        })
    })

    it('lets an explicit false discriminator override the legacy username signal', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                username: 'legacy-inviter',
                attributionResolved: false,
                onboardingResolved: false,
            })
        )

        await expect(validateInviteCode('legacy-invite')).resolves.toMatchObject({
            data: {
                success: true,
                attributionResolved: false,
                onboardingResolved: false,
                username: 'legacy-inviter',
            },
        })
    })
})
