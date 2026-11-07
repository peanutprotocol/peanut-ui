'use client'

import { useCapabilities } from '@/hooks/useCapabilities'
import type { CapabilityRoute } from '@/types/capabilities'
import { findPixRoute, pixScreen, type PixScreen } from '@/features/pix/pixRoute.utils'

/** The backend's route for a Pix deposit or withdrawal, and whose screens it mounts. */
export function usePixRoute(operation: CapabilityRoute['operation']): {
    route: CapabilityRoute | undefined
    screen: PixScreen
} {
    const { capabilities, isLoading } = useCapabilities()
    const route = findPixRoute(capabilities.routes, operation)
    return { route, screen: pixScreen(route, isLoading) }
}
