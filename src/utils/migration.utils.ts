import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { IS_DEV } from '@/constants/general.consts'
import {
    MIGRATION_CUTOVER_DATE,
    PWA_SUNSET_FLAG,
    STORE_URL,
    type MigrationSurface,
    type StoreKind,
} from '@/constants/migration.consts'
import { isFeatureFlagEnabled } from '@/utils/featureFlag.utils'
import { openExternalUrl } from '@/utils/capacitor'

/**
 * Flag read with a dev-only localStorage override. Local dev never inits
 * posthog (instrumentation-client gates on NODE_ENV), so e2e QA flips the
 * flag with `localStorage.setItem('pwa-sunset', 'true')` + reload instead.
 * Inert outside dev builds.
 */
export function isPwaSunsetOn(): boolean {
    if (IS_DEV && typeof localStorage !== 'undefined' && localStorage.getItem(PWA_SUNSET_FLAG) === 'true') {
        return true
    }
    return isFeatureFlagEnabled(PWA_SUNSET_FLAG)
}

/**
 * Cutover timestamp with a dev-only localStorage override
 * (`localStorage.setItem('pwa-sunset-cutover', '2020-01-01')` + reload) so the
 * post-cutover sunset block can be QA'd locally without editing the constant.
 */
export function getMigrationCutoverTime(): number {
    if (IS_DEV && typeof localStorage !== 'undefined') {
        const iso = localStorage.getItem('pwa-sunset-cutover')
        if (iso) {
            const t = new Date(iso).getTime()
            if (!Number.isNaN(t)) return t
        }
    }
    return MIGRATION_CUTOVER_DATE.getTime()
}

/** track a store CTA click without navigating (for anchors that navigate themselves). */
export function trackStoreClick(store: StoreKind, surface: MigrationSurface) {
    posthog.capture(ANALYTICS_EVENTS.MIGRATION_STORE_CTA_CLICKED, { surface, store })
}

/** navigate to the app store, tracking which surface sent the user there. */
export function openStore(store: StoreKind, surface: MigrationSurface) {
    trackStoreClick(store, surface)
    // fire-and-forget: native Browser plugin or window.open on web
    void openExternalUrl(STORE_URL[store])
}
