'use client'

import { useStaleDeploymentReload } from '@/hooks/useStaleDeploymentReload'

/**
 * Renders nothing. Exists so the hook runs inside the provider tree — it reads
 * the query client, the zerodev flow store and the loading-state context, none
 * of which are available in ClientProviders' own body.
 */
export default function StaleDeploymentReload() {
    useStaleDeploymentReload()
    return null
}
