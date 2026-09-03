import { isTypedCampaignOnlyInviteResponse, resolveInviteResolutionFlags } from '../invite-response'

describe('invite response rollout helpers', () => {
    it('uses the legacy success signal only when both discriminators are absent', () => {
        expect(resolveInviteResolutionFlags({ message: 'legacy success' }, true)).toEqual({
            attributionResolved: true,
            onboardingResolved: true,
        })
        expect(resolveInviteResolutionFlags({ attributionResolved: true }, true)).toEqual({
            attributionResolved: false,
            onboardingResolved: false,
        })
    })

    it('lets either explicit false discriminator win over a legacy success signal', () => {
        expect(resolveInviteResolutionFlags({ attributionResolved: false, onboardingResolved: true }, true)).toEqual({
            attributionResolved: false,
            onboardingResolved: false,
        })
        expect(resolveInviteResolutionFlags({ attributionResolved: true, onboardingResolved: false }, true)).toEqual({
            attributionResolved: false,
            onboardingResolved: false,
        })
    })

    it('recognizes only a fully typed campaign-only response', () => {
        const typed = {
            message: 'Campaign processed without invite attribution',
            attributionResolved: false,
            onboardingResolved: false,
            legacyAcquisition: {
                campaignTag: 'offramp',
                fallback: 'normal_app',
                destination: 'offramp_migration',
            },
        }

        expect(isTypedCampaignOnlyInviteResponse(typed)).toBe(true)
        expect(isTypedCampaignOnlyInviteResponse({ ...typed, onboardingResolved: true })).toBe(false)
        expect(isTypedCampaignOnlyInviteResponse({ ...typed, legacyAcquisition: undefined })).toBe(false)
        // retired destination fields are ignored, not validated (TASK-21226)
        expect(
            isTypedCampaignOnlyInviteResponse({
                ...typed,
                legacyAcquisition: { ...typed.legacyAcquisition, destination: 'future_product_flow' },
            })
        ).toBe(true)
        expect(
            isTypedCampaignOnlyInviteResponse({
                ...typed,
                legacyAcquisition: { ...typed.legacyAcquisition, campaignTag: '   ' },
            })
        ).toBe(false)
    })
})
