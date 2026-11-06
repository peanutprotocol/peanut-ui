import type { CapabilityRoute } from '@/types/capabilities'

export const PIX_METHOD = 'PIX_BR'

export function findPixRoute(
    routes: CapabilityRoute[] | undefined,
    operation: CapabilityRoute['operation']
): CapabilityRoute | undefined {
    return routes?.find((route) => route.operation === operation && route.method === PIX_METHOD)
}

/** Whose screens a Pix deposit or withdrawal mounts, from the backend's route. */
export type PixScreen = 'loading' | 'paused' | 'avenia' | 'manteca' | 'unavailable'

/**
 * The route names the provider. A refused route names none, so its best
 * candidate's screens explain the refusal (Avenia's setup step, Manteca's own
 * gate). A paused route shows the provider-outage screen.
 */
export function pixScreen(route: CapabilityRoute | undefined, isLoading: boolean): PixScreen {
    if (isLoading) return 'loading'
    if (!route) return 'unavailable'
    if (route.state === 'paused') return 'paused'
    const provider = route.provider ?? route.candidates[0]?.provider
    if (provider === 'avenia') return 'avenia'
    if (provider === 'manteca') return 'manteca'
    return 'unavailable'
}
