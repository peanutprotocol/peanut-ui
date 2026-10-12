import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { EInviteType } from '@/services/services.types'
import { settlePendingInviteAttribution } from '../pending-invite-attribution'

const mockAcceptInvite = jest.fn()
const mockBindInviteToUser = jest.fn()
const mockClearInviteIfOwnedBy = jest.fn()
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
    bindInviteToUser: (...args: unknown[]) => mockBindInviteToUser(...args),
    clearInviteIfOwnedBy: (...args: unknown[]) => mockClearInviteIfOwnedBy(...args),
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
        mockBindInviteToUser.mockReturnValue(true)
        mockClearInviteIfOwnedBy.mockReturnValue(true)
        mockSettleAcceptedInviteAcquisition.mockReturnValue({ destination: '/home', pending: [] })
    })

    it('clears the hand-off only after the referral edge is confirmed', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: true,
            attributionResolved: true,
            onboardingResolved: true,
            claims: [],
        })

        await expect(settlePendingInviteAttribution('user-a')).resolves.toMatchObject({
            status: 'attributed',
            inviteCode: 'alice',
            inviteType: EInviteType.PAYMENT_LINK,
        })

        expect(mockAcceptInvite).toHaveBeenCalledWith('alice', EInviteType.PAYMENT_LINK)
        expect(mockClearInviteIfOwnedBy).toHaveBeenCalledWith('alice', 'user-a')
        expect(mockExtendInviteForRetry).not.toHaveBeenCalled()
        expect(mockCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPTED, {
            invite_code: 'alice',
            invite_type: EInviteType.PAYMENT_LINK,
        })
    })

    it('keeps the inviter for the next authenticated start after a transient failure', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: false,
            retryable: true,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })

        await expect(settlePendingInviteAttribution('user-a')).resolves.toMatchObject({ status: 'retryable' })

        expect(mockClearInviteIfOwnedBy).not.toHaveBeenCalled()
        expect(mockExtendInviteForRetry).toHaveBeenCalledWith(30, { inviteCode: 'alice', userId: 'user-a' })
        expect(mockCaptureException).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ tags: { error_type: 'invite_accept_failed' } })
        )
    })

    it('clears a terminal invalid invite instead of retrying it into a future referral', async () => {
        mockAcceptInvite.mockResolvedValue({
            success: false,
            retryable: false,
            status: 409,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })

        await expect(settlePendingInviteAttribution('user-a')).resolves.toMatchObject({ status: 'terminal' })

        expect(mockClearInviteIfOwnedBy).toHaveBeenCalledWith('alice', 'user-a')
        expect(mockExtendInviteForRetry).not.toHaveBeenCalled()
        expect(mockCaptureException).not.toHaveBeenCalled()
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

        await expect(settlePendingInviteAttribution('user-a')).resolves.toMatchObject({ status: 'campaign_only' })

        expect(mockSettleAcceptedInviteAcquisition).toHaveBeenCalledWith(legacyAcquisition, [
            expect.objectContaining({ badgeCampaign: 'founderhaus', outcome: 'awarded' }),
        ])
        expect(mockClearInviteIfOwnedBy).toHaveBeenCalledWith('alice', 'user-a')
        expect(mockCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.INVITE_ACCEPT_FAILED, expect.anything())
    })

    it('de-duplicates registration and auth-provider attempts', async () => {
        let resolveAccept!: (value: unknown) => void
        mockAcceptInvite.mockReturnValue(
            new Promise((resolve) => {
                resolveAccept = resolve
            })
        )

        const registrationAttempt = settlePendingInviteAttribution('user-a')
        const authProviderAttempt = settlePendingInviteAttribution('user-a')
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
        expect(mockClearInviteIfOwnedBy).toHaveBeenCalledTimes(1)
    })

    it('does not let another account join or consume the bound retry', async () => {
        let resolveAccept!: (value: unknown) => void
        mockBindInviteToUser.mockImplementation((userId: string) => userId === 'user-a')
        mockAcceptInvite.mockReturnValue(
            new Promise((resolve) => {
                resolveAccept = resolve
            })
        )

        const accountAAttempt = settlePendingInviteAttribution('user-a')
        await expect(settlePendingInviteAttribution('user-b')).resolves.toMatchObject({
            status: 'account_mismatch',
        })
        expect(mockAcceptInvite).toHaveBeenCalledTimes(1)

        resolveAccept({
            success: false,
            retryable: true,
            attributionResolved: false,
            onboardingResolved: false,
            claims: [],
        })
        await expect(accountAAttempt).resolves.toMatchObject({ status: 'retryable' })
    })
})
