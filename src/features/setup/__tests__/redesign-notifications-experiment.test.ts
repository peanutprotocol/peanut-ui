/**
 * P4-17 [u]: the redesign keeps dev's notifications experiment untouched (contract P4 § 0, § 3): the same flag,
 * the same three arms, the same reads, and the module byte-identical to origin/dev c985d250e.
 */
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { join } from 'path'
import posthog from 'posthog-js'
import { NOTIFICATIONS_EXPERIMENT_FLAG, readNotificationsVariant, trackPromptAnswer } from '../notificationsExperiment'

let mockLoaded = true
jest.mock('@/utils/featureFlag.utils', () => ({ areFeatureFlagsLoaded: () => mockLoaded }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { getFeatureFlag: jest.fn(), capture: jest.fn() } }))
const getFeatureFlag = posthog.getFeatureFlag as jest.Mock

/** sha256 of src/features/setup/notificationsExperiment.ts at c985d250e (`git show … | sha256sum`). */
const DEV_SHA256 = 'eab2032d806f7aebbc753953a9b2e03dd9a2ac48fd4a4ec5b421540913a20698'

beforeEach(() => {
    mockLoaded = true
    getFeatureFlag.mockReset()
})

it('P4-17 notificationsExperiment.ts is byte-identical to origin/dev c985d250e', () => {
    const source = readFileSync(join(__dirname, '..', 'notificationsExperiment.ts'))
    expect(createHash('sha256').update(new Uint8Array(source)).digest('hex')).toBe(DEV_SHA256)
})

it('P4-17 the flag and arms are dev’s', () => {
    expect(NOTIFICATIONS_EXPERIMENT_FLAG).toBe('signup-notification-switches')
    for (const arm of ['switches', 'defaults_on'] as const) {
        getFeatureFlag.mockReturnValue(arm)
        expect(readNotificationsVariant()).toBe(arm)
    }
    for (const other of ['control', 'all_on', undefined, false]) {
        getFeatureFlag.mockReturnValue(other)
        expect(readNotificationsVariant()).toBe('control')
    }
})

it('P4-17 before PostHog answers, control with no flag read (no exposure)', () => {
    mockLoaded = false
    expect(readNotificationsVariant()).toBe('control')
    expect(getFeatureFlag).not.toHaveBeenCalled()
})

it('P4-17 the prompt answer event keeps its name and properties', () => {
    trackPromptAnswer('control', 'denied')
    expect(posthog.capture).toHaveBeenCalledWith('signup_push_permission_answered', {
        variant: 'control',
        answer: 'denied',
    })
})
