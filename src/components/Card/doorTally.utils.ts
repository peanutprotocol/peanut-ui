/**
 * Door-tally math for the Berghain rejection screen ("N tried · M got in").
 *
 * The backend (/card → waitlistTotal, admittedTotal) reports the REAL counts.
 * "tried" gets inflated for FOMO — the same fake-scarcity flex the /shhhhh
 * landing already does with its "only 20 a week" ScarcityCounter — while
 * "got in" is shown verbatim (the real number admitted).
 *
 * The inflation is a pure function of the real count (a constant multiplier
 * with a floor), so it's deterministic per render and never jitters between
 * frames. No randomness on purpose.
 */

/**
 * FOMO inflation factor applied to the real waitlist size for "tried". ×5 (not
 * ×3) so the real number clears the 213 floor at the current prod waitlist size
 * (~55 → 55×5 = 275 > 213) — otherwise the floor masks the real count and the
 * tally looks frozen at 213.
 */
export const DOOR_TALLY_FOMO_MULTIPLIER = 5

/**
 * Minimum "tried" — keeps the door looking busy when the real waitlist is
 * still small, and doubles as the loading fallback. 213 mirrors the original
 * hardcoded tally so the copy reads identically before counts land.
 */
export const DOOR_TALLY_APPLICANTS_FLOOR = 213

/** Loading fallback for "got in" (real admitted count, before it lands). */
export const DOOR_TALLY_ADMITTED_FALLBACK = 7

export type DoorTally = {
    /** Inflated "tried" count (FOMO). */
    applicants: number
    /** Real "got in" count, verbatim. */
    admitted: number
}

/**
 * Inflate the real waitlist size into the FOMO "tried" number. Falls back to
 * the floor for missing/zero/invalid input (e.g. counts still loading).
 */
export function inflateApplicants(waitlistTotal?: number): number {
    if (typeof waitlistTotal !== 'number' || !Number.isFinite(waitlistTotal) || waitlistTotal <= 0) {
        return DOOR_TALLY_APPLICANTS_FLOOR
    }
    return Math.max(DOOR_TALLY_APPLICANTS_FLOOR, Math.round(waitlistTotal * DOOR_TALLY_FOMO_MULTIPLIER))
}

/**
 * Build the door tally from the real backend counts: inflated "tried" + real
 * "got in" (with sane fallbacks while the counts are loading).
 */
export function computeDoorTally(waitlistTotal?: number, admittedTotal?: number): DoorTally {
    const admitted =
        typeof admittedTotal === 'number' && Number.isFinite(admittedTotal) && admittedTotal >= 0
            ? Math.round(admittedTotal)
            : DOOR_TALLY_ADMITTED_FALLBACK
    return { applicants: inflateApplicants(waitlistTotal), admitted }
}
