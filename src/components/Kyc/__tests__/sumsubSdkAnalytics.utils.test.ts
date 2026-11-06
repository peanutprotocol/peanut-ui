import posthog from 'posthog-js'
import { captureNativeSdkClosed, createSumsubSdkTracker, nativeErrorProperties } from '../sumsubSdkAnalytics.utils'

jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

const capture = jest.mocked(posthog.capture)

beforeEach(() => capture.mockClear())

describe('createSumsubSdkTracker', () => {
    it('reports a status change with the previous status the SDK gave', () => {
        createSumsubSdkTracker('native').statusChanged({ newStatus: 'Pending', prevStatus: 'Incomplete' })

        expect(capture).toHaveBeenCalledWith('kyc_sdk_status_changed', {
            sdk: 'native',
            prev_status: 'Incomplete',
            new_status: 'Pending',
        })
    })

    it('fills the previous status from the launch snapshot when the SDK sends none (web)', () => {
        const tracker = createSumsubSdkTracker('web')
        tracker.statusChanged({ newStatus: 'init', snapshot: true })
        tracker.statusChanged({ newStatus: 'completed', reviewAnswer: 'GREEN' })

        expect(capture).toHaveBeenNthCalledWith(1, 'kyc_sdk_status_changed', {
            sdk: 'web',
            prev_status: null,
            new_status: 'init',
            snapshot: true,
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
        tracker.statusChanged({ newStatus: 'pending' })
        tracker.statusChanged({ newStatus: 'pending' })

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
        tracker.statusChanged({ newStatus: 'Pending', prevStatus: 'Maria Perez, passport 123' })
        tracker.step('StepInitiated', 'john@example.com')
        tracker.statusChanged({ newStatus: { nested: true } })

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

describe('nativeErrorProperties', () => {
    it('keeps codes and class names and drops the SDK text', () => {
        const props = nativeErrorProperties({
            source: 'SNSVerificationStepViewModel',
            message: 'Verification step. Error building state',
            causes: ['com.sumsub.sns.core.data.model.SNSException$Api'],
            chain: 'SNSException$Api: phone +5491155550000 is not allowed',
            httpCode: 400,
            errorCode: 1003,
            errorName: 'phone_not_allowed',
            correlationId: 'req-7f3a',
            ageMs: 820,
        })

        expect(props).toEqual({
            error_source: 'SNSVerificationStepViewModel',
            error_causes: ['com.sumsub.sns.core.data.model.SNSException$Api'],
            error_root_cause: 'com.sumsub.sns.core.data.model.SNSException$Api',
            error_http_code: 400,
            error_code: 1003,
            error_name: 'phone_not_allowed',
            error_correlation_id: 'req-7f3a',
            error_age_ms: 820,
        })
        expect(JSON.stringify(props)).not.toContain('5491155550000')
    })

    it('reports the innermost cause as the root and drops anything that is not a class name', () => {
        const props = nativeErrorProperties({
            causes: [
                'com.sumsub.sns.core.data.model.SNSException$Network',
                'not a class name!',
                'java.net.SocketException',
            ],
        })

        expect(props.error_causes).toEqual([
            'com.sumsub.sns.core.data.model.SNSException$Network',
            'java.net.SocketException',
        ])
        expect(props.error_root_cause).toBe('java.net.SocketException')
        expect(props.error_http_code).toBeNull()
    })

    it('adds nothing when the plugin sent no detail', () => {
        expect(nativeErrorProperties(undefined)).toEqual({})
        expect(nativeErrorProperties(null)).toEqual({})
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
