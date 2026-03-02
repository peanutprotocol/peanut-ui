/**
 * Points System Constants
 *
 * Shared constants for points display.
 * Transitivity multiplier is no longer hardcoded — use `contributedPoints` from API.
 */

/**
 * Tier thresholds for display purposes
 * Note: Actual tier calculation happens on backend
 */
export const TIER_THRESHOLDS = {
    TIER_1: 1000,
    TIER_2: 10000,
} as const
