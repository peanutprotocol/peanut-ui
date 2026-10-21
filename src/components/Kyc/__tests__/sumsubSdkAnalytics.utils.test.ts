import posthog from 'posthog-js'
import { captureNativeSdkClosed, createSumsubSdkTracker } from '../sumsubSdkAnalytics.utils'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const capture = jest.mocked(posthog.capture)

beforeEach(() => capture.mockClear())

describe('createSumsubSdkTracker', () => {
    it('reports a status change with the previous status the SDK gave', () => {
        createSumsubSdkTracker('native').statusChanged('Pending', 'Incomplete')

        expect(capture).toHaveBeenCalledWith('kyc_sdk_status_changed', {
            sdk: 'native',
            prev_status: 'Incomplete',
            new_status: 'Pending',
        })
    })

    it('fills the previous status from the last one when the SDK sends none (web)', () => {
        const tracker = createSumsubSdkTracker('web')
        tracker.statusChanged('init')
        tracker.statusChanged('completed', undefined, 'GREEN')

        expect(capture).toHaveBeenNthCalledWith(1, 'kyc_sdk_status_changed', {
            sdk: 'web',
            prev_status: null,
            new_status: 'init',
        })
        expect(capture).toHaveBeenNthCalledWith(2, 'kyc_sdk_status_changed', {
            sdk: 'web',
            prev_status: 'init',
            new_status: 'completed',
            review_answer: 'GREEN',
        })
    })

    it('drops the same status reported twice in a row (plain and idCheck. twins)', () => {
        const tracker = createSumsubSdkTracker('web')
        tracker.statusChanged('pending')
        tracker.statusChanged('pending')

        expect(capture).toHaveBeenCalledTimes(1)
    })

    it('reports step events with the document set type and the cancel flag', () => {
        const tracker = createSumsubSdkTracker('native')
        tracker.step('StepInitiated', 'IDENTITY')
        tracker.step('StepCompleted', 'IDENTITY', 'true')

        expect(capture).toHaveBeenNthCalledWith(1, 'kyc_sdk_step', {
            sdk: 'native',
            event_type: 'StepInitiated',
            step: 'IDENTITY',
        })
        expect(capture).toHaveBeenNthCalledWith(2, 'kyc_sdk_step', {
            sdk: 'native',
            event_type: 'StepCompleted',
            step: 'IDENTITY',
            is_cancelled: true,
        })
    })

    it('ignores SDK event types that are not steps, and step twins', () => {
        const tracker = createSumsubSdkTracker('web')
        tracker.step('Analytics', 'IDENTITY')
        tracker.step('StepInitiated', 'SELFIE')
        tracker.step('StepInitiated', 'SELFIE')

        expect(capture).toHaveBeenCalledTimes(1)
    })

    it('never sends a value that is not an SDK code', () => {
        const tracker = createSumsubSdkTracker('native')
        tracker.statusChanged('Pending', 'Maria Perez, passport 123')
        tracker.step('StepInitiated', 'john@example.com')
        tracker.statusChanged({ nested: true })

        expect(capture).toHaveBeenCalledTimes(2)
        expect(capture).toHaveBeenNthCalledWith(1, 'kyc_sdk_status_changed', {
            sdk: 'native',
            prev_status: null,
            new_status: 'Pending',
        })
        expect(capture).toHaveBeenNthCalledWith(2, 'kyc_sdk_step', {
            sdk: 'native',
            event_type: 'StepInitiated',
            step: null,
        })
    })
})

describe('captureNativeSdkClosed', () => {
    it('sends the status, success flag and error type, never the error message', () => {
        captureNativeSdkClosed({
            success: false,
            status: 'Failed',
            errorType: 'Network',
            errorMsg: 'request for applicant maria@example.com failed',
        })

        expect(capture).toHaveBeenCalledWith('kyc_sdk_closed', {
            sdk: 'native',
            status: 'Failed',
            success: false,
            error_type: 'Network',
        })
    })

    it('still reports a launch that resolved with no result', () => {
        captureNativeSdkClosed(undefined)

        expect(capture).toHaveBeenCalledWith('kyc_sdk_closed', {
            sdk: 'native',
            status: null,
            success: null,
            error_type: null,
        })
    })
})
