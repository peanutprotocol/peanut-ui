/*
 * Module-level deep-link dispatch state, shared between useNativeAppLinks (the
 * writer) and LandingPageCapacitorGate (the reader). Set SYNCHRONOUSLY at
 * dispatch: the gate's /home|/setup replace races the deep-link push on cold
 * start, and Next discards the pending push the moment the replace lands — the
 * flag lets the gate yield to a navigation that already happened.
 */

let deepLinkNavigated = false
let deepLinkGeneration = 0

export function markDeepLinkNavigated(): number {
    deepLinkNavigated = true
    deepLinkGeneration += 1
    return deepLinkGeneration
}

export function hasDeepLinkNavigated(): boolean {
    return deepLinkNavigated
}

export function getDeepLinkGeneration(): number {
    return deepLinkGeneration
}

// Module state outlives a jest test; production code must never call this.
export function resetDeepLinkStateForTests(): void {
    deepLinkNavigated = false
    deepLinkGeneration = 0
}
