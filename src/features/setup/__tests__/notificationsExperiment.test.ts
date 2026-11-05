import posthog from 'posthog-js'
import { NOTIFICATIONS_EXPERIMENT_FLAG, readNotificationsVariant } from '../notificationsExperiment'

let mockLoaded = true
jest.mock('@/utils/featureFlag.utils', () => ({ areFeatureFlagsLoaded: () => mockLoaded }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { getFeatureFlag: jest.fn(), capture: jest.fn() } }))
const getFeatureFlag = posthog.getFeatureFlag as jest.Mock

beforeEach(() => {
    mockLoaded = true
    getFeatureFlag.mockReset()
})

it.each(['switches', 'defaults_on'] as const)('shows the %s variant only to users PostHog put in it', (variant) => {
    getFeatureFlag.mockReturnValue(variant)
    expect(readNotificationsVariant()).toBe(variant)
    expect(getFeatureFlag).toHaveBeenCalledWith(NOTIFICATIONS_EXPERIMENT_FLAG)
})

it.each(['control', 'all_on', undefined, false, 'something-else'])(
    'falls back to control for a flag value of %p',
    (value) => {
        getFeatureFlag.mockReturnValue(value)
        expect(readNotificationsVariant()).toBe('control')
    }
)

it('shows control without reading the flag before PostHog has answered, so no exposure is recorded', () => {
    mockLoaded = false
    expect(readNotificationsVariant()).toBe('control')
    expect(getFeatureFlag).not.toHaveBeenCalled()
})
