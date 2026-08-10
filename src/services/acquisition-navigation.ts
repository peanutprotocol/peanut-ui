export type AcquisitionDestination = 'offramp_migration' | 'normal_app'

export type AcquisitionNavigation = {
    fallback: 'normal_app'
    destination: AcquisitionDestination
}

export const OFFRAMP_MIGRATION_ROUTE = '/add-money/crypto?network=EVM&source=offramp'

const DESTINATION_ROUTES: Readonly<Record<AcquisitionDestination, string>> = {
    offramp_migration: OFFRAMP_MIGRATION_ROUTE,
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
