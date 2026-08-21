import { getRedirectUrl } from '@/utils/general.utils'
import {
    destinationForShhhhhClaims,
    queueShhhhhCampaignContinuation,
    settleShhhhhCampaignContinuation,
    shhhhhCampaignSignupRoute,
} from './shhhhh-acquisition'

describe('Shhhhh campaign continuation', () => {
    beforeEach(() => localStorage.clear())

    it.each(['awarded', 'already_owned'] as const)('continues a confirmed Skip Pass %s to /card', (outcome) => {
        expect(destinationForShhhhhClaims([{ badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome }])).toBe(
            '/card'
        )
    })

    it.each(['inactive', 'expired', 'unknown', 'definition_missing', 'retryable_error'] as const)(
        'falls back home for %s',
        (outcome) => {
            expect(destinationForShhhhhClaims([{ badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome }])).toBe(
                '/home'
            )
        }
    )

    it('does not treat an unrelated confirmed badge as a card continuation', () => {
        expect(
            destinationForShhhhhClaims([{ badgeCampaign: 'event', badgeCode: 'EVENT_ALUMNI', outcome: 'awarded' }])
        ).toBe('/home')
    })

    it('starts signed-out registration without an unconditional card redirect', () => {
        expect(shhhhhCampaignSignupRoute()).toBe('/setup?step=signup')
    })

    it.each(['awarded', 'already_owned'] as const)(
        'replaces the safe signed-out marker with /card after confirmed Skip Pass %s',
        (outcome) => {
            queueShhhhhCampaignContinuation()
            expect(
                settleShhhhhCampaignContinuation([{ badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome }])
            ).toBe('/card')
            expect(getRedirectUrl()).toBe('/card')
        }
    )

    it.each(['inactive', 'expired', 'unknown', 'definition_missing', 'retryable_error'] as const)(
        'keeps the signed-out continuation on the normal app after %s',
        (outcome) => {
            queueShhhhhCampaignContinuation()
            expect(
                settleShhhhhCampaignContinuation([{ badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome }])
            ).toBe('/home')
            expect(getRedirectUrl()).toBe('/home')
        }
    )

    it("does not consume another acquisition flow's stored destination", () => {
        localStorage.setItem('redirect', JSON.stringify('/claim?step=claim'))
        expect(
            settleShhhhhCampaignContinuation([
                { badgeCampaign: 'skip', badgeCode: 'WAITLIST_SKIP', outcome: 'awarded' },
            ])
        ).toBeUndefined()
        expect(getRedirectUrl()).toBe('/claim?step=claim')
    })
})
