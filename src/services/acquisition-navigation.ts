export type AcquisitionDestination = 'offramp_migration' | 'normal_app'

export type AcquisitionNavigation = {
    fallback: 'normal_app'
    destination: AcquisitionDestination
}

// the offramp migration surface is gone (TASK-20535); the enum member survives
// only because the backend can still emit it until its registry flip deploys.
const DESTINATION_ROUTES: Readonly<Record<AcquisitionDestination, string>> = {
    offramp_migration: '/home',
    normal_app: '/home',
}

export function parseAcquisitionNavigation(value: unknown): AcquisitionNavigation | undefined {
    if (!value || typeof value !== 'object') return undefined
    const candidate = value as Partial<AcquisitionNavigation>
    if (
        candidate.fallback !== 'normal_app' ||
        (candidate.destination !== 'offramp_migration' && candidate.destination !== 'normal_app')
    ) {
        return undefined
    }
    return { fallback: candidate.fallback, destination: candidate.destination }
}

/** Translate a backend-owned destination enum into a same-origin application path. */
export function acquisitionDestinationRoute(destination: AcquisitionDestination): string {
    return DESTINATION_ROUTES[destination]
}
