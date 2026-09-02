/**
 * PWA → native app migration (pwa-sunset).
 *
 * Everything here is dark until the `pwa-sunset` PostHog flag is flipped ON
 * (no deploy needed). Flag ON starts the notice window: download prompts +
 * store links appear and new signups skip the PWA-install steps. Once
 * MIGRATION_CUTOVER_DATE passes (flag still ON), the web app is replaced by
 * the full-screen sunset block (SunsetScreen).
 */

export const PWA_SUNSET_FLAG = 'pwa-sunset'

// ponytail: cutover date is a constant; move to flag payload only if the date
// needs to move without a deploy. placeholder — set the real date before flag-on.
export const MIGRATION_CUTOVER_DATE = new Date('2026-12-31T00:00:00Z')

// how long "Remind me later" snoozes the download prompt modal
export const DOWNLOAD_PROMPT_SNOOZE_DAYS = 3

// download prompt copy switches from celebratory to friendly-urgency once
// the cutover is this close (Hugo's two-phase notice window)
export const MIGRATION_URGENCY_THRESHOLD_DAYS = 14

// how long "Not now" on the notifications pre-prompt snoozes before re-asking
// (only during the migration window; flag off keeps closed-forever)
export const NOTIF_PROMPT_SNOOZE_DAYS = 14

// store review deep links ("Love it" on the review prompt). the ios
// write-review action needs the real numeric app id — placeholder until launch.
export const REVIEW_URL = {
    ios: 'https://apps.apple.com/app/peanut?action=write-review',
    android: 'https://play.google.com/store/apps/details?id=me.peanut.wallet',
} as const

// support escape hatch for users who can't install the app: support DMs
// `/home?keep-web=<token>`; visiting it stores a 90-day cookie that bypasses
// the sunset block.
// ponytail: static shared token, FE-only; per-user tokens need a BE endpoint.
export const KEEP_WEB_COOKIE = 'keep-web'
export const KEEP_WEB_TOKEN = 'walnut-still-cracks'
export const KEEP_WEB_COOKIE_DAYS = 90

// placeholder store URLs — real App Store numeric id + Play listing must be
// confirmed before flag-on (also needed for the review deep link).
export const STORE_URL = {
    ios: 'https://apps.apple.com/app/peanut',
    android: 'https://play.google.com/store/apps/details?id=me.peanut.wallet',
} as const

export const STORE_NAME = {
    ios: 'App Store',
    android: 'Google Play',
} as const

/** `surface` property for migration analytics events. */
export const MIGRATION_SURFACES = {
    DOWNLOAD_MODAL: 'download_modal',
    SUNSET_SCREEN: 'sunset_screen',
    LANDING_HERO: 'landing_hero',
    HOME_BANNER: 'home_banner',
    SETUP: 'setup',
    GUEST_FLOW: 'guest_flow',
    PROFILE_UPDATE: 'profile_update',
} as const

export type MigrationSurface = (typeof MIGRATION_SURFACES)[keyof typeof MIGRATION_SURFACES]
export type StoreKind = keyof typeof STORE_URL
