import { DEMO_USER } from '@/constants/demo-data'
import { featureReport } from '@/dev/fixtures/featureReport'

describe('shared feature report contract', () => {
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
