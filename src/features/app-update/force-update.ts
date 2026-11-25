import { getStoreUpdatePrompt } from '@/features/attention/store-update-prompt'
import type { StoreUpdateOffer, StoreUpdatePlatform } from '@/utils/store-update'

/*
 * The forced update floor is the JSON payload of this PostHog flag, in the same
 * format as the API's appUpdateCutoffs: {"ios":"1.40.0","android":"140"}, the
 * App Store version and the Google Play versionCode. It is a PostHog payload and
 * not a kill switch because GET /config/kill-switches serves only the keys the
 * API lists, so a new key there needs an API release.
 *
 * No flag, no payload or an unreadable payload shows nothing: a config error
 * must never lock users out.
 */
export const FORCE_UPDATE_FLOOR_FLAG = 'force-app-update-floor'

/**
 * The store that must update this app, or null. Same rule as the Tier 1 update
 * drawer: the installed native version is below the floor and the device's
 * store offers a build at or above it, so a device the new build cannot reach
 * (old OS, staged rollout) is never blocked.
 */
export function getForcedUpdatePlatform(offer: StoreUpdateOffer | null, rawFloor: unknown): StoreUpdatePlatform | null {
    const prompt = getStoreUpdatePrompt(offer, rawFloor)
    return prompt?.tier === 1 ? prompt.platform : null
}
