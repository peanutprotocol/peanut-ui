import { readStoredValue, writeStoredValue } from '@/utils/safe-storage'

// localStorage key for the one-time celebration gate (per-device by design:
// re-doing the funnel re-celebrates, see the eligibility-check effect below).
// v2 (2026-05-25): celebration now fires for ALL hasCardAccess users, not
// just skip-badge holders. v1's stale `true` values from earlier QA runs
// would silently skip the celebration — bumping the key invalidates them.
export const SKIP_CELEBRATION_SEEN_KEY = 'card_skip_celebration_seen_v2'

export function getSkipCelebrationSeen(): boolean {
    // safe-storage, not raw localStorage: this runs in a render-time useState
    // initializer, and the bare accessor THROWS where site data is blocked
    // (private windows, storage-restricted webviews) — a worst-case render
    // crash for a cosmetic gate. readStoredValue swallows that to null.
    return readStoredValue(SKIP_CELEBRATION_SEEN_KEY) === 'true'
}

export function markSkipCelebrationSeen(): void {
    writeStoredValue(SKIP_CELEBRATION_SEEN_KEY, 'true')
}
