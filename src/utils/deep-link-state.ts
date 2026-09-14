/*
 * Module-level deep-link dispatch state, shared between useNativeAppLinks (the
 * writer) and LandingPageCapacitorGate (the reader). Set SYNCHRONOUSLY at
 * dispatch: the gate's /home|/setup replace races the deep-link push on cold
 * start, and Next discards the pending push the moment the replace lands — the
 * flag lets the gate yield to a navigation that already happened.
 */

let deepLinkNavigated = false
let deepLinkGeneration = 0
let deepLinkTarget: string | null = null
const deepLinkGenerationListeners = new Set<() => void>()

export function markDeepLinkNavigated(target?: string): number {
    deepLinkNavigated = true
    deepLinkGeneration += 1
    deepLinkTarget = target ?? null
    deepLinkGenerationListeners.forEach((listener) => listener())
    return deepLinkGeneration
}

export function hasDeepLinkNavigated(): boolean {
    return deepLinkNavigated
}

export function getDeepLinkGeneration(): number {
    return deepLinkGeneration
}

export function getDeepLinkTarget(): string | null {
    return deepLinkTarget
}

export function subscribeToDeepLinkGeneration(listener: () => void): () => void {
    deepLinkGenerationListeners.add(listener)
    return () => deepLinkGenerationListeners.delete(listener)
}

// Module state outlives a jest test; production code must never call this.
export function resetDeepLinkStateForTests(): void {
    deepLinkNavigated = false
    deepLinkGeneration = 0
    deepLinkTarget = null
}
