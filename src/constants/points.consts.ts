/**
 * Points System Constants
 *
 * Shared constants for points display and calculations.
 * Should match backend values in peanut-api-ts/src/points-v2/constants.ts
 */

/**
 * Transitivity multiplier for referral points
 * Users earn this percentage of their invitees' points
 */
export const TRANSITIVITY_MULTIPLIER = 0.5 // 50% of invitees' points

/**
 * Tier thresholds for display purposes
 * Note: Actual tier calculation happens on backend
 */
export const TIER_THRESHOLDS = {
    TIER_1: 1000,
    TIER_2: 10000,
} as const
