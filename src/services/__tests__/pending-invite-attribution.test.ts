import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { settlePendingInviteAttribution } from '../pending-invite-attribution'

const mockAcceptInvite = jest.fn()
const mockClearInvite = jest.fn()
const mockExtendInviteForRetry = jest.fn()
const mockSettleAcceptedInviteAcquisition = jest.fn()
const mockCapture = jest.fn()
const mockCaptureException = jest.fn()
let inviteCode = 'alice'
let inviteType = EInviteType.PAYMENT_LINK

jest.mock('../invites', () => ({
    invitesApi: { acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args) },
}))
jest.mock('../invite-acquisition', () => ({
    settleAcceptedInviteAcquisition: (...args: unknown[]) => mockSettleAcceptedInviteAcquisition(...args),
}))
jest.mock('@/utils/invite-stash', () => ({
    readInviteCode: () => inviteCode,
    readInviteType: () => inviteType,
    clearInvite: (...args: unknown[]) => mockClearInvite(...args),
    extendInviteForRetry: (...args: unknown[]) => mockExtendInviteForRetry(...args),
}))
jest.mock('posthog-js', () => ({ capture: (...args: unknown[]) => mockCapture(...args) }))
jest.mock('@/utils/sentry-lazy', () => ({
    captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

describe('pending invite attribution', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        inviteCode = 'alice'
        inviteType = EInviteType.PAYMENT_LINK
        mockSettleAcceptedInviteAcquisition.mockReturnValue({ destination: '/home', pending: [] })
    })

    it('clears the hand-off only after the referral edge is confirmed', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })

        await expect(settlePendingInviteAttribution()).resolves.toMatchObject({
            status: 'attributed',
            inviteCode: 'alice',
            inviteType: EInviteType.PAYMENT_LINK,
        })

        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.PAYMENT_LINK)
        expect(mockClearInvite).toHaveBeenCalledTimes(1)
        expect(mockExtendInviteForRetry).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
            invite_code: 'alice',
            invite_type: EInviteType.PAYMENT_LINK,
        })
    })

    it('keeps the inviter for the next authenticated start after a transient failure', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: false,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })

        await expect(settlePendingInviteAttribution()).resolves.toMatchObject({ status: 'retryable' })

        expect(mockClearInvite).not.toHaveBeenCalled()
        expect(mockExtendInviteForRetry).toHaveBeenCalledWith(30)
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ tags: { error_type: 'invite_accept_failed' } })
        )
    })

    it('settles a terminal legacy campaign without pretending it has an inviter', async () => {
        const legacyAcquisition = { campaignTag: 'founderhaus' }
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: false,
            onboardingResolved: false,
            legacyAcquisition,
            claims: [{ badgeCampaign: 'founderhaus', outcome: 'awarded' }],
        })

        await expect(settlePendingInviteAttribution()).resolves.toMatchObject({ status: 'campaign_only' })

        expect(mockSettleAcceptedInviteAcquisition).toHaveBeenCalledWith(legacyAcquisition, [
            expect.objectContaining({ badgeCampaign: 'founderhaus', outcome: 'awarded' }),
        ])
        expect(mockClearInvite).toHaveBeenCalledTimes(1)
        expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, expect.anything())
    })

    it('de-duplicates registration and auth-provider attempts', async () => {
        let resolveAccept!: (value: unknown) => void
        mockAcceptInvite.mockReturnValue(
            new Promise((resolve) => {
                resolveAccept = resolve
            })
        )

        const registrationAttempt = settlePendingInviteAttribution()
        const authProviderAttempt = settlePendingInviteAttribution()
        expect(mockAcceptInvite).toHaveBeenCalledTimes(1)

        resolveAccept({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })

        await expect(Promise.all([registrationAttempt, authProviderAttempt])).resolves.toEqual([
            expect.objectContaining({ status: 'attributed' }),
            expect.objectContaining({ status: 'attributed' }),
        ])
        expect(mockClearInvite).toHaveBeenCalledTimes(1)
    })
})
