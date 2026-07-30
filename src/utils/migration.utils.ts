import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { STORE_URL, type MigrationSurface, type StoreKind } from '@/constants/migration.consts'
import { openExternalUrl } from '@/utils/capacitor'

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
