/**
 * PWA → native app migration (pwa-sunset).
 *
 * Everything here is dark until the `pwa-sunset` PostHog flag is flipped ON
 * (no deploy needed). Flag ON closes web signup and shows download prompts and
 * store links. Existing accounts keep logging in on the web (ruled 2026-10-07,
 * hugo): signup is app-only, the web app is not switched off.
 */

export const PWA_SUNSET_FLAG = 'pwa-sunset'

/**
 * Marks the already-native-associated `/home` route as an app-download entry
 * point. On web, the proxy sends it to the `/app` smart-store page. In an
 * installed app, useNativeAppLinks consumes the same URL and applies any
 * deferred payload directly.
 */
export const APP_ENTRY_QUERY_PARAM = 'app_entry'

// how long "Remind me later" snoozes the download prompt modal
export const DOWNLOAD_PROMPT_SNOOZE_DAYS = 3

// how long "Not now" on the notifications pre-prompt snoozes before re-asking
// (only during the migration window; flag off keeps closed-forever)
export const NOTIF_PROMPT_SNOOZE_DAYS = 14

// support escape hatch for users who can't install the app: support DMs
// `/home?keep-web=<token>`; visiting it stores a 90-day cookie that reopens
// web signup in that browser.
// ponytail: static shared token, FE-only; per-user tokens need a BE endpoint.
export const KEEP_WEB_COOKIE = 'keep-web'
export const KEEP_WEB_TOKEN = 'walnut-still-cracks'
export const KEEP_WEB_COOKIE_DAYS = 90

/**
 * Write-a-review deep links for the user-initiated "Rate Peanut" row in Profile
 * → About. A prompt built out of these would breach guideline 5.6.1 (that ask is
 * the OS sheet, see utils/app-review.ts) — Apple documents this form only for a
 * review the user starts themselves, which is what the row is. It is also the
 * release valve for a user whose OS quota silently swallowed the sheet.
 */
export const REVIEW_URL = {
    ios: 'https://apps.apple.com/us/app/id6786373552?action=write-review',
    android: 'https://play.google.com/store/apps/details?id=me.peanut.wallet',
} as const

export const STORE_URL = {
    ios: 'https://apps.apple.com/us/app/id6786373552',
    android: 'https://play.google.com/store/apps/details?id=me.peanut.wallet',
} as const

export const STORE_NAME = {
    ios: 'App Store',
    android: 'Google Play',
} as const

/** `surface` property for migration analytics events. */
export const MIGRATION_SURFACES = {
    DOWNLOAD_MODAL: 'download_modal',
    LANDING_HERO: 'landing_hero',
    HOME_BANNER: 'home_banner',
    SETUP: 'setup',
    GUEST_FLOW: 'guest_flow',
    PROFILE_UPDATE: 'profile_update',
    // the /app smart link itself: the store buttons a scanner lands on
    SMART_LINK: 'smart_link',
    // landing folds that get their own download CTA once the flag is on
    LANDING_APP_FOLD: 'landing_app_fold',
    LANDING_FOOTER: 'landing_footer',
    LANDING_RATES: 'landing_rates',
    LANDING_COUNTRIES: 'landing_countries',
    LANDING_DOOR: 'landing_door',
} as const

export type MigrationSurface = (typeof MIGRATION_SURFACES)[keyof typeof MIGRATION_SURFACES]

export type StoreKind = keyof typeof STORE_URL
