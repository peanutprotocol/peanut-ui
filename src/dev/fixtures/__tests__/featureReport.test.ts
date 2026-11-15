import { DEMO_USER } from '@/constants/demo-data'
import { featureReport, withFixtureFeatureReport } from '@/dev/fixtures/featureReport'
import type { IUserProfile } from '@/interfaces/interfaces'

describe('shared feature report contract', () => {
    it.each(['BD', { country: 'BD' }])('normalizes residence %p and applies paperwork product refusals', (declared) => {
        // Legacy fixture wire data uses both residence strings and country objects.
        const user = {
            ...DEMO_USER,
            capabilities: { ...DEMO_USER.capabilities!, rails: [], nextActions: [], restrictions: [] },
            identityVerification: { status: 'not_started' as const },
            residence: { declared, verified: null },
        } as unknown as IUserProfile
        const result = withFixtureFeatureReport(
            user,
            {},
            {
                products: [
                    { product: 'bridge.usd', available: false, reason: 'account_unavailable_in_residence' },
                    { product: 'bridge.gbp', available: true },
                ],
            }
        )
        expect(result).not.toBeNull()
        const report = result!.capabilities?.features
        expect(report).toBeDefined()
        expect(report!.bank.accounts.USD).toMatchObject({
            state: 'refused',
            reason: 'account_unavailable_in_residence',
        })
        expect(report!.bank.accounts.GBP.state).toBe('action_required')
        expect(report!.local).toEqual(
            featureReport({
                rails: [],
                nextActions: [],
                identity: { status: 'not_started' },
                residence: 'BD',
            }).local
        )
    })

    it('retains explicit report overrides when paperwork supplies a competing refusal', () => {
        const explicit = DEMO_USER.capabilities!.features!
        const result = withFixtureFeatureReport(
            DEMO_USER,
            { capabilities: { ...DEMO_USER.capabilities!, features: explicit } },
            {
                products: [{ product: 'bridge.usd', available: false, reason: 'account_unavailable_in_residence' }],
            }
        )
        expect(result).not.toBeNull()
        expect(result!.capabilities?.features).toEqual(explicit)
    })

    it('keeps the demo user report aligned with the public report builder', () => {
        const capabilities = DEMO_USER.capabilities!
        expect(capabilities.features).toEqual(
            featureReport({
                rails: capabilities.rails,
                nextActions: capabilities.nextActions,
                identity: { status: 'verified' },
                residence: null,
            })
        )
        expect(capabilities.features?.qr?.state).toBe('on')
        expect(capabilities.features?.bank?.accounts.USD.state).toBe('on')
    })
})
