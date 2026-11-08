import { withFeatureReport } from '../featureReport.fixture'

describe('the feature report fixture', () => {
    it('mirrors the API for a working euro rail and a pending pound one', () => {
        const { features } = withFeatureReport({
            rails: [
                {
                    id: 'bridge.sepa_eu',
                    provider: 'bridge',
                    method: 'SEPA_EU',
                    channel: 'bank',
                    country: 'EU',
                    currency: 'EUR',
                    status: 'enabled',
                    resolved: { status: 'enabled' },
                },
                {
                    id: 'bridge.faster_payments_gb',
                    provider: 'bridge',
                    method: 'FASTER_PAYMENTS_GB',
                    channel: 'bank',
                    country: 'GB',
                    currency: 'GBP',
                    status: 'pending',
                    resolved: { status: 'pending' },
                },
            ],
            nextActions: [],
            restrictions: [],
        })
        expect(features?.bank.state).toBe('on')
        expect(features?.bank.accounts.GBP).toEqual({ state: 'setting_up' })
        expect(features?.bank.accounts.USD).toEqual({ state: 'ready' })
        expect(features?.qr).toEqual({ state: 'ready' })
    })
})
