import { criticalFlowTags } from '@/utils/sentry-critical-flow'
import { shouldIgnoreError } from '../../../sentry.utils'

describe('Sentry KYC critical-flow filtering', () => {
    const failedFetchEvent = {
        exception: {
            values: [{ type: 'TypeError', value: 'Failed to fetch' }],
        },
    }

    it('keeps a tagged KYC network failure', () => {
        expect(
            shouldIgnoreError({
                ...failedFetchEvent,
                tags: criticalFlowTags('kyc'),
            } as never)
        ).toBe(false)
    })

    it('continues to ignore the same untagged network failure', () => {
        expect(shouldIgnoreError(failedFetchEvent as never)).toBe(true)
    })
})
