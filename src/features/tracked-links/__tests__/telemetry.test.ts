/** @jest-environment jsdom */
import posthog from 'posthog-js'
import { trackDeferredHandoffCreated } from '@/utils/deferred-link'
import { trackStoreClick } from '@/utils/migration.utils'

let mockAnalyticsAllowed = true
jest.mock('@/features/marketing-qr/consent', () => ({ marketingQrAnalyticsAllowed: () => mockAnalyticsAllowed }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

function visit(path: string) {
    window.history.replaceState(null, '', path)
}

function tapStore() {
    trackStoreClick('ios', 'smart_link', true)
    trackDeferredHandoffCreated('ios')
}

beforeEach(() => {
    jest.clearAllMocks()
    mockAnalyticsAllowed = true
})

it('sends no store or handoff telemetry from a tracked entry without consent', () => {
    mockAnalyticsAllowed = false
    visit('/app?tl=alice&acq_invite=alice')
    tapStore()
    visit('/app?code=alice')
    tapStore()
    expect(posthog.capture).not.toHaveBeenCalled()
})

it('sends both events from a tracked entry with consent', () => {
    visit('/app?tl=alice&acq_invite=alice')
    tapStore()
    expect(posthog.capture).toHaveBeenCalledTimes(2)
})

it('leaves every other page as it was', () => {
    mockAnalyticsAllowed = false
    visit('/invite?code=alice')
    tapStore()
    expect(posthog.capture).toHaveBeenCalledTimes(2)
})
