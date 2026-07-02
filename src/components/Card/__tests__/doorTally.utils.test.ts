import {
    inflateApplicants,
    computeDoorTally,
    DOOR_TALLY_APPLICANTS_FLOOR,
    DOOR_TALLY_ADMITTED_FALLBACK,
    DOOR_TALLY_FOMO_MULTIPLIER,
} from '../doorTally.utils'

describe('inflateApplicants', () => {
    test('multiplies the real waitlist size by the FOMO factor', () => {
        // 1000 * 5 = 5000, comfortably above the floor.
        expect(inflateApplicants(1000)).toBe(1000 * DOOR_TALLY_FOMO_MULTIPLIER)
    })

    test('clamps to the floor when the inflated value is small', () => {
        // 10 * 5 = 50 < floor → floor wins.
        expect(inflateApplicants(10)).toBe(DOOR_TALLY_APPLICANTS_FLOOR)
    })

    test('clears the 213 floor at the current prod waitlist size (~55)', () => {
        // The whole point of ×5: 55 * 5 = 275 > 213, so the real (inflated)
        // number renders instead of the masked floor.
        expect(inflateApplicants(55)).toBe(275)
    })

    test('returns a whole number above the floor', () => {
        expect(Number.isInteger(inflateApplicants(101))).toBe(true)
        // 101 * 5 = 505.
        expect(inflateApplicants(101)).toBe(505)
    })

    test.each([undefined, NaN, 0, -5, Infinity])('falls back to the floor for %p', (input) => {
        expect(inflateApplicants(input as number)).toBe(DOOR_TALLY_APPLICANTS_FLOOR)
    })

    test('is deterministic — same input, same output (no jitter)', () => {
        expect(inflateApplicants(742)).toBe(inflateApplicants(742))
    })
})

describe('computeDoorTally', () => {
    test('inflates "tried" but shows "got in" verbatim', () => {
        // 500 * 5 = 2500 tried; 42 admitted shown as-is.
        expect(computeDoorTally(500, 42)).toEqual({ applicants: 2500, admitted: 42 })
    })

    test('uses loading fallbacks when counts are missing', () => {
        expect(computeDoorTally(undefined, undefined)).toEqual({
            applicants: DOOR_TALLY_APPLICANTS_FLOOR,
            admitted: DOOR_TALLY_ADMITTED_FALLBACK,
        })
    })

    test('admitted=0 is real and shown as 0 (not the fallback)', () => {
        expect(computeDoorTally(1000, 0).admitted).toBe(0)
    })
})
