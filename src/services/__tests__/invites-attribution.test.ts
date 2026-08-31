import { invitesApi } from '../invites'
import { EInviteType } from '../services.types'
import { serverFetch } from '@/utils/api-fetch'
import { validateInviteCode } from '@/app/actions/invites'
import { destinationForInviteAcquisition, settleAcceptedInviteAcquisition } from '../invite-acquisition'
import { clearPendingBadgeCampaigns, getPendingBadgeCampaigns } from '@/components/Invites/badge-campaign-context'

jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/app/actions/invites', () => ({ validateInviteCode: jest.fn() }))

const mockServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>
const mockValidateInviteCode = validateInviteCode as jest.MockedFunction<typeof validateInviteCode>

function response(status: number, body: unknown): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: jest.fn().mockResolvedValue(body),
    } as unknown as Response
}

describe('invite attribution contract', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        clearPendingBadgeCampaigns()
    })

    afterAll(() => clearPendingBadgeCampaigns())

    it('normalizes and submits inviter attribution without campaign acquisition fields', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                message: 'Invite accepted',
                attributionResolved: true,
                onboardingResolved: true,
                claims: [],
            })
        )

        await invitesApi.acceptInvite(' @Juanacervio ', EInviteType.PAYMENT_LINK)

        expect(mockServerFetch).toHaveBeenCalledWith('/invites/accept', {
            method: 'POST',
            body: JSON.stringify({ inviteCode: 'juanacervio', type: EInviteType.PAYMENT_LINK }),
        })
        const body = JSON.parse(String(mockServerFetch.mock.calls[0][1]?.body))
        expect(body).not.toHaveProperty('campaignTag')
        expect(body).not.toHaveProperty('campaignTags')
    })

    it('forwards a published send-link campaign tag as a field separate from inviter attribution', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                message: 'Invite accepted',
                attributionResolved: true,
                onboardingResolved: true,
                claims: [{ campaignTag: 'devconnect_ba_2025', outcome: 'awarded' }],
            })
        )

        await invitesApi.acceptInvite('alice', EInviteType.PAYMENT_LINK, 'devconnect_ba_2025')

        expect(JSON.parse(String(mockServerFetch.mock.calls[0][1]?.body))).toEqual({
            inviteCode: 'alice',
            type: EInviteType.PAYMENT_LINK,
            campaignTag: 'devconnect_ba_2025',
        })
    })

    it('consumes the typed legacy acquisition and matching accept-time claim', async () => {
        mockServerFetch.mockResolvedValue(
            response(409, {
                message: 'Campaign processed without invite attribution',
                attributionResolved: false,
                onboardingResolved: false,
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
                claims: [
                    {
                        campaignTag: 'offramp',
                        badgeCode: 'OFFRAMP_USER',
                        outcome: 'already_owned',
                        capabilities: [],
                    },
                ],
            })
        )

        const result = await invitesApi.acceptInvite('offramp', EInviteType.PAYMENT_LINK)

        expect(result).toMatchObject({
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
            claims: [{ badgeCampaign: 'offramp', outcome: 'already_owned' }],
        })
        expect(settleAcceptedInviteAcquisition(result.legacyAcquisition!, result.claims)).toEqual({
            destination: '/home',
            pending: [],
        })
        expect(getPendingBadgeCampaigns()).toEqual([])
    })

    it('keeps an untyped HTTP 409 as a transport failure', async () => {
        mockServerFetch.mockResolvedValue(response(409, { error: 'Invite code is not valid' }))

        await expect(invitesApi.acceptInvite('not-an-invite', EInviteType.PAYMENT_LINK)).resolves.toEqual({
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })
    })

    it('supports a pre-discriminator HTTP 200 accept response', async () => {
        mockServerFetch.mockResolvedValue(response(200, { message: 'Invite accepted', claims: [] }))

        await expect(invitesApi.acceptInvite('legacy-invite', EInviteType.PAYMENT_LINK)).resolves.toMatchObject({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })
    })

    it('falls back normally when an accept-time compatibility claim is missing', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                message: 'Invite accepted',
                attributionResolved: false,
                onboardingResolved: false,
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
                claims: [],
            })
        )

        const result = await invitesApi.acceptInvite('offramp', EInviteType.PAYMENT_LINK)

        expect(result.claims).toEqual([{ badgeCampaign: 'offramp', outcome: 'retryable_error' }])
        expect(destinationForInviteAcquisition(result.legacyAcquisition!, result.claims)).toBe('/home')
        expect(settleAcceptedInviteAcquisition(result.legacyAcquisition!, result.claims)).toEqual({
            destination: '/home',
            pending: ['offramp'],
        })
        expect(getPendingBadgeCampaigns()).toEqual(['offramp'])
    })

    it('preserves the typed legacy campaign identity and destination from invite validation', async () => {
        mockValidateInviteCode.mockResolvedValue({
            data: {
                success: true,
                attributionResolved: false,
                onboardingResolved: false,
                username: 'peanut',
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
            },
        })

        await expect(invitesApi.validateInviteCode('offramp')).resolves.toEqual({
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            username: 'peanut',
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        })
    })

    it('lets explicit false discriminators override a successful HTTP 200', async () => {
        mockServerFetch.mockResolvedValue(
            response(200, {
                message: 'Campaign processed without invite attribution',
                attributionResolved: false,
                onboardingResolved: false,
                legacyAcquisition: {
                    campaignTag: 'offramp',
                    fallback: 'normal_app',
                    destination: 'offramp_migration',
                },
                claims: [
                    {
                        campaignTag: 'offramp',
                        badgeCode: 'OFFRAMP_USER',
                        outcome: 'awarded',
                        capabilities: [],
                    },
                ],
            })
        )

        await expect(invitesApi.acceptInvite('offramp', EInviteType.PAYMENT_LINK)).resolves.toMatchObject({
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [{ badgeCampaign: 'offramp', outcome: 'awarded' }],
        })
    })
})
