import type { CaptureResult } from 'posthog-js'
import {
    AUTOCAPTURE_SAMPLE_RATE_FLAG,
    autocaptureSampleRate,
    sampleAutocapture,
    trackAutocaptureSampleRate,
} from '../autocapture-sampling'

const event = (name: string) => ({ event: name, properties: { $el_text: 'Continue' } }) as unknown as CaptureResult

describe('autocaptureSampleRate', () => {
    it.each([
        [0.25, 0.25],
        [0, 0],
        [1, 1],
        [1.5, 1],
        [-0.2, 0],
    ])('reads the number payload %p as %p', (payload, rate) => {
        expect(autocaptureSampleRate(payload)).toBe(rate)
    })

    it.each([undefined, null, '0.2', '', { rate: 0.2 }, Number.NaN, true])(
        'keeps every event for a payload that is not a number: %p',
        (payload) => {
            expect(autocaptureSampleRate(payload)).toBe(1)
        }
    )
})

describe('sampleAutocapture', () => {
    it('drops $autocapture events above the rate and keeps the ones below it', () => {
        const kept = event('$autocapture')
        expect(sampleAutocapture(kept, 0.3, () => 0.29)).toBe(kept)
        expect(sampleAutocapture(event('$autocapture'), 0.3, () => 0.3)).toBeNull()
        expect(sampleAutocapture(event('$autocapture'), 0, () => 0)).toBeNull()
    })

    it.each(['$pageview', '$exception', '$rageclick', 'card_gate_step_viewed', '$identify'])(
        'never samples %s',
        (name) => {
            const kept = event(name)
            expect(sampleAutocapture(kept, 0, () => 0.99)).toBe(kept)
        }
    )

    it('keeps everything at rate 1 and passes a dropped event through', () => {
        const kept = event('$autocapture')
        expect(sampleAutocapture(kept, 1, () => 0.99)).toBe(kept)
        expect(sampleAutocapture(null, 0)).toBeNull()
    })
})

describe('trackAutocaptureSampleRate', () => {
    it('reads the payload without a $feature_flag_called event and applies it to later events', () => {
        let onFlags: () => void = () => {}
        const getFeatureFlagResult = jest.fn(() => ({ payload: 0 }))
        trackAutocaptureSampleRate({
            onFeatureFlags: (callback: () => void) => {
                onFlags = callback
                return () => {}
            },
            getFeatureFlagResult,
        } as never)

        // Before flags load, every event is kept.
        const early = event('$autocapture')
        expect(sampleAutocapture(early)).toBe(early)

        onFlags()
        expect(getFeatureFlagResult).toHaveBeenCalledWith(AUTOCAPTURE_SAMPLE_RATE_FLAG, { send_event: false })
        expect(sampleAutocapture(event('$autocapture'))).toBeNull()

        // The flag is switched off: no payload, keep all again.
        getFeatureFlagResult.mockReturnValue(undefined as never)
        onFlags()
        const late = event('$autocapture')
        expect(sampleAutocapture(late)).toBe(late)
    })
})
